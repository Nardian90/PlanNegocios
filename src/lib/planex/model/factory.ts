// ============================================================================
// Fábrica de proyectos: estructura base completa y validación de esquema.
// ============================================================================

import {
  PlanexProject,
  Parametro,
  Regla,
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

/** Proyecto base con estructura metodológica completa y motor preconfigurado. */
export function crearProyectoBase(origen: 'clinica' | 'default' | 'nuevo'): PlanexProject {
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
    ajustes: { horizonteAnios: 10 },
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
    },
    consumos: [],
    servicios: [],
    financiero: { inversion: [], vehiculos: [], otrosIngresos: [] },
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
    parametros: parametrosPorDefecto({ creditoKUSD: 0, capitalTrabajoKUSD: 0 }),
    reglas: reglasPorDefecto(),
  };
}

/** Ajusta la longitud de la serie de otros ingresos al horizonte. */
export function normalizarSerie(series: number[] | undefined, n: number): number[] {
  const salida: number[] = [];
  for (let i = 0; i < n; i++) {
    const v = series?.[i];
    salida.push(Number.isFinite(v) ? v : 0);
  }
  return salida;
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
    plantillaOrigen: origenRaw === 'clinica' || origenRaw === 'default' ? origenRaw : 'nuevo',
  };
  p.id = String(o.id ?? nuevoId());
  p.nombre = String(o.nombre ?? 'Plan de negocios sin título');
  p.creado = String(o.creado ?? ahoraISO());
  p.actualizado = String(o.actualizado ?? ahoraISO());
  const aj = (o.ajustes ?? {}) as Record<string, unknown>;
  p.ajustes = {
    horizonteAnios: Math.max(1, Math.min(30, Math.trunc(Number(aj.horizonteAnios ?? 10)) || 10)),
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

  // Tablas
  const filas = <T>(x: unknown): T[] => (Array.isArray(x) ? (x as T[]) : []);
  p.aportaciones = filas(o.aportaciones).map((a: Record<string, unknown>, i) => ({
    id: String(a.id ?? `ap-${i}`),
    socio: a.socio === 'nacional' ? 'nacional' : 'extranjero',
    tipo: (['efectivo', 'activos_circulantes', 'activos_fijos_tangibles', 'derechos_reales', 'intangibles', 'otros'].includes(String(a.tipo))
      ? a.tipo
      : 'efectivo') as PlanexProject['aportaciones'][number]['tipo'],
    montos: Array.isArray(a.montos) ? (a.montos as number[]).map((m) => (Number.isFinite(m) ? m : 0)) : [0, 0, 0],
    referenciaDocumental: String(a.referenciaDocumental ?? ''),
  }));
  p.servicios = filas(o.servicios).map((s: Record<string, unknown>, i) => ({
    id: String(s.id ?? `sv-${i}`),
    nombre: String(s.nombre ?? `Servicio ${i + 1}`),
    precioBase: Number(s.precioBase ?? 0) || 0,
    cantidadBaseMensual: Number(s.cantidadBaseMensual ?? 0) || 0,
    capacidadMaxMensual: Number(s.capacidadMaxMensual ?? 0) || 0,
    costoVariableUnitario: Number(s.costoVariableUnitario ?? 0) || 0,
    fuente: String(s.fuente ?? ''),
  }));
  p.consumos = filas(o.consumos).map((c: Record<string, unknown>, i) => ({
    id: String(c.id ?? `cn-${i}`),
    concepto: String(c.concepto ?? ''),
    unidad: String(c.unidad ?? ''),
    cantidad: Number(c.cantidad ?? 0) || 0,
    periodo: String(c.periodo ?? ''),
    observacion: String(c.observacion ?? ''),
  }));
  p.financiero = {
    inversion: filas((o.financiero as Record<string, unknown> | undefined)?.inversion).map((r: Record<string, unknown>, i) => ({
      id: String(r.id ?? `iv-${i}`),
      concepto: String(r.concepto ?? ''),
      categoria: (['gastos_previos', 'inversion_fija', 'inducida'].includes(String(r.categoria)) ? r.categoria : 'inversion_fija') as PlanexProject['financiero']['inversion'][number]['categoria'],
      moneda: r.moneda === 'CUP' ? 'CUP' : 'USD',
      monto: Number(r.monto ?? 0) || 0,
      vidaUtilAnios: Number(r.vidaUtilAnios ?? 0) || 0,
      observacion: String(r.observacion ?? ''),
    })),
    vehiculos: filas((o.financiero as Record<string, unknown> | undefined)?.vehiculos).map((r: Record<string, unknown>, i) => ({
      id: String(r.id ?? `vh-${i}`),
      tipo: String(r.tipo ?? ''),
      cantidad: Number(r.cantidad ?? 0) || 0,
      montoKUSD: Number(r.montoKUSD ?? 0) || 0,
    })),
    otrosIngresos: normalizarSerie(((o.financiero as Record<string, unknown> | undefined)?.otrosIngresos) as number[] | undefined, p.ajustes.horizonteAnios),
  };
  p.personal = filas(o.personal).map((r: Record<string, unknown>, i) => ({
    id: String(r.id ?? `pe-${i}`),
    etapa: r.etapa === 'operacion' ? 'operacion' : 'montaje',
    grupo: (['cubano_directivo', 'cubano_otro', 'extranjero_directivo', 'extranjero_otro'].includes(String(r.grupo)) ? r.grupo : 'cubano_otro') as PlanexProject['personal'][number]['grupo'],
    cantidad: Number(r.cantidad ?? 0) || 0,
    salarioPromedioAnualCUP: Number(r.salarioPromedioAnualCUP ?? 0) || 0,
  }));
  p.cronograma = filas(o.cronograma).map((r: Record<string, unknown>, i) => ({
    id: String(r.id ?? `cr-${i}`),
    etapa: String(r.etapa ?? ''),
    inicio: String(r.inicio ?? ''),
    fin: String(r.fin ?? ''),
    observacion: String(r.observacion ?? ''),
  }));

  // Parámetros: merge por id (conserva los predeterminados que falten)
  const paramsImport = filas(o.parametros) as Record<string, unknown>[];
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
  const reglasImport = filas(o.reglas) as Record<string, unknown>[];
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
