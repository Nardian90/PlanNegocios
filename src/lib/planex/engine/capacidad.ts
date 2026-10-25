// ============================================================================
// Motor estructural — Capacidad instalada, escenarios y limitación (misión §7).
//
// La capacidad se deriva de los RECURSOS OPERATIVOS reales del modelo
// (gabinetes, sillones, equipos, profesionales, locales): no de una cifra
// suelta por servicio. Cada recurso aporta horas-año:
//
//   horasDisp(r, t) = cantidad(r, t) × horasDia × diasAnio × (1 − pctMantenimiento)
//   cantidad(r, t) = cantidad base si t ≥ anioDisponible
//                    + ampliaciones del escenario B activas en el año t
//
// Cada servicio declara qué recursos utiliza y la duración media de su
// procedimiento. Un procedimiento ocupa simultáneamente cada recurso listado
// durante su duración. Como los recursos se COMPARTEN entre líneas, la
// capacidad no puede calcularse multiplicando gabinetes × turnos por servicio:
// se resuelve por POOL DE TIEMPO con asignación proporcional (pro-rata):
//
//   horasDemandadas(r, t) = Σ_s demandaMensual(s, t) × 12 × duraciónHoras(s)
//   escala(r, t) = 1  si horasDemandadas ≤ horasDisp;  horasDisp/demandadas  si no
//   cantidadReal(s, t) = demanda(s, t) × min_{r∈recursos(s)} escala(r, t)
//                      y además ≤ capacidadMaxMensual(s) si el servicio fija un tope técnico directo
//
// Escenarios (misión §7.3):
//   A_constante: las ampliaciones se ignoran; la producción queda limitada a
//                la capacidad base (la demanda no atendida se pierde y se
//                advierte).
//   B_ampliacion: las ampliaciones programadas entran en su año, con su CAPEX
//                 (financiado por el modelo de flujos) y su nueva capacidad.
//
// La demanda prevista (regla editable srv_cantidad_mensual_proy) se distingue
// siempre de la demanda realmente atendible (cantidadReal).
// ============================================================================

import { RecursoRow, ServicioRow, EscenarioCapacidad, CapacidadServicio, RecursoCalculado } from '../types';

export interface EntradaCapacidad {
  recursos: RecursoRow[];
  servicios: ServicioRow[];
  escenario: EscenarioCapacidad;
  horizonteAnios: number;
}

export interface SalidaCapacidad {
  porServicio: Record<string, Record<number, CapacidadServicio>>;
  porRecurso: RecursoCalculado[];
  /** CAPEX de ampliaciones por año (kUSD) — solo escenario B. */
  capexPorAnio: Record<number, number>;
  /** Ampliaciones como activos depreciables (id, año, costo, vida) — escenario B. */
  ampliaciones: { id: string; concepto: string; anioDisponible: number; costoKUSD: number; vidaUtilAnios: number }[];
  /** (servicioId, año) con demanda > capacidad. */
  excedentes: { servicioId: string; servicio: string; anios: number[] }[];
  issues: string[];
}

const MINUTOS_HORA = 60;

export interface CapacidadAnio {
  porServicio: Record<string, CapacidadServicio>;
  recursos: { id: string; nombre: string; minutosDisponibles: number; minutosDemandados: number; utilizacion: number }[];
}

/** Capacidad y limitación de UN año. demandaMensual(s) es la demanda prevista
 *  calculada por la regla editable correspondiente. */
export function capacidadAnio(
  recursos: RecursoRow[],
  servicios: ServicioRow[],
  escenario: EscenarioCapacidad,
  t: number,
  demandaMensual: (s: ServicioRow) => number
): CapacidadAnio {
  const idsRecursos = new Set(recursos.map((r) => r.id));
  const disponibles = new Map<string, number>();
  for (const r of recursos) disponibles.set(r.id, capacidadMensualRecurso(r, t, escenario));

  const demandadas = new Map<string, number>();
  for (const s of servicios) {
    const dem = Math.max(0, demandaMensual(s));
    const dur = Math.max(0, s.duracionMinutos);
    for (const rid of s.recursoIds ?? []) {
      demandadas.set(rid, (demandadas.get(rid) ?? 0) + dem * dur);
    }
  }

  const escala = new Map<string, number>();
  const recursosSalida: CapacidadAnio['recursos'] = [];
  for (const r of recursos) {
    const disp = disponibles.get(r.id)!;
    const dem = demandadas.get(r.id) ?? 0;
    escala.set(r.id, dem > disp && dem > 0 ? disp / dem : 1);
    recursosSalida.push({
      id: r.id,
      nombre: r.nombre,
      minutosDisponibles: disp,
      minutosDemandados: dem,
      utilizacion: disp > 0 ? dem / disp : 0,
    });
  }

  const porServicio: Record<string, CapacidadServicio> = {};
  for (const s of servicios) {
    const demanda = Math.max(0, demandaMensual(s));
    const dur = Math.max(0, s.duracionMinutos);
    let capacidadTeorica = Infinity;
    let factor = 1;
    const usados = (s.recursoIds ?? []).filter((rid) => idsRecursos.has(rid));
    for (const rid of usados) {
      factor = Math.min(factor, escala.get(rid)!);
      if (dur > 0) capacidadTeorica = Math.min(capacidadTeorica, disponibles.get(rid)! / dur);
    }
    if (Number.isFinite(s.capacidadMaxMensual) && s.capacidadMaxMensual > 0) {
      capacidadTeorica = Math.min(capacidadTeorica, s.capacidadMaxMensual);
    }
    if (!Number.isFinite(capacidadTeorica)) {
      capacidadTeorica = Number.isFinite(s.capacidadMaxMensual) && s.capacidadMaxMensual > 0 ? s.capacidadMaxMensual : Infinity;
    }
    const cantidadReal = Math.min(demanda * factor, Number.isFinite(capacidadTeorica) ? capacidadTeorica : Infinity);
    porServicio[s.id] = {
      demandaMensual: demanda,
      capacidadMensual: Number.isFinite(capacidadTeorica) ? capacidadTeorica : demanda,
      cantidadRealMensual: cantidadReal,
      utilizacion: Number.isFinite(capacidadTeorica) && capacidadTeorica > 0 ? demanda / capacidadTeorica : 0,
    };
  }
  return { porServicio, recursos: recursosSalida };
}

