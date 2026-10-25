// ============================================================================
// Fábrica de proyectos: estructura base completa y validación de esquema.
// Esquema 2.0.0: recursos operativos, calendario de deuda, análisis con
// trazabilidad, activos con disponibilidad/residual y escenario de capacidad.
// ============================================================================

import {
  PlanexProject,
  Parametro,
  Regla,
  RecursoRow,
  InversionRow,
  ServicioRow,
  DeudaConfig,
  EscenarioCapacidad,
  SCHEMA_VERSION,
} from '../types';
import { parametrosPorDefecto, reglasPorDefecto } from '../templates/reglas';

export function nuevoId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function ahoraISO(): string {
  return new Date().toISOString();
}

export const DEUDA_BASE: DeudaConfig = {
  habilitada: false,
  anioDesembolso: 0,
  tipoGracia: 'principal',
  metodo: 'capital_constante',
  fuente: 'Definir el contrato o compromiso de financiamiento (supuesto pendiente).',
};

/** Proyecto base con estructura metodológica completa y motor preconfigurado. */
export function crearProyectoBase(origen: 'clinica' | 'default' | 'centro' | 'nuevo'): PlanexProject {
  const ahora = ahoraISO();
  return {
    planex: {
      schemaVersion: SCHEMA_VERSION,
      app: 'PLANEX Cuba',
      generado: ahora,
      plantillaOrigen: origen,
    },
    id: nuevoId(),
    nombre: 'Plan de negocios sin título',
    creado: ahora,
    actualizado: ahora,
    ajustes: { horizonteAnios: 10, monedaPresentacion: 'USD' },
    general: {
      elaboradoPor: '',
      cargo: '',
      firmaIdentificacion: '',
      fecha: '',
      declaracionResponsabilidad: false,
    },
    titulo: { nombreProyecto: '', denominacionPropuesta: '' },
    resumen: { introduccion: '', notas: '' },
    negocio: {
      modalidad: '',
      objetoSocial: '',
      plazoVigencia: '',
      fundamentacion: '',
      objetivosInversion: '',
      relacionPNDES: '',
      relacionEDT: '',
      bienesServicios: '',
      mercadoInterno: '',
      mercadoExterno: '',
      reglaDistribucion: '',
    },
    inversionistaExtranjero: {
      nombre: '',
      domicilio: '',
      identificacionFiscal: '',
      experiencia: '',
      vinculacionCuba: '',
    },
    inversionistaNacional: {
      nombre: '',
      domicilio: '',
      identificacionFiscal: '',
      experiencia: '',
      vinculacionCuba: '',
    },
    aportaciones: [],
    tecnico: {
      caracterizacion: '',
      capacidadInstalada: '',
      plazoNiveles: '',
      tecnologiasActuales: '',
      tecnologiasNuevas: '',
      localizacion: '',
      infraestructura: '',
      terrenosInstalaciones: '',
      necesidadesConstruccion: '',
      escenarioCapacidad: 'A_constante',
    },
    consumos: [],
    recursos: [],
    servicios: [],
    financiero: { inversion: [], vehiculos: [], otrosIngresos: [], deuda: { ...DEUDA_BASE } },
    mercado: {
      caracterizacion: '',
      requisitosRegulatorios: '',
      materiasPrimas: '',
      fuentesSuministro: '',
      consumoEstimado: '',
      demandaAparente: '',
      demandaSolvente: '',
      metodoEstimacion: '',
      fuentesConsulta: '',
      ventasExportacion: '',
      ventasDivisas: '',
      ventasMonedaNacional: '',
    },
    fuerza: { entidadContratante: '' },
    personal: [],
    cronograma: [],
    conclusiones: { texto: '' },
    analisis: {},
    parametros: parametrosPorDefecto({ creditoKUSD: 0, capitalTrabajoKUSD: 0 }),
    reglas: reglasPorDefecto(),
  };
}

/** Ajusta la longitud de la serie de otros ingresos al horizonte. */
export function normalizarSerie(series: number[] | undefined, n: number): number[] {
  const salida: number[] = [];
  for (let i = 0; i < n; i++) {
    const v = series?.[i];
    salida.push(typeof v === 'number' && Number.isFinite(v) ? v : 0);
  }
  return salida;
}

function numero(x: unknown, def = 0): number {
  const n = Number(x);
  return Number.isFinite(n) ? n : def;
}

