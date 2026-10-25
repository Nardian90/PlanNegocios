'use client';

// ============================================================================
// Almacén de estado PLANEX (zustand). Toda mutación pasa por aquí y toca el
// modelo de datos único; el motor recalcula en los componentes con useMemo.
// ============================================================================

import { create } from 'zustand';
import { PlanexProject, AportacionRow, ConsumoRow, InversionRow, PersonalRow, ServicioRow, VehiculoRow, CronogramaRow, Parametro, Regla } from './types';
import { crearProyectoClinica } from './templates/clinica';
import { crearProyectoDefault } from './templates/default';
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
  abrirPlantilla: (tipo: 'clinica' | 'default') => void;
  proyectoNuevo: () => void;
  reemplazarProyecto: (p: PlanexProject) => void;
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
  updConsumo: (id: string, patch: Partial<ConsumoRow>) => void;
  updInversion: (id: string, patch: Partial<InversionRow>) => void;
  updVehiculo: (id: string, patch: Partial<VehiculoRow>) => void;
  updPersonal: (id: string, patch: Partial<PersonalRow>) => void;
  updCronograma: (id: string, patch: Partial<CronogramaRow>) => void;
  delFila: (tabla: 'aportaciones' | 'consumos' | 'servicios' | 'personal' | 'cronograma' | 'inversion' | 'vehiculos', id: string) => void;
  moverFila: (tabla: 'servicios' | 'personal' | 'inversion' | 'cronograma', id: string, dir: -1 | 1) => void;
  setOtrosIngresos: (anioIdx: number, valor: number) => void;
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
      proyecto: tipo === 'clinica' ? crearProyectoClinica() : crearProyectoDefault(),
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
      p.servicios.push({ id: nuevoId(), nombre: 'Servicio nuevo', precioBase: 0, cantidadBaseMensual: 0, capacidadMaxMensual: 0, costoVariableUnitario: 0, fuente: '' });
    }),
  addConsumo: () =>
    get().actualizar((p) => {
      p.consumos.push({ id: nuevoId(), concepto: '', unidad: '', cantidad: 0, periodo: 'Operación', observacion: '' });
    }),
  addInversion: () =>
    get().actualizar((p) => {
      p.financiero.inversion.push({ id: nuevoId(), concepto: '', categoria: 'inversion_fija', moneda: 'USD', monto: 0, vidaUtilAnios: 10, observacion: '' });
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
      const lista =
        tabla === 'inversion' || tabla === 'vehiculos'
          ? tabla === 'inversion'
            ? p.financiero.inversion
            : p.financiero.vehiculos
          : (p[tabla] as unknown[]);
      const i = lista.findIndex((x) => (x as { id: string }).id === id);
      if (i >= 0) lista.splice(i, 1);
    }),

  moverFila: (tabla, id, dir) =>
    get().actualizar((p) => {
      const lista =
        tabla === 'inversion' ? p.financiero.inversion : (p[tabla as 'servicios' | 'personal' | 'cronograma'] as unknown as { id: string }[]);
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

  guardarTema: (tema) => {
    guardarTema(tema);
    set({ tema });
  },
}));

export function temaInicial(): 'dark' | 'light' {
  if (typeof window === 'undefined') return 'light';
  return cargarTema() ?? 'light';
}