export function capacidadMensualRecurso(r: RecursoRow, t: number, escenario: EscenarioCapacidad): number {
  let cantidad = t >= Math.max(0, r.anioDisponible) ? r.cantidad : 0;
  if (escenario === 'B_ampliacion') {
    for (const e of r.expansiones ?? []) {
      if (t >= Math.max(1, Math.trunc(e.anio))) cantidad += e.cantidad;
    }
  }
  const horasAnio = cantidad * r.horasDia * r.diasAnio * (1 - Math.min(1, Math.max(0, r.pctMantenimiento)));
  return (horasAnio * MINUTOS_HORA) / 12; // minutos-mes disponibles
}

/** CAPEX y activos de las ampliaciones (solo escenario B). */
export function ampliacionesActivas(
  recursos: RecursoRow[],
  escenario: EscenarioCapacidad,
  horizonteAnios: number
): {
  capexPorAnio: Record<number, number>;
  ampliaciones: { id: string; concepto: string; anioDisponible: number; costoKUSD: number; vidaUtilAnios: number }[];
} {
  const capexPorAnio: Record<number, number> = {};
  const ampliaciones: { id: string; concepto: string; anioDisponible: number; costoKUSD: number; vidaUtilAnios: number }[] = [];
  for (let t = 0; t <= horizonteAnios; t++) capexPorAnio[t] = 0;
  if (escenario !== 'B_ampliacion') return { capexPorAnio, ampliaciones };
  for (const r of recursos) {
    for (const e of r.expansiones ?? []) {
      const anio = Math.max(1, Math.trunc(e.anio));
      if (anio > horizonteAnios) continue;
      capexPorAnio[anio] = (capexPorAnio[anio] ?? 0) + e.costoKUSD;
      ampliaciones.push({
        id: `${r.id}-amp-${e.id}`,
        concepto: `Ampliación de ${r.nombre} (+${e.cantidad} uds., año ${anio})`,
        anioDisponible: anio,
        costoKUSD: e.costoKUSD,
        vidaUtilAnios: e.vidaUtilAnios,
      });
    }
  }
  return { capexPorAnio, ampliaciones };
}

export function calcularCapacidad(
  entrada: EntradaCapacidad,
  demandaMensual: (s: ServicioRow, t: number) => number
): SalidaCapacidad {
  const { recursos, servicios, escenario, horizonteAnios } = entrada;
  const porServicio: Record<string, Record<number, CapacidadServicio>> = {};
  const { capexPorAnio, ampliaciones } = ampliacionesActivas(recursos, escenario, horizonteAnios);
  const issues: string[] = [];

  const idsRecursos = new Set(recursos.map((r) => r.id));
  for (const s of servicios) {
    for (const rid of s.recursoIds ?? []) {
      if (!idsRecursos.has(rid)) {
        issues.push(
          `El servicio «${s.nombre}» utiliza el recurso «${rid}» que no está definido en la tabla de recursos operativos: su capacidad no queda limitada por ese recurso.`
        );
      }
    }
  }

  const porRecurso: RecursoCalculado[] = recursos.map((r) => ({
    id: r.id,
    nombre: r.nombre,
    horasDisponibles: {},
    horasDemandadas: {},
    utilizacion: {},
  }));

  for (let t = 0; t <= horizonteAnios; t++) {
    const res = capacidadAnio(recursos, servicios, escenario, t, (s) => demandaMensual(s, t));
    recursos.forEach((r, i) => {
      const fila = res.recursos.find((x) => x.id === r.id)!;
      porRecurso[i].horasDisponibles[t] = fila.minutosDisponibles / MINUTOS_HORA;
      porRecurso[i].horasDemandadas[t] = fila.minutosDemandados / MINUTOS_HORA;
      porRecurso[i].utilizacion[t] = fila.utilizacion;
    });
    for (const s of servicios) porServicio[s.id] = { ...(porServicio[s.id] ?? {}), [t]: res.porServicio[s.id] };
  }

  const excedentes: SalidaCapacidad['excedentes'] = [];
  for (const s of servicios) {
    const anios: number[] = [];
    for (let t = 1; t <= horizonteAnios; t++) {
      const c = porServicio[s.id]?.[t];
      if (c && c.cantidadRealMensual < c.demandaMensual - 1e-9) anios.push(t);
    }
    if (anios.length > 0) excedentes.push({ servicioId: s.id, servicio: s.nombre, anios });
  }

  return { porServicio, porRecurso, capexPorAnio, ampliaciones, excedentes, issues };
}
