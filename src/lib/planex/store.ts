'use client';

// ============================================================================
// Almacén de estado PLANEX (zustand). Toda mutación pasa por aquí y toca el
// modelo de datos único; el motor recalcula en los componentes con useMemo.
// Esquema 2.0.0: recursos operativos, calendario de deuda, escenario de
// capacidad y análisis con trazabilidad.
// ============================================================================

import { create } from 'zustand';
import { PlanexProject, AportacionRow, ConsumoRow, InversionRow, PersonalRow, ServicioRow, VehiculoRow, CronogramaRow, RecursoRow, ExpansionRecurso, DeudaConfig, EscenarioCapacidad, Parametro, Regla } from './types';
import { crearProyectoClinica } from './templates/clinica';
import { crearProyectoDefault } from './templates/default';
import { crearProyectoCentro } from './templates/centro';
import { normalizarSerie, nuevoId, ahoraISO } from './model/factory';
import { guardarActual, guardarEnBiblioteca, guardarTema, cargarTema } from './io/persistence';

export type TablaKey = 'aportaciones' | 'consumos' | 'servicios' | 'personal' | 'cronograma';

function clonar<T>(x: T): T {
  return JSON.parse(JSON.stringify(x));
}

interface EstadoPlanex {
  proyecto: PlanexProject;
  sucio: boolean;
  guardadoEn: string | null;
  seccion: string;
  objetivoAlerta: string | null;
  /** Aplica un cambio inmutable al proyecto activo. */
  actualizar: (mut: (p: PlanexProject) => void) => void;
  abrirPlantilla: (tipo: 'clinica' | 'default' | 'centro') => void;
  proyectoNuevo: () => void;
  reemplazarProyecto: (p: PlanexProject) => void;
  /** Sustituye el proyecto (p. ej. carga remota o realtime) SIN tocar la
   *  bandera de «sucio» ni la sección activa: se usa para reflejar datos
   *  sincronizados por Supabase sin interrumpir la edición en curso. */
  fijarProyecto: (p: PlanexProject) => void;
  duplicarProyecto: () => void;
  guardar: () => void;
  setSeccion: (s: string) => void;
  setObjetivoAlerta: (id: string | null) => void;
  // ---- mutaciones tipadas
  setParam: (id: string, valor: number) => void;
  restaurarParametros: () => void;
  setRegla: (id: string, patch: Partial<Regla>) => void;
  restaurarRegla: (id: string) => void;
  restaurarReglas: () => void;
  setHorizonte: (n: number) => void;
  addAportacion: () => void;
  addServicio: () => void;
  addConsumo: () => void;
  addInversion: () => void;
  addVehiculo: () => void;
  addPersonal: () => void;
  addCronograma: () => void;
  updAportacion: (id: string, patch: Partial<AportacionRow>) => void;
  updAportacionMonto: (id: string, anio: number, valor: number) => void;
  updServicio: (id: string, patch: Partial<ServicioRow>) => void;
  toggleRecursoServicio: (id: string, recursoId: string) => void;
  updConsumo: (id: string, patch: Partial<ConsumoRow>) => void;
  updInversion: (id: string, patch: Partial<InversionRow>) => void;
  updVehiculo: (id: string, patch: Partial<VehiculoRow>) => void;
  updPersonal: (id: string, patch: Partial<PersonalRow>) => void;
  updCronograma: (id: string, patch: Partial<CronogramaRow>) => void;
  delFila: (tabla: 'aportaciones' | 'consumos' | 'servicios' | 'personal' | 'cronograma' | 'inversion' | 'vehiculos' | 'recursos' | 'expansiones', id: string) => void;
  moverFila: (tabla: 'servicios' | 'personal' | 'inversion' | 'cronograma' | 'recursos', id: string, dir: -1 | 1) => void;
  setOtrosIngresos: (anioIdx: number, valor: number) => void;
  // Recursos operativos (misión §7)
  addRecurso: () => void;
  updRecurso: (id: string, patch: Partial<RecursoRow>) => void;
  addExpansion: (recursoId: string) => void;
  updExpansion: (recursoId: string, expId: string, patch: Partial<ExpansionRecurso>) => void;
  // Calendario de deuda y escenario de capacidad (misión §6, §7.3)
  updDeuda: (patch: Partial<DeudaConfig>) => void;
  setEscenarioCapacidad: (e: EscenarioCapacidad) => void;
  // Análisis con trazabilidad (misión §12.13)
  guardarAnalisis: (clave: string, texto: string, huella: string, autor?: string) => void;
  regenerarAnalisis: (clave: string) => void;
  guardarTema: (tema: 'dark' | 'light') => void;
  tema: 'dark' | 'light';
}