function normalizarRecursos(x: unknown): RecursoRow[] {
  if (!Array.isArray(x)) return [];
  return x.map((r, i) => {
    const rr = (r ?? {}) as Record<string, unknown>;
    return {
      id: String(rr.id ?? `re-${i}`),
      nombre: String(rr.nombre ?? `Recurso ${i + 1}`),
      tipo: (['gabinete', 'sillon', 'equipo', 'profesional', 'local', 'otro'].includes(String(rr.tipo))
        ? rr.tipo
        : 'otro') as RecursoRow['tipo'],
      cantidad: numero(rr.cantidad, 1),
      horasDia: numero(rr.horasDia, 8),
      diasAnio: numero(rr.diasAnio, 288),
      pctMantenimiento: Math.min(1, Math.max(0, numero(rr.pctMantenimiento, 0))),
      anioDisponible: numero(rr.anioDisponible, 1),
      expansiones: Array.isArray(rr.expansiones)
        ? rr.expansiones.map((e, j) => {
            const ee = (e ?? {}) as Record<string, unknown>;
            return {
              id: String(ee.id ?? `ex-${i}-${j}`),
              anio: Math.max(1, numero(ee.anio, 1)),
              cantidad: numero(ee.cantidad, 0),
              costoKUSD: numero(ee.costoKUSD, 0),
              vidaUtilAnios: numero(ee.vidaUtilAnios, 10),
              observacion: String(ee.observacion ?? ''),
            };
          })
        : [],
      observacion: String(rr.observacion ?? ''),
    };
  });
}

function normalizarInversion(x: unknown): InversionRow[] {
  if (!Array.isArray(x)) return [];
  return x.map((r, i) => {
    const rr = (r ?? {}) as Record<string, unknown>;
    const categoria = (['gastos_previos', 'inversion_fija', 'inducida'].includes(String(rr.categoria))
      ? rr.categoria
      : 'inversion_fija') as InversionRow['categoria'];
    return {
      id: String(rr.id ?? `iv-${i}`),
      concepto: String(rr.concepto ?? ''),
      categoria,
      moneda: rr.moneda === 'CUP' ? 'CUP' : 'USD',
      monto: numero(rr.monto, 0),
      vidaUtilAnios: Math.max(0, numero(rr.vidaUtilAnios, 0)),
      anioDisponible: Math.max(0, numero(rr.anioDisponible, 1)),
      valorResidualPct: Math.min(1, Math.max(0, numero(rr.valorResidualPct, 0))),
      metodoDepreciacion: rr.metodoDepreciacion === 'ninguno' ? 'ninguno' : 'lineal',
      observacion: String(rr.observacion ?? ''),
    };
  });
}

function normalizarServicios(x: unknown, recursos: RecursoRow[]): ServicioRow[] {
  if (!Array.isArray(x)) return [];
  const idsValidos = new Set(recursos.map((r) => r.id));
  return x.map((s, i) => {
    const ss = (s ?? {}) as Record<string, unknown>;
    const recursoIds = Array.isArray(ss.recursoIds)
      ? ss.recursoIds.map((r) => String(r)).filter((r) => idsValidos.has(r))
      : [];
    return {
      id: String(ss.id ?? `sv-${i}`),
      nombre: String(ss.nombre ?? `Servicio ${i + 1}`),
      precioBase: numero(ss.precioBase, 0),
      cantidadBaseMensual: numero(ss.cantidadBaseMensual, 0),
      anioInicioDemanda: Math.max(1, numero(ss.anioInicioDemanda, 1)),
      capacidadMaxMensual: numero(ss.capacidadMaxMensual, 0),
      costoVariableUnitario: numero(ss.costoVariableUnitario, 0),
      duracionMinutos: Math.max(0, numero(ss.duracionMinutos, 0)),
      recursoIds,
      fuente: String(ss.fuente ?? ''),
    };
  });
}

