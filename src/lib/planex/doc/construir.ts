// ============================================================================
// PLANEX — Constructor del modelo documental canónico (misión DOC-001 §3).
//
// construidoDocumentoPlanex(proyecto, modelo, moneda) produce la ÚNICA
// representación del documento que consumen el visor de previsualización,
// el exportador PDF y el exportador DOCX.
//
// Reglas que aquí se garantizan:
//   · Las cifras salen SIEMPRE del ComputedModel vigente (motor), nunca de
//     constantes ni de una segunda implementación de cálculo.
//   · Los textos analíticos se generan con el contexto de presentación y se
//     resuelven con la trazabilidad manual/desactualizado (§12.13).
//   · La conversión de moneda se aplica UNA sola vez, desde la moneda de
//     origen (kUSD del motor, CUP de los salarios, moneda de la fila en
//     inversiones), con redondeo solo al formatear (§5.2).
//   · Los porcentajes, cantidades, horas, vidas útiles y períodos NUNCA se
//     convierten; los salarios permanecen en CUP por la metodología 4.9,
//     documentando su equivalente cuando la presentación es USD.
//   · El diagnóstico usa el mismo contexto; los hallazgos derivados de
//     issues del MOTOR conservan la unidad nativa kUSD y se declara en la
//     sección de diagnóstico cuando la presentación es CUP.
// ============================================================================

import {
  PlanexProject,
  ComputedModel,
  MonedaPresentacion,
  ADVERTENCIA_DATOS_FICTICIOS,
  DECLARACION_RESPONSABILIDAD,
  ESTADO_RESULTADOS,
  BENEFICIOS_PAIS,
  ETIQUETAS_APORTACION,
  ETIQUETAS_GRUPO,
  ETIQUETAS_CATEGORIA_INV,
  ETIQUETAS_METODO_AMORT,
  ETIQUETAS_TIPO_GRACIA,
  ETIQUETAS_RECURSO,
} from '../types';
import { valorLinea } from '../engine/engine';
import { generarAnalisis, estadoAnalisis, ClaveAnalisis, PresentacionMonetaria } from '../engine/analisis';
import { diagnosticar } from '../model/controles';
import { fmtK, fmtCUP, fmtPct, fmtAnios, fmtUsd, fechaLarga, mesAnio } from '../format';
import {
  crearContextoMoneda,
  tasaCambioDe,
  monedaPresentacionDe,
  notaConversion,
} from './moneda';
import { DocumentoPlanex, ElementoDoc, SeccionDoc, TablaDoc } from './modelo';

export interface OpcionesDocumento {
  moneda?: MonedaPresentacion;
}