const inicial: PlanexProject =
  typeof window !== 'undefined'
    ? (() => {
        return crearProyectoClinica();
      })()
    : crearProyectoClinica();

export const usePlanex = create<EstadoPlanex>((set, get) => ({
  proyecto: inicial,
  sucio: false,
  guardadoEn: null,
  seccion: 'inicio',
  objetivoAlerta: null,
  tema: 'light',

  actualizar: (mut) =>
    set((st) => {
      const p = clonar(st.proyecto);
      mut(p);
      p.actualizado = ahoraISO();
      return { proyecto: p, sucio: true };
    }),

  abrirPlantilla: (tipo) =>
    set(() => ({
      proyecto: tipo === 'clinica' ? crearProyectoClinica() : tipo === 'centro' ? crearProyectoCentro() : crearProyectoDefault(),
      sucio: false,
      guardadoEn: null,
      seccion: 'general',
    })),

  proyectoNuevo: () =>
    set(() => {
      const p = crearProyectoDefault();
      p.planex.plantillaOrigen = 'nuevo';
      p.nombre = 'Plan de negocios nuevo';
      return { proyecto: p, sucio: false, guardadoEn: null, seccion: 'general' };
    }),

  reemplazarProyecto: (p) => set({ proyecto: p, sucio: false, guardadoEn: null, seccion: 'general' }),

  fijarProyecto: (p) => set({ proyecto: p }),

  duplicarProyecto: () =>
    set((st) => {
      const p = clonar(st.proyecto);
      p.id = nuevoId();
      p.nombre = `${p.nombre} — copia`;
      p.creado = ahoraISO();
      return { proyecto: p, sucio: true };
    }),

  guardar: () =>
    set((st) => {
      guardarActual(st.proyecto);
      guardarEnBiblioteca(st.proyecto);
      return { sucio: false, guardadoEn: new Date().toISOString() };
    }),

  setSeccion: (s) => set({ seccion: s }),
  setObjetivoAlerta: (id) => set({ objetivoAlerta: id }),

  setParam: (id, valor) =>
    get().actualizar((p) => {
      const x = p.parametros.find((q) => q.id === id);
      if (x && Number.isFinite(valor)) x.valor = valor;
    }),

  restaurarParametros: () =>
    get().actualizar((p) => {
      const originales = crearProyectoClinica().parametros;
      for (const o of originales) {
        const x = p.parametros.find((q) => q.id === o.id);
        if (x) {
          x.valor = o.valor;
          x.fuente = o.fuente;
          x.fechaRef = o.fechaRef;
        }
      }
    }),

  setRegla: (id, patch) =>
    get().actualizar((p) => {
      const r = p.reglas.find((x) => x.id === id);
      if (!r) return;
      if (patch.expresion !== undefined && patch.expresion !== r.expresion) {
        r.expresionAnterior = r.expresion;
        r.modificada = true;
      }
      Object.assign(r, patch);
    }),

  restaurarRegla: (id) =>
    get().actualizar((p) => {
      const r = p.reglas.find((x) => x.id === id);
      if (r) {
        r.expresionAnterior = r.expresion;
        r.expresion = r.expresionDefault;
        r.modificada = false;
      }
    }),

  restaurarReglas: () =>
    get().actualizar((p) => {
      for (const r of p.reglas) {
        r.expresion = r.expresionDefault;
        r.modificada = false;
        r.expresionAnterior = undefined;
        r.habilitada = true;
      }
    }),

  setHorizonte: (n) =>
    set((st) => {
      const p = clonar(st.proyecto);
      const h = Math.max(1, Math.min(30, Math.trunc(n) || 10));
      p.ajustes.horizonteAnios = h;
      p.financiero.otrosIngresos = normalizarSerie(p.financiero.otrosIngresos, h);
      return { proyecto: p, sucio: true };
    }),

  addAportacion: () =>
    get().actualizar((p) => {
      p.aportaciones.push({ id: nuevoId(), socio: 'nacional', tipo: 'efectivo', montos: [0, 0, 0], referenciaDocumental: '' });
    }),
  addServicio: () =>
    get().actualizar((p) => {
      p.servicios.push({ id: nuevoId(), nombre: 'Servicio nuevo', precioBase: 0, cantidadBaseMensual: 0, anioInicioDemanda: 1, capacidadMaxMensual: 0, costoVariableUnitario: 0, duracionMinutos: 30, recursoIds: [], fuente: '' });
    }),
  addConsumo: () =>
    get().actualizar((p) => {
      p.consumos.push({ id: nuevoId(), concepto: '', unidad: '', cantidad: 0, periodo: 'Operación', observacion: '' });
    }),
  addInversion: () =>
    get().actualizar((p) => {
      p.financiero.inversion.push({ id: nuevoId(), concepto: '', categoria: 'inversion_fija', moneda: 'USD', monto: 0, vidaUtilAnios: 10, anioDisponible: 1, valorResidualPct: 0, metodoDepreciacion: 'lineal', observacion: '' });
    }),
  addVehiculo: () =>
    get().actualizar((p) => {
      p.financiero.vehiculos.push({ id: nuevoId(), tipo: '', cantidad: 1, montoKUSD: 0 });
    }),
  addPersonal: () =>
    get().actualizar((p) => {
      p.personal.push({ id: nuevoId(), etapa: 'operacion', grupo: 'cubano_otro', cantidad: 1, salarioPromedioAnualCUP: 0 });
    }),
  addCronograma: () =>
    get().actualizar((p) => {
      p.cronograma.push({ id: nuevoId(), etapa: '', inicio: '', fin: '', observacion: '' });
    }),

  updAportacion: (id, patch) =>
    get().actualizar((p) => {
      const x = p.aportaciones.find((q) => q.id === id);
      if (x) Object.assign(x, patch);
    }),
  updAportacionMonto: (id, anio, valor) =>
    get().actualizar((p) => {
      const x = p.aportaciones.find((q) => q.id === id);
      if (x && Number.isFinite(valor)) x.montos[anio] = valor;
    }),
  updServicio: (id, patch) =>
    get().actualizar((p) => {
      const x = p.servicios.find((q) => q.id === id);
      if (x) Object.assign(x, patch);
    }),
  updConsumo: (id, patch) =>
    get().actualizar((p) => {
      const x = p.consumos.find((q) => q.id === id);
      if (x) Object.assign(x, patch);
    }),
  updInversion: (id, patch) =>
    get().actualizar((p) => {
      const x = p.financiero.inversion.find((q) => q.id === id);
      if (x) Object.assign(x, patch);
    }),
  updVehiculo: (id, patch) =>
    get().actualizar((p) => {
      const x = p.financiero.vehiculos.find((q) => q.id === id);
      if (x) Object.assign(x, patch);
    }),
  updPersonal: (id, patch) =>
    get().actualizar((p) => {
      const x = p.personal.find((q) => q.id === id);
      if (x) Object.assign(x, patch);
    }),
  updCronograma: (id, patch) =>
    get().actualizar((p) => {
      const x = p.cronograma.find((q) => q.id === id);
      if (x) Object.assign(x, patch);
    }),

  delFila: (tabla, id) =>
    get().actualizar((p) => {
      if (tabla === 'expansiones') {
        for (const r of p.recursos) {
          const i = r.expansiones.findIndex((e) => e.id === id);
          if (i >= 0) r.expansiones.splice(i, 1);
        }
        return;
      }
      const lista =
        tabla === 'inversion' || tabla === 'vehiculos'
          ? tabla === 'inversion'
            ? p.financiero.inversion
            : p.financiero.vehiculos
          : (p[tabla as 'aportaciones' | 'consumos' | 'servicios' | 'personal' | 'cronograma' | 'recursos'] as unknown[]);
      const i = lista.findIndex((x) => (x as { id: string }).id === id);
      if (i >= 0) lista.splice(i, 1);
      // Al eliminar un recurso, los servicios dejan de usarlo.
      if (tabla === 'recursos') {
        for (const s of p.servicios) {
          const j = s.recursoIds.indexOf(id);
          if (j >= 0) s.recursoIds.splice(j, 1);
        }
      }
    }),

  moverFila: (tabla, id, dir) =>
    get().actualizar((p) => {
      const lista =
        tabla === 'inversion' ? p.financiero.inversion : (p[tabla as 'servicios' | 'personal' | 'cronograma' | 'recursos'] as unknown as { id: string }[]);
      const i = lista.findIndex((x) => x.id === id);
      const j = i + dir;
      if (i >= 0 && j >= 0 && j < lista.length) {
        const [fila] = lista.splice(i, 1);
        lista.splice(j, 0, fila);
      }
    }),

  setOtrosIngresos: (anioIdx, valor) =>
    get().actualizar((p) => {
      if (Number.isFinite(valor)) p.financiero.otrosIngresos[anioIdx] = valor;
    }),

  // ---------------- Recursos operativos (misión §7) ----------------
  addRecurso: () =>
    get().actualizar((p) => {
      p.recursos.push({
        id: nuevoId(),
        nombre: 'Recurso operativo nuevo',
        tipo: 'gabinete',
        cantidad: 1,
        horasDia: 8,
        diasAnio: 288,
        pctMantenimiento: 0.05,
        anioDisponible: 1,
        expansiones: [],
        observacion: '',
      });
    }),
  updRecurso: (id, patch) =>
    get().actualizar((p) => {
      const x = p.recursos.find((q) => q.id === id);
      if (x) Object.assign(x, patch);
    }),
  addExpansion: (recursoId) =>
    get().actualizar((p) => {
      const x = p.recursos.find((q) => q.id === recursoId);
      if (x) x.expansiones.push({ id: nuevoId(), anio: 2, cantidad: 1, costoKUSD: 0, vidaUtilAnios: 10, observacion: '' });
    }),
  updExpansion: (recursoId, expId, patch) =>
    get().actualizar((p) => {
      const x = p.recursos.find((q) => q.id === recursoId)?.expansiones.find((e) => e.id === expId);
      if (x) Object.assign(x, patch);
    }),
  toggleRecursoServicio: (id, recursoId) =>
    get().actualizar((p) => {
      const x = p.servicios.find((q) => q.id === id);
      if (!x) return;
      const i = x.recursoIds.indexOf(recursoId);
      if (i >= 0) x.recursoIds.splice(i, 1);
      else x.recursoIds.push(recursoId);
    }),

  // ------------- Deuda y escenario de capacidad (§6, §7.3) -------------
  updDeuda: (patch) =>
    get().actualizar((p) => {
      Object.assign(p.financiero.deuda, patch);
    }),
  setEscenarioCapacidad: (e) =>
    get().actualizar((p) => {
      p.tecnico.escenarioCapacidad = e;
    }),

  // ---------------- Análisis con trazabilidad (§12.13) ----------------
  guardarAnalisis: (clave, texto, huella, autor) =>
    get().actualizar((p) => {
      p.analisis[clave] = {
        texto,
        huellaOrigen: huella,
        actualizadoPor: autor,
        actualizadoEn: ahoraISO(),
      };
    }),
  regenerarAnalisis: (clave) =>
    get().actualizar((p) => {
      delete p.analisis[clave];
    }),

  guardarTema: (tema) => {
    guardarTema(tema);
    set({ tema });
  },
}));

export function temaInicial(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'light';
  return cargarTema() ?? 'light';
}