/** Normaliza un proyecto importado (rellena campos faltantes sin sustituir datos). */
export function normalizarProyecto(entrada: unknown): PlanexProject {
  const base = crearProyectoBase('nuevo');
  const o = (entrada ?? {}) as Record<string, unknown>;
  const p: PlanexProject = { ...base };

  // Metadatos
  const meta = (o.planex ?? {}) as Record<string, unknown>;
  const origenRaw = String(meta.plantillaOrigen ?? 'nuevo');
  p.planex = {
    schemaVersion: String(meta.schemaVersion ?? SCHEMA_VERSION),
    app: 'PLANEX Cuba',
    generado: String(meta.generado ?? ahoraISO()),
    plantillaOrigen: origenRaw === 'clinica' || origenRaw === 'default' || origenRaw === 'centro' ? origenRaw : 'nuevo',
  };
  p.id = String(o.id ?? nuevoId());
  p.nombre = String(o.nombre ?? 'Plan de negocios sin título');
  p.creado = String(o.creado ?? ahoraISO());
  p.actualizado = String(o.actualizado ?? ahoraISO());
  const aj = (o.ajustes ?? {}) as Record<string, unknown>;
  p.ajustes = {
    horizonteAnios: Math.max(1, Math.min(30, Math.trunc(Number(aj.horizonteAnios ?? 10)) || 10)),
    // Retrocompatible: los planes previos a DOC-001 se interpretan como USD.
    monedaPresentacion: aj.monedaPresentacion === 'CUP' ? 'CUP' : 'USD',
  };

  // Secciones simples (merge superficial campo a campo)
  const seccionesSimples = [
    'general',
    'titulo',
    'resumen',
    'negocio',
    'inversionistaExtranjero',
    'inversionistaNacional',
    'tecnico',
    'mercado',
    'fuerza',
    'conclusiones',
  ] as const;
  for (const s of seccionesSimples) {
    const dato = (o[s] ?? {}) as Record<string, unknown>;
    const destino = p[s] as unknown as Record<string, unknown>;
    for (const clave of Object.keys(destino)) {
      if (dato[clave] !== undefined && dato[clave] !== null) {
        destino[clave] = dato[clave];
      }
    }
  }
  // Escenario de capacidad: valor enumerado con respaldo.
  const escenario = (o.tecnico as Record<string, unknown> | undefined)?.escenarioCapacidad;
  p.tecnico.escenarioCapacidad = (
    escenario === 'B_ampliacion' ? 'B_ampliacion' : 'A_constante'
  ) as EscenarioCapacidad;

  // Tablas
  const filas = (x: unknown): Record<string, unknown>[] => (Array.isArray(x) ? (x as Record<string, unknown>[]) : []);
  p.aportaciones = filas(o.aportaciones).map((a, i) => ({
    id: String(a.id ?? `ap-${i}`),
    socio: a.socio === 'nacional' ? 'nacional' : 'extranjero',
    tipo: (['efectivo', 'activos_circulantes', 'activos_fijos_tangibles', 'derechos_reales', 'intangibles', 'otros'].includes(String(a.tipo))
      ? a.tipo
      : 'efectivo') as PlanexProject['aportaciones'][number]['tipo'],
    montos: Array.isArray(a.montos) ? (a.montos as number[]).map((m) => (Number.isFinite(m) ? m : 0)) : [0, 0, 0],
    referenciaDocumental: String(a.referenciaDocumental ?? ''),
  }));

  // Recursos primero: los servicios solo conservan referencias existentes.
  p.recursos = normalizarRecursos(o.recursos);
  p.servicios = normalizarServicios(o.servicios, p.recursos);

  p.consumos = filas(o.consumos).map((c, i) => ({
    id: String(c.id ?? `cn-${i}`),
    concepto: String(c.concepto ?? ''),
    unidad: String(c.unidad ?? ''),
    cantidad: Number(c.cantidad ?? 0) || 0,
    periodo: String(c.periodo ?? ''),
    observacion: String(c.observacion ?? ''),
  }));
  const fin = (o.financiero ?? {}) as Record<string, unknown>;
  p.financiero = {
    inversion: normalizarInversion(fin.inversion),
    vehiculos: filas(fin.vehiculos).map((r, i) => ({
      id: String(r.id ?? `vh-${i}`),
      tipo: String(r.tipo ?? ''),
      cantidad: Number(r.cantidad ?? 0) || 0,
      montoKUSD: Number(r.montoKUSD ?? 0) || 0,
    })),
    otrosIngresos: normalizarSerie(fin.otrosIngresos as number[] | undefined, p.ajustes.horizonteAnios),
    deuda: {
      habilitada: Boolean((fin.deuda as Record<string, unknown> | undefined)?.habilitada),
      anioDesembolso: Math.max(0, numero((fin.deuda as Record<string, unknown> | undefined)?.anioDesembolso, 0)),
      tipoGracia: ((fin.deuda as Record<string, unknown> | undefined)?.tipoGracia === 'total' ? 'total' : 'principal') as DeudaConfig['tipoGracia'],
      metodo: (['capital_constante', 'sistema_frances', 'pago_unico'].includes(
        String((fin.deuda as Record<string, unknown> | undefined)?.metodo)
      )
        ? (fin.deuda as Record<string, unknown>)!.metodo
        : 'capital_constante') as DeudaConfig['metodo'],
      fuente: String((fin.deuda as Record<string, unknown> | undefined)?.fuente ?? DEUDA_BASE.fuente),
    },
  };
  p.personal = filas(o.personal).map((r, i) => ({
    id: String(r.id ?? `pe-${i}`),
    etapa: r.etapa === 'operacion' ? 'operacion' : 'montaje',
    grupo: (['cubano_directivo', 'cubano_otro', 'extranjero_directivo', 'extranjero_otro'].includes(String(r.grupo)) ? r.grupo : 'cubano_otro') as PlanexProject['personal'][number]['grupo'],
    cantidad: Number(r.cantidad ?? 0) || 0,
    salarioPromedioAnualCUP: Number(r.salarioPromedioAnualCUP ?? 0) || 0,
  }));
  p.cronograma = filas(o.cronograma).map((r, i) => ({
    id: String(r.id ?? `cr-${i}`),
    etapa: String(r.etapa ?? ''),
    inicio: String(r.inicio ?? ''),
    fin: String(r.fin ?? ''),
    observacion: String(r.observacion ?? ''),
  }));

  // Análisis con trazabilidad (misión §12.13): se conservan tal cual.
  p.analisis = {};
  if (o.analisis && typeof o.analisis === 'object') {
    for (const [clave, valor] of Object.entries(o.analisis as Record<string, unknown>)) {
      const v = (valor ?? {}) as Record<string, unknown>;
      p.analisis[clave] = {
        texto: v.texto !== undefined ? String(v.texto) : undefined,
        huellaOrigen: v.huellaOrigen !== undefined ? String(v.huellaOrigen) : undefined,
        actualizadoPor: v.actualizadoPor !== undefined ? String(v.actualizadoPor) : undefined,
        actualizadoEn: v.actualizadoEn !== undefined ? String(v.actualizadoEn) : undefined,
      };
    }
  }

  // Parámetros: merge por id (conserva los predeterminados que falten)
  const paramsImport = filas(o.parametros);
  const vistos = new Set<string>();
  p.parametros = base.parametros.map((def: Parametro) => {
    const imp = paramsImport.find((x) => String(x.id) === def.id);
    if (imp) {
      vistos.add(def.id);
      return {
        ...def,
        valor: Number.isFinite(Number(imp.valor)) ? Number(imp.valor) : def.valor,
        fuente: String(imp.fuente ?? def.fuente),
        fechaRef: String(imp.fechaRef ?? def.fechaRef),
        demo: imp.demo === undefined ? def.demo : Boolean(imp.demo),
      };
    }
    return def;
  });
  // Parámetros desconocidos (de otras versiones): se agregan como editable
  for (const imp of paramsImport) {
    if (!vistos.has(String(imp.id))) {
      p.parametros.push({
        id: String(imp.id),
        nombre: String(imp.nombre ?? imp.id),
        descripcion: 'Parámetro importado (no pertenece al conjunto de fábrica).',
        valor: Number(imp.valor ?? 0) || 0,
        unidad: String(imp.unidad ?? ''),
        tipo: 'numero',
        fuente: String(imp.fuente ?? ''),
        fechaRef: String(imp.fechaRef ?? ''),
        editable: true,
        demo: false,
      });
    }
  }

  // Reglas: merge por id (conserva expresiones del usuario; las desconocidas se marcan)
  const reglasImport = filas(o.reglas);
  const reglasVistas = new Set<string>();
  p.reglas = base.reglas.map((def: Regla) => {
    const imp = reglasImport.find((x) => String(x.id) === def.id);
    if (imp) {
      reglasVistas.add(def.id);
      const expresion = String(imp.expresion ?? def.expresion);
      return {
        ...def,
        expresion,
        expresionDefault: def.expresionDefault,
        habilitada: imp.habilitada === undefined ? true : Boolean(imp.habilitada),
        expresionAnterior: imp.expresionAnterior ? String(imp.expresionAnterior) : undefined,
        modificada: expresion !== def.expresionDefault,
      };
    }
    return def;
  });
  // Reglas desconocidas: se agregan deshabilitadas y marcadas (no se aplican
  // en silencio); el usuario puede revisarlas en Configuración de cálculos.
  for (const imp of reglasImport) {
    if (!reglasVistas.has(String(imp.id))) {
      p.reglas.push({
        id: String(imp.id),
        nombre: String(imp.nombre ?? imp.id),
        descripcion: `${String(imp.descripcion ?? '')} [IMPORTADA DESCONOCIDA: revisar antes de habilitar]`,
        expresion: String(imp.expresion ?? ''),
        expresionDefault: String(imp.expresion ?? ''),
        ambito: (['servicio', 'personal', 'proyecto', 'anio'].includes(String(imp.ambito)) ? imp.ambito : 'anio') as Regla['ambito'],
        unidad: String(imp.unidad ?? ''),
        categoria: 'Importadas',
        habilitada: false,
      });
    }
  }

  return p;
}