/** Construye el documento canónico completo del plan activo. */
export function construirDocumentoPlanex(
  proyecto: PlanexProject,
  modelo: ComputedModel,
  opciones?: OpcionesDocumento
): DocumentoPlanex {
  const moneda = opciones?.moneda ?? monedaPresentacionDe(proyecto);
  const ctx = crearContextoMoneda(proyecto, moneda);
  const tasa = tasaCambioDe(proyecto);

  // Presentación monetaria para textos del motor (kUSD → moneda de presentación).
  const pres: PresentacionMonetaria = {
    k: (n: number) => ctx.fmtKPres(ctx.kUSDaK(n)),
    corto: ctx.unidadCorta,
    largo: ctx.unidadLarga,
  };
  // Importe del motor (kUSD) formateado en la moneda de presentación.
  const K = pres.k;
  // Precio/costo unitario en USD completos → moneda de presentación (unidades completas).
  const U = (usd: number) => fmtK(moneda === 'CUP' ? usd * tasa.tasa : usd);

  const p = proyecto;
  const m = modelo;
  const N = p.ajustes.horizonteAnios;
  const years = m.years;
  const esDemo = p.planex.plantillaOrigen === 'clinica' || p.planex.plantillaOrigen === 'centro';
  const val = (id: string, t: number) => m.valores[id]?.[t] ?? 0;
  const param = (id: string) => p.parametros.find((x) => x.id === id)?.valor ?? 0;
  const recP = m.indicadores.recuperacionProyecto;
  const recS = m.indicadores.recuperacionSocios;

  // Análisis dinámicos con la moneda de presentación y trazabilidad resuelta.
  const generados = generarAnalisis(p, m, pres);
  const analisis = (clave: ClaveAnalisis, titulo: string): ElementoDoc => {
    const { estado, texto } = estadoAnalisis(p, clave, generados[clave]);
    return { tipo: 'analisis', bloque: { titulo, clave, texto, estado } };
  };

  const secciones: SeccionDoc[] = [];
  const sec = (id: string, titulo: string, elementos: ElementoDoc[], opts?: { enIndice?: boolean; paginaNueva?: boolean }) =>
    secciones.push({
      id,
      titulo,
      enIndice: opts?.enIndice ?? true,
      paginaNueva: opts?.paginaNueva ?? true,
      elementos,
    });
  const campos = (items: [string, string][]): ElementoDoc => ({
    tipo: 'campos',
    items: items.map(([etiqueta, valor]) => ({ etiqueta, valor })),
  });

  // ============================================================ 4.1 + 4.2
  sec('4.1', '4.1  Información general', [
    campos([
      ['Elaborado por', `${p.general.elaboradoPor || '—'}${p.general.cargo ? ` (${p.general.cargo})` : ''}`],
      ['Firma o identificación', p.general.firmaIdentificacion || '—'],
      ['Fecha', fechaLarga(p.general.fecha)],
    ]),
    { tipo: 'parrafo', texto: 'Declaración de responsabilidad sobre la veracidad y confiabilidad de los datos:' },
    {
      tipo: 'parrafo',
      texto: p.general.declaracionResponsabilidad ? DECLARACION_RESPONSABILIDAD : 'Pendiente de aceptar en la aplicación.',
      italica: true,
    },
    { tipo: 'subtitulo', texto: '4.2  Título' },
    campos([
      ['Nombre del proyecto', p.titulo.nombreProyecto || '—'],
      ['Denominación de la propuesta', p.titulo.denominacionPropuesta || '—'],
    ]),
  ], { paginaNueva: true });

  // ============================================================ 4.4 Resumen
  sec('4.4', '4.4  Resumen ejecutivo', [
    { tipo: 'parrafo', texto: p.resumen.introduccion || '—' },
    {
      tipo: 'tabla',
      tabla: {
        titulo: 'Cifras clave (vinculadas al modelo financiero activo)',
        encabezados: ['Indicador', 'Valor'],
        filas: [
          [`Inversión total (${ctx.unidadLarga})`, K(m.indicadores.inversionTotalKUSD)],
          [`Aportaciones de los socios (${ctx.unidadLarga})`, K(m.indicadores.aportacionesTotalesKUSD)],
          [`Crédito externo previsto (${ctx.unidadLarga})`, p.financiero.deuda.habilitada ? K(param('credito_monto_k')) : 'No previsto'],
          ['Horizonte de análisis (años)', String(N)],
          [`Ingresos totales del año 1 (${ctx.unidadLarga})`, K(m.indicadores.ingresosTotales[1] ?? 0)],
          [`Utilidad después de impuestos del año 1 (${ctx.unidadLarga})`, K(m.indicadores.utilidadNeta[1] ?? 0)],
          ['Recuperación de la INVERSIÓN TOTAL (flujo del proyecto)', recP.anios === null ? 'No recuperada en el horizonte' : fmtAnios(recP.anios)],
          ['Recuperación del CAPITAL APORTADO (flujo de los socios)', recS.anios === null ? 'No recuperada en el horizonte' : fmtAnios(recS.anios)],
          [`Beneficios directos al país acumulados — período completo (${ctx.unidadLarga})`, K(m.indicadores.beneficiosPaisAcumulados)],
          [`Beneficios directos al país — explotación, años 1–N (${ctx.unidadLarga})`, K(m.indicadores.beneficiosPaisExplotacion)],
          ['Empleos directos en operación', String(m.indicadores.totalTrabajadores)],
          ['Salario promedio anual (CUP)', m.indicadores.salarioPromedioAnualCUP === null ? '—' : fmtCUP(m.indicadores.salarioPromedioAnualCUP)],
        ],
      },
    },
    analisis('resumen_ejecutivo', 'Resumen ejecutivo — análisis dinámico'),
    { tipo: 'parrafo', texto: p.resumen.notas, pequeno: true },
    ...(esDemo ? [{ tipo: 'aviso' as const, texto: `ADVERTENCIA: ${ADVERTENCIA_DATOS_FICTICIOS}` }] : []),
  ]);

  // ============================================================ 4.5 Descripción
  sec('4.5', '4.5  Descripción del negocio', [
    campos([
      ['Modalidad de la inversión extranjera', p.negocio.modalidad],
      ['Objeto social o contractual', p.negocio.objetoSocial],
      ['Plazo de vigencia', p.negocio.plazoVigencia],
      ['Fundamentación y propuesta de valor', p.negocio.fundamentacion],
      ['Relación con los objetivos de la inversión extranjera', p.negocio.objetivosInversion],
      ['Relación con el PNDES', p.negocio.relacionPNDES],
      ['Relación con la estrategia territorial', p.negocio.relacionEDT],
      ['Bienes y servicios', p.negocio.bienesServicios],
      ['Mercado interno', p.negocio.mercadoInterno],
      ['Mercado externo', p.negocio.mercadoExterno],
      ['Regla de distribución de beneficios', p.negocio.reglaDistribucion],
    ]),
    {
      tipo: 'tabla',
      tabla: {
        titulo: 'Inversionista extranjero',
        encabezados: ['Campo', 'Contenido'],
        filas: [
          ['Nombre', p.inversionistaExtranjero.nombre || '—'],
          ['Domicilio', p.inversionistaExtranjero.domicilio || '—'],
          ['Identificación fiscal', p.inversionistaExtranjero.identificacionFiscal || '—'],
          ['Experiencia', p.inversionistaExtranjero.experiencia || '—'],
          ['Vinculación con Cuba', p.inversionistaExtranjero.vinculacionCuba || '—'],
        ],
      },
    },
    {
      tipo: 'tabla',
      tabla: {
        titulo: 'Inversionista nacional',
        encabezados: ['Campo', 'Contenido'],
        filas: [
          ['Nombre', p.inversionistaNacional.nombre || '—'],
          ['Domicilio', p.inversionistaNacional.domicilio || '—'],
          ['Identificación fiscal', p.inversionistaNacional.identificacionFiscal || '—'],
          ['Experiencia (objeto social vigente, cuando corresponda)', p.inversionistaNacional.experiencia || '—'],
          ['Vinculación con Cuba', p.inversionistaNacional.vinculacionCuba || '—'],
        ],
      },
    },
    ...(p.aportaciones.length
      ? ([
          {
            tipo: 'tabla' as const,
            tabla: {
              titulo: `Aportaciones de los socios (${ctx.unidadLarga} con un decimal)`,
              encabezados: ['Socio', 'Tipo de aporte', 'Año 1', 'Año 2', 'Año 3', 'Total', 'Ref. doc.'],
              filas: p.aportaciones.map((a) => [
                a.socio === 'nacional' ? 'Nacional' : 'Extranjero',
                ETIQUETAS_APORTACION[a.tipo],
                ...a.montos.map((mm) => K(mm)),
                K(a.montos.reduce((s, mm) => s + mm, 0)),
                a.referenciaDocumental ? 'Sí' : a.tipo === 'derechos_reales' ? 'PENDIENTE' : '—',
              ]),
            },
          },
          {
            tipo: 'parrafo' as const,
            texto:
              'Los aportes de derechos reales requieren la certificación de la Dirección de Patrimonio del MFP cuando corresponda (metodología 4.5). Los aportes en activos deben conciliar con el inventario de inversiones para evitar la doble contabilización del mismo bien.',
            pequeno: true,
          },
          analisis('aportaciones', 'Análisis de las aportaciones'),
        ] as ElementoDoc[])
      : []),
  ]);

  // ============================================================ 4.6 Técnico
  sec('4.6', '4.6  Aspectos técnicos y operativos', [
    campos([
      ['Caracterización de bienes y servicios', p.tecnico.caracterizacion],
      ['Capacidad instalada', p.tecnico.capacidadInstalada],
      ['Plazo para alcanzar los niveles previstos', p.tecnico.plazoNiveles],
      ['Tecnologías utilizadas', p.tecnico.tecnologiasActuales],
      ['Tecnologías a incorporar', p.tecnico.tecnologiasNuevas],
      ['Localización', p.tecnico.localizacion],
      ['Infraestructura requerida', p.tecnico.infraestructura],
      ['Terrenos e instalaciones', p.tecnico.terrenosInstalaciones],
      ['Necesidades de construcción', p.tecnico.necesidadesConstruccion],
    ]),
    ...(p.recursos.length
      ? ([
          {
            tipo: 'parrafo' as const,
            texto: `Escenario de capacidad ACTIVO: ${p.tecnico.escenarioCapacidad === 'B_ampliacion' ? 'B — ampliaciones programadas' : 'A — capacidad constante (las ampliaciones definidas no se aplican)'}.`,
            pequeno: true,
          },
          {
            tipo: 'tabla' as const,
            tabla: {
              titulo: 'Recursos operativos (la capacidad se deriva de estos datos)',
              encabezados: ['Recurso', 'Tipo', 'Cant.', 'Horas/día', 'Días/año', 'Mantenim.', 'Disp. desde año', 'Ampliaciones'],
              filas: p.recursos.map((r) => [
                r.nombre,
                ETIQUETAS_RECURSO[r.tipo],
                String(r.cantidad),
                fmtK(r.horasDia),
                String(r.diasAnio),
                fmtPct(r.pctMantenimiento),
                String(r.anioDisponible),
                r.expansiones.length ? r.expansiones.map((e) => `+${e.cantidad} en año ${e.anio} (${K(e.costoKUSD)} ${ctx.unidadCorta})`).join('; ') : '—',
              ]),
              ancha: true,
            },
          },
        ] as ElementoDoc[])
      : []),
    ...(p.servicios.length
      ? ([
          {
            tipo: 'tabla' as const,
            tabla: {
              titulo: `Servicios previstos (año 1; precios y costos unitarios en ${ctx.simbolo}; demanda vs. capacidad del escenario activo)`,
              encabezados: ['Servicio', 'Precio unit.', 'Demanda mensual', 'Duración (min)', 'Recursos que usa', 'CVU', 'Cantidad realizable/mes', 'Capacidad mensual', 'Estado de la capacidad'],
              filas: p.servicios.map((s) => {
                const sc = m.servicios.find((x) => x.id === s.id);
                const cap1 = m.capacidadServicios[s.id]?.[1];
                const limitada = sc && sc.capacidadesExcedidas.length > 0;
                return [
                  s.nombre,
                  U(s.precioBase),
                  String(s.cantidadBaseMensual),
                  fmtK(s.duracionMinutos),
                  String(s.recursoIds.length ? s.recursoIds.length : '—'),
                  U(s.costoVariableUnitario),
                  fmtK(sc?.valores[1]?.['srv_cantidad_real_mensual'] ?? 0),
                  cap1 ? fmtK(cap1.capacidadMensual) : '—',
                  limitada ? `LIMITADA (${sc!.capacidadesExcedidas.join(', ')})` : 'Atendible',
                ];
              }),
              ancha: true,
            },
          },
          analisis('capacidad', 'Análisis de capacidad y servicios'),
        ] as ElementoDoc[])
      : []),
    ...(p.consumos.length
      ? ([
          {
            tipo: 'tabla' as const,
            tabla: {
              titulo: 'Estimación de consumos y residuos',
              encabezados: ['Concepto', 'Unidad', 'Cantidad', 'Período', 'Observación'],
              filas: p.consumos.map((c) => [c.concepto, c.unidad, String(c.cantidad), c.periodo, c.observacion]),
            },
          },
        ] as ElementoDoc[])
      : []),
  ]);

  // ============================================================ 4.7 Financiero
  const elementos47: ElementoDoc[] = [
    {
      tipo: 'tabla',
      tabla: {
        titulo: `Costo total de la inversión inicial (${ctx.unidadLarga})`,
        encabezados: ['Componente', 'Monto'],
        filas: [
          ['Gastos previos', K(val('gastos_previos_k', 0))],
          ['Inversión fija (en USD)', K(val('inversion_fija_usd_k', 0))],
          ['Inversión fija en CUP convertida (tipo de cambio parametrizado)', K(val('inversion_fija_cup_k', 0))],
          ['Capital de trabajo', K(param('capital_trabajo_k'))],
          ['INVERSIÓN TOTAL', K(m.indicadores.inversionTotalKUSD)],
        ],
      },
    },
    {
      tipo: 'tabla',
      tabla: {
        titulo: `Fuentes de financiamiento (${ctx.unidadLarga})`,
        encabezados: ['Fuente', 'Monto'],
        filas: [
          ['Aportaciones de los socios', K(m.indicadores.aportacionesTotalesKUSD)],
          ['Otras fuentes disponibles', K(param('otras_fuentes_k'))],
          ['Crédito externo', K(param('credito_monto_k'))],
          ['Financiación disponible', K(val('financiacion_disponible_k', 0))],
          ['Necesidad de financiación', K(val('necesidad_financiacion_k', 0))],
          ['Diferencia (exceso/insuficiencia)', K(val('diferencia_financiacion_k', 0))],
        ],
      },
    },
    analisis('inversion_financiacion', 'Análisis de inversión y financiación'),
  ];
  if (p.financiero.deuda.habilitada && param('credito_monto_k') > 0) {
    elementos47.push({
      tipo: 'parrafo',
      texto: `Crédito: ${ETIQUETAS_TIPO_GRACIA[p.financiero.deuda.tipoGracia]}, ${param('periodo_gracia')} año(s); método: ${ETIQUETAS_METODO_AMORT[p.financiero.deuda.metodo]} en ${param('plazo_amortizacion')} anualidades; desembolso en el año ${p.financiero.deuda.anioDesembolso}. Tasa: ${fmtPct(param('tasa_interes'))} (supuesto editable).`,
      pequeno: true,
    });
    elementos47.push({
      tipo: 'tabla',
      tabla: {
        titulo: `Calendario financiero de la deuda (${ctx.unidadLarga}): saldo final = saldo inicial + desembolso + capitalización − amortización`,
        encabezados: ['Período', 'Saldo inicial', 'Desembolso', 'Interés devengado', 'Amortización', 'Saldo final'],
        filas: m.deuda.map((f) => [
          f.anio === 0 ? 'Año 0' : `Año ${f.anio}`,
          K(f.saldoInicial),
          K(f.desembolso),
          K(f.interesDevengado),
          K(f.amortizacion),
          K(f.saldoFinal),
        ]),
        ancha: true,
      },
    });
  }
  if (m.depreciacion.length) {
    const aniosMuestra = [1, 2, 3, 5, N];
    elementos47.push({
      tipo: 'tabla',
      tabla: {
        titulo: `Depreciación por activo (${ctx.unidadCorta}; por activo, limitada al importe depreciable; años de muestra y extremos)`,
        encabezados: ['Activo', `Base depreciable (${ctx.unidadCorta})`, 'Vida útil', 'Disp. desde', 'Residual', ...aniosMuestra.map((t) => `Año ${t}`), 'Acumulada', 'VNL'],
        filas: m.depreciacion.map((a) => {
          const fila: string[] = [
            a.concepto,
            K(a.baseDepreciableKUSD),
            String(a.vidaUtilAnios),
            String(a.anioDisponible),
            fmtPct(a.valorResidualPct),
          ];
          for (const t of aniosMuestra) fila.push(t <= N ? K(a.depreciacion[t] ?? 0) : '—');
          fila.push(K(a.acumulada), K(a.vnl));
          return fila;
        }),
        ancha: true,
      },
    });
  }
  elementos47.push(analisis('deuda_depreciacion', 'Análisis de deuda y depreciación'));
  const headProj: string[] = ['Concepto', 'Unidad', ...years.map((t) => (t === 0 ? 'Año 0' : `Año ${t}`)), 'Total'];
  const filasProj: string[][] = [];
  for (const grupo of ESTADO_RESULTADOS) {
    for (const linea of grupo.lineas) {
      const fila: string[] = [linea.etiqueta, ctx.unidadCorta];
      let total = 0;
      for (const t of years) {
        const v = valorLinea(m, p, linea.ref, t);
        fila.push(K(v));
        total += v;
      }
      fila.push(K(total));
      filasProj.push(fila);
    }
  }
  for (const id of ['amortizacion_k', 'saldo_deuda_k', 'dividendos_pagables_k']) {
    const r = p.reglas.find((x) => x.id === id);
    if (!r) continue;
    const fila: string[] = [id === 'dividendos_pagables_k' ? 'Dividendos pagables (memoria; no es gasto)' : `${r.nombre} (memoria; flujo de financiación, no gasto)`, ctx.unidadCorta];
    for (const t of years) fila.push(K(val(id, t)));
    fila.push('');
    filasProj.push(fila);
  }
  elementos47.push({
    tipo: 'tabla',
    tabla: {
      titulo: `Proyección de ingresos, costos y utilidades (${ctx.unidadLarga})`,
      encabezados: headProj,
      filas: filasProj,
      ancha: true,
    },
  });
  elementos47.push(analisis('ingresos_costos', 'Análisis de ingresos, costos y utilidades'));
  sec('4.7', '4.7  Análisis financiero', elementos47);

  // ============================================================ 4.7.1 Flujos
  const elementos471: ElementoDoc[] = [
    {
      tipo: 'parrafo',
      texto:
        'El modelo calcula DOS indicadores separados: la recuperación de la INVERSIÓN TOTAL con el flujo de caja del proyecto (FCFF) y la recuperación del CAPITAL APORTADO con el flujo de los socios (FCFE). Ninguno mezcla la utilidad contable con la amortización del crédito.',
      pequeno: true,
    },
    {
      tipo: 'tabla',
      tabla: {
        titulo: `Flujos de caja del proyecto y de los socios (${ctx.unidadLarga})`,
        encabezados: [`Concepto (${ctx.unidadCorta})`, ...years.map((t) => (t === 0 ? 'Año 0' : `Año ${t}`))],
        filas: [
          ['Flujo del PROYECTO (FCFF)', ...years.map((t) => K(m.indicadores.fcff[t] ?? 0))],
          ['Flujo acumulado del proyecto', ...years.map((t) => K(m.indicadores.fcffAcumulado[t] ?? 0))],
          ['Saldo pendiente de recuperar (inversión total)', ...years.map((t) => K(val('saldo_pendiente_proyecto_k', t)))],
          ['Flujo de los SOCIOS (FCFE)', ...years.map((t) => K(m.indicadores.fcfe[t] ?? 0))],
          ['Flujo acumulado de los socios', ...years.map((t) => K(m.indicadores.fcfeAcumulado[t] ?? 0))],
          ['Saldo pendiente de recuperar (capital aportado)', ...years.map((t) => K(val('saldo_pendiente_socios_k', t)))],
        ],
        ancha: true,
      },
    },
    {
      tipo: 'parrafo',
      texto: `Recuperación de la inversión total: ${recP.anios === null ? 'NO se recupera dentro del horizonte' : `${fmtAnios(recP.anios)} (cruce en el año ${recP.anioCruce})`}. Método: interpolación lineal del acumulado, (t−1) + |acumulado anterior| / (acumulado actual − acumulado anterior). Recuperación del capital aportado: ${recS.anios === null ? 'NO se recupera dentro del horizonte' : `${fmtAnios(recS.anios)} (cruce en el año ${recS.anioCruce})`}. ${recP.indeterminado || recS.indeterminado ? 'ATENCIÓN: algún acumulado cambia de signo más de una vez (flujos no convencionales): interpretar con cautela.' : ''} ${N < Math.ceil((recP.anios ?? 0) + 1) && recP.anios !== null ? 'El horizonte es menor que recuperación + 1: la metodología exige ampliarlo.' : 'Horizonte ≥ recuperación + 1 conforme a la metodología.'} El capital de trabajo solo se recupera si el parámetro correspondiente lo indica (regla explícita).`,
      pequeno: true,
    },
    analisis('flujo_recuperacion', 'Análisis del flujo de caja y la recuperación'),
  ];
  if (m.dividendos.length) {
    elementos471.push({
      tipo: 'tabla',
      tabla: {
        titulo: `Módulo de dividendos (${ctx.unidadCorta}): base distribuible, reserva, propuestos y PAGABLES limitados por caja`,
        encabezados: ['Período', 'UDI', 'Base', 'Reserva', 'Propuestos', 'Pagables', 'Socio nacional', 'Saldo acumulable'],
        filas: m.dividendos.map((d) => [
          d.anio === 0 ? 'Año 0' : `Año ${d.anio}`,
          K(d.udi),
          K(d.base),
          K(d.reserva),
          K(d.propuestos),
          K(d.pagables),
          K(d.socioNacional),
          K(d.saldoAcumulable),
        ]),
      },
    });
    elementos471.push({
      tipo: 'parrafo',
      texto:
        'Ningún dividendo se paga por encima de la caja acumulada disponible (FCFE antes de distribuciones). La PARTICIPACIÓN en el capital (composición) y el PORCENTAJE DE REPARTO son conceptos distintos y se configuran por separado. Los dividendos de la parte cubana que figuran en 4.11 salen de este mismo módulo.',
      pequeno: true,
    });
  }
  sec('4.7.1', '4.7.1  Flujos de caja y recuperación de la inversión', elementos471);

  // ============================================================ 4.8 Mercado
  sec('4.8', '4.8  Análisis o caracterización del mercado', [
    campos([
      ['Caracterización de productos y servicios', p.mercado.caracterizacion],
      ['Requisitos regulatorios y registros necesarios', p.mercado.requisitosRegulatorios],
      ['Materias primas y materiales auxiliares', p.mercado.materiasPrimas],
      ['Fuentes y ubicación de los suministros', p.mercado.fuentesSuministro],
      ['Consumo estimado', p.mercado.consumoEstimado],
      ['Demanda aparente', p.mercado.demandaAparente],
      ['Demanda solvente', p.mercado.demandaSolvente],
      ['Método y fuentes de estimación', `${p.mercado.metodoEstimacion} ${p.mercado.fuentesConsulta}`],
      ['Comercialización — exportaciones', p.mercado.ventasExportacion],
      ['Comercialización — divisas (plataformas con pagos desde el exterior)', p.mercado.ventasDivisas],
      ['Comercialización — moneda nacional', p.mercado.ventasMonedaNacional],
    ]),
    analisis('mercado', 'Análisis de mercado — lectura de los datos disponibles'),
  ]);

  // ============================================================ 4.9 Fuerza
  const filasPer: string[][] = [];
  const grupos = ['cubano_directivo', 'cubano_otro', 'extranjero_directivo', 'extranjero_otro'] as const;
  const headPer = ['Categoría', 'Etapa', 'Cantidad', 'Salario promedio anual (CUP)'];
  if (moneda === 'USD') headPer.push('Equivalente anual (USD)');
  for (const g of grupos) {
    for (const etapa of ['montaje', 'operacion'] as const) {
      const filas = p.personal.filter((x) => x.grupo === g && x.etapa === etapa);
      if (filas.length) {
        const cantidad = filas.reduce((s, x) => s + x.cantidad, 0);
        const salario = filas.reduce((s, x) => s + x.cantidad * x.salarioPromedioAnualCUP, 0) / Math.max(1, cantidad);
        const fila = [ETIQUETAS_GRUPO[g], etapa === 'montaje' ? 'Montaje (año 0, transitorio)' : 'Operación', String(cantidad), fmtCUP(salario)];
        if (moneda === 'USD') fila.push(fmtUsd(ctx.cupAUsd(salario)));
        filasPer.push(fila);
      }
    }
  }
  {
    const salTotal = m.indicadores.salarioPromedioAnualCUP;
    const filaTotal = ['TOTAL (operación)', '', String(m.indicadores.totalTrabajadores), salTotal === null ? '—' : fmtCUP(salTotal)];
    if (moneda === 'USD') filaTotal.push(salTotal === null ? '—' : fmtUsd(ctx.cupAUsd(salTotal)));
    filasPer.push(filaTotal);
  }
  sec('4.9', '4.9  Fuerza de trabajo', [
    { tipo: 'parrafo', texto: `Entidad autorizada a contratar la fuerza de trabajo: ${p.fuerza.entidadContratante || '—'}` },
    {
      tipo: 'tabla',
      tabla: {
        titulo: `Fuerza de trabajo por categoría y etapa de contratación (salarios en CUP conforme a la metodología 4.9${moneda === 'USD' ? '; equivalente en USD documentado' : ''})`,
        encabezados: headPer,
        filas: filasPer,
      },
    },
    analisis('fuerza_trabajo', 'Análisis de la fuerza de trabajo'),
  ]);

  // ============================================================ 4.10 Inversiones
  const elementos410: ElementoDoc[] = [];
  if (p.financiero.inversion.length) {
    elementos410.push({
      tipo: 'tabla',
      tabla: {
        titulo: `Inversiones por concepto (miles, en la moneda de origen indicada y en la moneda de presentación; activos con disponibilidad y residual)`,
        encabezados: ['Concepto', 'Categoría', 'Moneda', 'Monto', `En ${ctx.simbolo} (${ctx.unidadCorta})`, 'Vida útil (años)', 'Disp. desde', 'Residual', 'Observación'],
        filas: p.financiero.inversion.map((r) => [
          r.concepto,
          ETIQUETAS_CATEGORIA_INV[r.categoria],
          r.moneda,
          fmtK(r.monto),
          ctx.fmtKPres(ctx.montoFilaAK(r)),
          r.vidaUtilAnios > 0 ? String(r.vidaUtilAnios) : '—',
          r.categoria === 'inversion_fija' ? String(r.anioDisponible) : '—',
          r.categoria === 'inversion_fija' ? fmtPct(r.valorResidualPct) : '—',
          r.observacion,
        ]),
        ancha: true,
      },
    });
    elementos410.push({
      tipo: 'parrafo',
      texto: 'No se suman monedas diferentes: los montos en CUP se convierten con el tipo de cambio parametrizado (con fecha y fuente) para los totales. Los activos fijos deprecian desde su año de disponibilidad y solo por su importe depreciable.',
      pequeno: true,
    });
  }
  if (p.financiero.vehiculos.length) {
    elementos410.push({
      tipo: 'tabla',
      tabla: {
        titulo: 'Desglose de vehículos',
        encabezados: ['Tipo', 'Cantidad', `Monto (${ctx.unidadLarga})`],
        filas: p.financiero.vehiculos.map((v) => [v.tipo, String(v.cantidad), K(v.montoKUSD)]),
      },
    });
  }
  if (p.cronograma.length) {
    elementos410.push({
      tipo: 'tabla',
      tabla: {
        titulo: 'Cronograma inversionista',
        encabezados: ['Etapa', 'Inicio', 'Fin', 'Observación'],
        filas: p.cronograma.map((c) => [c.etapa, mesAnio(c.inicio), mesAnio(c.fin), c.observacion]),
      },
    });
  }
  elementos410.push(analisis('inversiones_cronograma', 'Análisis de inversiones y cronograma'));
  sec('4.10', '4.10  Inversiones', elementos410);

  // ============================================================ 4.11 Beneficios
  const headBP = ['Partida', ...years.map((t) => (t === 0 ? 'Año 0' : `Año ${t}`)), 'Total'];
  const filasBP: string[][] = [];
  for (const linea of BENEFICIOS_PAIS) {
    const fila: string[] = [linea.etiqueta + (linea.incluyeAnioCero ? ' [incluye año 0]' : ' [años 1–N]')];
    let total = 0;
    for (const t of years) {
      const v = valorLinea(m, p, linea.ref, t);
      fila.push(K(v));
      total += v;
    }
    fila.push(K(total));
    filasBP.push(fila);
  }
  sec('4.11', '4.11  Indicadores de beneficios directos al país', [
    {
      tipo: 'tabla',
      tabla: {
        titulo: `Beneficios directos al país por año (${ctx.unidadLarga}; etiqueta de período por partida)`,
        encabezados: headBP,
        filas: filasBP,
        ancha: true,
      },
    },
    {
      tipo: 'parrafo',
      texto: `Período de análisis: ${N} años de operación, verificando el requisito de contemplar la recuperación más un año. Total acumulado del período completo: ${K(m.indicadores.beneficiosPaisAcumulados)} ${ctx.unidadLarga} (incluye el año 0). Subtotal de la explotación (años 1–${N}): ${K(m.indicadores.beneficiosPaisExplotacion)} ${ctx.unidadLarga}. Ambos totales provienen del mismo cálculo del motor: resumen, tabla y conclusiones coinciden.`,
      pequeno: true,
    },
    analisis('beneficios_pais', 'Análisis de los beneficios directos al país'),
  ]);

  // ============================================================ 4.12 Conclusiones
  sec('4.12', '4.12  Conclusiones', [
    { tipo: 'parrafo', texto: p.conclusiones.texto || '—' },
    analisis('conclusiones', 'Conclusiones (análisis dinámico del modelo)'),
  ]);

  // ============================================================ Diagnóstico
  const { hallazgos, resumen } = diagnosticar(p, m, pres);
  const elementosDiag: ElementoDoc[] = [
    {
      tipo: 'parrafo',
      texto: `Resumen de control — conteo: ${resumen.conteo.error_bloqueante} error(es) bloqueante(s), ${resumen.conteo.advertencia_importante} advertencia(s) importante(s), ${resumen.conteo.informacion_pendiente} información pendiente, ${resumen.conteo.observacion_calidad} observación(es) de calidad. ${resumen.conclusionesAfectadas ? 'Existen hallazgos que condicionan las conclusiones del plan.' : 'Ningún hallazgo invalida por sí mismo las conclusiones bajo los supuestos vigentes.'} La completitud formal no se usa como prueba de calidad: la validación legal, tributaria, sanitaria y de mercado queda sujeta a verificación externa.`,
    },
    {
      tipo: 'tabla',
      tabla: {
        titulo: 'Resumen de control por dimensiones',
        encabezados: ['Dimensión', 'Estado', 'Detalle'],
        filas: resumen.dimensiones.map((d) => [d.nombre, d.estado === 'ok' ? 'Correcto' : d.estado === 'aceptable' ? 'Aceptable' : 'Deficiente', d.detalle]),
      },
    },
  ];
  if (hallazgos.length) {
    elementosDiag.push({
      tipo: 'tabla',
      tabla: {
        titulo: 'Hallazgos del diagnóstico',
        encabezados: ['Nivel', 'Código', 'Hallazgo', '¿Afecta conclusiones?'],
        filas: hallazgos.map((h) => [h.nivel, h.codigo, h.mensaje, h.afectaConclusiones ? 'SÍ' : 'No']),
        ancha: true,
      },
    });
  } else {
    elementosDiag.push({ tipo: 'parrafo', texto: 'No se emitieron hallazgos.' });
  }
  if (moneda === 'CUP') {
    elementosDiag.push({
      tipo: 'parrafo',
      texto: `Los importes de los hallazgos derivados de las reglas del motor se expresan en kUSD (unidad nativa del motor); los del propio diagnóstico, en ${ctx.unidadLarga}.`,
      pequeno: true,
    });
  }
  sec('diagnostico', 'Diagnóstico y controles de consistencia', elementosDiag);

  // ============================================================ Notas
  const elementosNotas: ElementoDoc[] = [
    {
      tipo: 'tabla',
      tabla: {
        titulo: 'Parámetros de cálculo activos (Nivel A — editables en la aplicación)',
        encabezados: ['Parámetro', 'Valor', 'Naturaleza', 'Fecha ref.'],
        filas: p.parametros.map((x) => [
          x.nombre,
          x.tipo === 'porcentaje' ? fmtPct(x.valor) : `${fmtK(x.valor)} ${x.unidad}`,
          x.demo ? 'SUPUESTO DEMOSTRATIVO' : 'Definido por el usuario',
          x.fechaRef || '—',
        ]),
      },
    },
    {
      tipo: 'parrafo',
      texto:
        'Reglas de cálculo activas (Nivel B): fórmulas completas, ámbito y equivalencias Excel pueden consultarse en «Configuración de cálculos» de la aplicación y en la hoja «Reglas» del libro exportado. Las variables del motor (mtr_*) provienen de las hojas Depreciacion, Deuda, FlujosCaja, Dividendos y Capacidad. La regla del impuesto sobre utilidades es demostrativa y editable: no constituye la tasa legal aplicable.',
    },
    {
      tipo: 'parrafo',
      texto: `Redondeo: los cálculos usan precisión interna completa y el redondeo es solo de presentación (${ctx.unidadLarga} con un decimal); pequeñas diferencias con la suma visual de cifras redondeadas se explican por este motivo de forma uniforme.`,
    },
    { tipo: 'parrafo', texto: notaConversion(ctx, tasa) },
    ...(esDemo ? [{ tipo: 'aviso' as const, texto: ADVERTENCIA_DATOS_FICTICIOS }] : []),
  ];
  sec('notas', 'Notas, parámetros y supuestos del modelo', elementosNotas);

  // ============================================================ Documento
  return {
    meta: {
      nombreProyecto: p.titulo.nombreProyecto || p.nombre,
      fechaDocumento: fechaLarga(p.general.fecha || p.actualizado),
      esquema: p.planex.schemaVersion,
      horizonte: N,
      esDemo,
      moneda,
      unidadTabla: ctx.unidadTabla,
      notaMoneda: notaConversion(ctx, tasa),
    },
    portada: {
      titulo: 'PLAN DE NEGOCIOS',
      subtitulo: 'Propuesta de negocio con inversión extranjera — Bases metodológicas GOC-2026-O57',
      marca: 'Elaborado con PLANEX Cuba',
      nombreProyecto: p.titulo.nombreProyecto || p.nombre,
      denominacion: p.titulo.denominacionPropuesta || '',
      cifras: [
        { etiqueta: 'Inversión total', valor: `${K(m.indicadores.inversionTotalKUSD)} ${ctx.unidadLarga}` },
        { etiqueta: 'Horizonte de análisis', valor: `${N} años` },
        { etiqueta: 'Recuperación de la inversión total (flujo del proyecto)', valor: recP.anios === null ? 'no recuperada en el horizonte' : fmtAnios(recP.anios) },
        { etiqueta: 'Recuperación del capital aportado (flujo de los socios)', valor: recS.anios === null ? 'no recuperada en el horizonte' : fmtAnios(recS.anios) },
        { etiqueta: 'Moneda de presentación del documento', valor: `${ctx.simbolo} — ${ctx.unidadTabla}` },
        { etiqueta: 'Fecha del documento', valor: fechaLarga(p.general.fecha || p.actualizado) },
        { etiqueta: 'Versión de esquema', valor: p.planex.schemaVersion },
      ],
      avisoDemo: esDemo ? ADVERTENCIA_DATOS_FICTICIOS : undefined,
    },
    secciones,
  };
}


