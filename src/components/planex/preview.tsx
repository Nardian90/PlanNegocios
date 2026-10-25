'use client';

// Documento del plan: representación de lectura (hojas tamaño carta,
// fondo claro constante) alimentada por el modelo vigente del motor.
// No es una captura de la interfaz de edición y no contiene controles de
// formulario: se renderiza dentro de la vista dedicada de previsualización
// (ruta #/preview) y también se usa como referencia del PDF exportado.
//
// Esquema 2.0.0: análisis dinámicos por apartado (misión §12), metadatos de
// beneficios, calendario de deuda, depreciación por activo, flujos FCFF/FCFE
// y módulo de dividendos — todo con las cifras del mismo modelo activo.

import * as React from 'react';
import { usePlanex } from '@/lib/planex/store';
import { ComputedModel, ESTADO_RESULTADOS, BENEFICIOS_PAIS, ETIQUETAS_APORTACION, ETIQUETAS_CATEGORIA_INV, ETIQUETAS_GRUPO, ADVERTENCIA_DATOS_FICTICIOS, DECLARACION_RESPONSABILIDAD } from '@/lib/planex/types';
import { valorLinea } from '@/lib/planex/engine/engine';
import { generarAnalisis, estadoAnalisis, ClaveAnalisis } from '@/lib/planex/engine/analisis';
import { fmtK, fmtCUP, fmtPct, fmtAnios, fechaLarga, mesAnio } from '@/lib/planex/format';

function Hoja({ children }: { children: React.ReactNode }) {
  return <div className="bg-white text-slate-800 shadow-md rounded-md px-10 py-9 max-w-[820px] mx-auto mb-6 print:shadow-none print:rounded-none print:mb-0 print:break-after-page">{children}</div>;
}

function TituloSeccion({ num, titulo }: { num: string; titulo: string }) {
  return (
    <h2 className="text-lg font-bold text-slate-900 border-b-2 border-slate-800 pb-1.5 mt-7 mb-3 first:mt-0">
      <span className="font-mono text-sm text-slate-500 mr-2">{num}</span>
      {titulo}
    </h2>
  );
}

function Parrafo({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="mb-2.5 text-[13px] leading-relaxed">
      <b>{etiqueta}:</b> {valor || <i className="text-slate-400">— pendiente —</i>}
    </div>
  );
}

function TablaDoc({ encabezados, filas, anchoPrimera }: { encabezados: string[]; filas: (string | number)[][]; anchoPrimera?: string }) {
  return (
    <div className="overflow-x-auto my-3">
      <table className="w-full text-[11px] border-collapse">
        <thead>
          <tr>
            {encabezados.map((e, i) => (
              <th key={i} className={`border border-slate-300 bg-slate-100 px-2 py-1 font-semibold ${i === 0 ? 'text-left' : 'text-right'}`} style={i === 0 ? { width: anchoPrimera } : undefined}>
                {e}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f, i) => (
            <tr key={i} className="odd:bg-slate-50">
              {f.map((c, j) => (
                <td key={j} className={`border border-slate-300 px-2 py-1 ${j === 0 ? 'text-left' : 'text-right tabular-nums'}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Bloque de análisis dinámico con su etiqueta de trazabilidad (§12.13). */
function AnalisisDoc({ modelo, clave, titulo }: { modelo: ComputedModel; clave: ClaveAnalisis; titulo: string }) {
  const p = usePlanex((s) => s.proyecto);
  const generados = generarAnalisis(p, modelo);
  const actual = generados[clave];
  const { estado, texto } = estadoAnalisis(p, clave, actual);
  return (
    <div className="my-3 border-l-4 border-amber-500/70 bg-amber-50/60 pl-3 pr-2 py-2 rounded-r">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-800">
        {titulo} — {estado === 'generado' ? 'análisis generado por el modelo' : estado === 'manual' ? 'análisis editado por el usuario (al día)' : 'análisis editado — DESACTUALIZADO: los datos de origen cambiaron'}
      </div>
      <p className="text-[12px] leading-relaxed text-slate-700 mt-1 whitespace-pre-wrap">{texto}</p>
    </div>
  );
}

/** Documento completo del plan (portada, índice, 4.1–4.12 y notas) para la vista dedicada. */
export function DocumentoPlan({ modelo }: { modelo: ComputedModel }) {
  const p = usePlanex((s) => s.proyecto);
  const m = modelo;
  const esDemo = p.planex.plantillaOrigen === 'clinica' || p.planex.plantillaOrigen === 'centro';
  const years = m.years;
  const val = (id: string, t: number) => m.valores[id]?.[t] ?? 0;
  const param = (id: string) => p.parametros.find((x) => x.id === id)?.valor ?? 0;
  const recP = m.indicadores.recuperacionProyecto;
  const recS = m.indicadores.recuperacionSocios;

  return (
    <div className="preview-doc">
      {/* Portada */}
      <Hoja>
        <div className="bg-slate-800 text-white -mx-10 -mt-9 mb-6 px-10 py-8 rounded-t-md">
          <div className="text-2xl font-bold tracking-wide">PLAN DE NEGOCIOS</div>
          <div className="text-xs mt-1 opacity-90">Propuesta de negocio con inversión extranjera — Bases metodológicas GOC-2026-O57</div>
          <div className="text-[10px] mt-2 opacity-75">Elaborado con PLANEX Cuba</div>
        </div>
        <div className="text-xl font-bold text-slate-900">{p.titulo.nombreProyecto || p.nombre}</div>
        <div className="text-sm text-slate-600 mt-1 mb-4">{p.titulo.denominacionPropuesta}</div>
        <div className="text-[13px] space-y-1">
          <div><b>Inversión total:</b> {fmtK(m.indicadores.inversionTotalKUSD)} miles de USD</div>
          <div><b>Horizonte de análisis:</b> {p.ajustes.horizonteAnios} años</div>
          <div><b>Recuperación de la inversión total (flujo del proyecto):</b> {recP.anios == null ? 'no recuperada en el horizonte' : fmtAnios(recP.anios)}</div>
          <div><b>Recuperación del capital aportado (flujo de los socios):</b> {recS.anios == null ? 'no recuperada en el horizonte' : fmtAnios(recS.anios)}</div>
          <div><b>Fecha:</b> {fechaLarga(p.general.fecha || p.actualizado)} · Esquema {p.planex.schemaVersion}</div>
        </div>
        {esDemo && (
          <div className="mt-5 border-2 border-amber-500 bg-amber-50 text-amber-900 p-3 text-[11px] leading-relaxed rounded">
            <b>EJEMPLO ILUSTRATIVO CON DATOS FICTICIOS.</b> {ADVERTENCIA_DATOS_FICTICIOS.split('. ').slice(1).join('. ')}
          </div>
        )}
      </Hoja>

      {/* Índice */}
      <Hoja>
        <TituloSeccion num="" titulo="Índice" />
        <ol className="text-[13px] space-y-1.5 list-decimal pl-6">
          {['4.1 Información general', '4.2 Título', '4.3 Índice', '4.4 Resumen ejecutivo', '4.5 Descripción del negocio', '4.6 Aspectos técnicos y operativos', '4.7 Análisis financiero', '4.7.1 Flujos de caja y recuperación', '4.8 Análisis o caracterización del mercado', '4.9 Fuerza de trabajo', '4.10 Inversiones', '4.11 Indicadores de beneficios directos al país', '4.12 Conclusiones', 'Diagnóstico y controles de consistencia', 'Notas y supuestos del modelo'].map((s) => (
            <li key={s} className="font-medium">{s}</li>
          ))}
        </ol>
        <p className="text-[11px] text-slate-500 mt-4">La numeración de páginas definitiva se genera en la exportación PDF (doble pasada).</p>
      </Hoja>

      {/* 4.1 + 4.2 */}
      <Hoja>
        <TituloSeccion num="4.1" titulo="Información general" />
        <Parrafo etiqueta="Elaborado por" valor={`${p.general.elaboradoPor}${p.general.cargo ? ` (${p.general.cargo})` : ''}`} />
        <Parrafo etiqueta="Firma o identificación" valor={p.general.firmaIdentificacion} />
        <Parrafo etiqueta="Fecha" valor={fechaLarga(p.general.fecha)} />
        <p className="text-[12px] italic text-slate-600 border-l-4 border-slate-200 pl-3 my-3">
          {p.general.declaracionResponsabilidad ? DECLARACION_RESPONSABILIDAD : 'Declaración de responsabilidad pendiente de aceptar.'}
        </p>
        <TituloSeccion num="4.2" titulo="Título" />
        <Parrafo etiqueta="Nombre del proyecto" valor={p.titulo.nombreProyecto} />
        <Parrafo etiqueta="Denominación de la propuesta" valor={p.titulo.denominacionPropuesta} />
      </Hoja>

      {/* 4.4 */}
      <Hoja>
        <TituloSeccion num="4.4" titulo="Resumen ejecutivo" />
        <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{p.resumen.introduccion || '—'}</p>
        <TablaDoc
          encabezados={['Indicador', 'Valor']}
          filas={[
            ['Inversión total (kUSD)', fmtK(m.indicadores.inversionTotalKUSD)],
            ['Aportaciones (kUSD)', fmtK(m.indicadores.aportacionesTotalesKUSD)],
            ['Ingresos totales año 1 (kUSD)', fmtK(m.indicadores.ingresosTotales[1] ?? 0)],
            ['Utilidad después de impuestos año 1 (kUSD)', fmtK(m.indicadores.utilidadNeta[1] ?? 0)],
            ['Recuperación de la inversión total (FCFF)', recP.anios === null ? 'No recuperada en el horizonte' : fmtAnios(recP.anios)],
            ['Recuperación del capital aportado (FCFE)', recS.anios === null ? 'No recuperada en el horizonte' : fmtAnios(recS.anios)],
            ['Beneficios al país — período completo (kUSD)', fmtK(m.indicadores.beneficiosPaisAcumulados)],
            ['Beneficios al país — explotación, años 1–N (kUSD)', fmtK(m.indicadores.beneficiosPaisExplotacion)],
            ['Empleos en operación', String(m.indicadores.totalTrabajadores)],
            ['Salario promedio anual', m.indicadores.salarioPromedioAnualCUP === null ? '—' : fmtCUP(m.indicadores.salarioPromedioAnualCUP)],
          ]}
          anchoPrimera="60%"
        />
        <AnalisisDoc modelo={m} clave="resumen_ejecutivo" titulo="Resumen ejecutivo (análisis dinámico)" />
        {esDemo && <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-300 rounded p-2">ADVERTENCIA: {ADVERTENCIA_DATOS_FICTICIOS}</p>}
      </Hoja>

      {/* 4.5 */}
      <Hoja>
        <TituloSeccion num="4.5" titulo="Descripción del negocio" />
        <Parrafo etiqueta="Modalidad" valor={p.negocio.modalidad} />
        <Parrafo etiqueta="Objeto social o contractual" valor={p.negocio.objetoSocial} />
        <Parrafo etiqueta="Plazo de vigencia" valor={p.negocio.plazoVigencia} />
        <Parrafo etiqueta="Fundamentación" valor={p.negocio.fundamentacion} />
        <Parrafo etiqueta="Relación con objetivos de la inversión extranjera" valor={p.negocio.objetivosInversion} />
        <Parrafo etiqueta="Relación con el PNDES" valor={p.negocio.relacionPNDES} />
        <Parrafo etiqueta="Relación con la estrategia territorial" valor={p.negocio.relacionEDT} />
        <Parrafo etiqueta="Bienes y servicios" valor={p.negocio.bienesServicios} />
        <Parrafo etiqueta="Mercado interno" valor={p.negocio.mercadoInterno} />
        <Parrafo etiqueta="Mercado externo" valor={p.negocio.mercadoExterno} />
        <Parrafo etiqueta="Regla de distribución de beneficios" valor={p.negocio.reglaDistribucion} />
        <Parrafo etiqueta="Inversionista extranjero" valor={`${p.inversionistaExtranjero.nombre} — ${p.inversionistaExtranjero.experiencia}`} />
        <Parrafo etiqueta="Inversionista nacional (objeto social vigente, cuando corresponda)" valor={`${p.inversionistaNacional.nombre} — ${p.inversionistaNacional.experiencia}`} />
        {p.aportaciones.length > 0 && (
          <>
            <TablaDoc
              encabezados={['Socio', 'Tipo de aporte', 'Año 1', 'Año 2', 'Año 3', 'Total']}
              filas={p.aportaciones.map((a) => [
                a.socio === 'nacional' ? 'Nacional' : 'Extranjero',
                ETIQUETAS_APORTACION[a.tipo],
                ...a.montos.map((mm) => fmtK(mm)),
                fmtK(a.montos.reduce((s, mm) => s + mm, 0)),
              ])}
            />
            <AnalisisDoc modelo={m} clave="aportaciones" titulo="Análisis de las aportaciones" />
          </>
        )}
      </Hoja>

      {/* 4.6 */}
      <Hoja>
        <TituloSeccion num="4.6" titulo="Aspectos técnicos y operativos" />
        <Parrafo etiqueta="Caracterización" valor={p.tecnico.caracterizacion} />
        <Parrafo etiqueta="Capacidad instalada" valor={p.tecnico.capacidadInstalada} />
        <Parrafo etiqueta="Escenario de capacidad activo" valor={p.tecnico.escenarioCapacidad === 'B_ampliacion' ? 'B — ampliaciones programadas (CAPEX y capacidad desde su año)' : 'A — capacidad constante (las ampliaciones definidas no se aplican)'} />
        <Parrafo etiqueta="Plazo para alcanzar los niveles previstos" valor={p.tecnico.plazoNiveles} />
        <Parrafo etiqueta="Tecnologías actuales" valor={p.tecnico.tecnologiasActuales} />
        <Parrafo etiqueta="Tecnologías a incorporar" valor={p.tecnico.tecnologiasNuevas} />
        <Parrafo etiqueta="Localización" valor={p.tecnico.localizacion} />
        <Parrafo etiqueta="Infraestructura" valor={p.tecnico.infraestructura} />
        {p.recursos.length > 0 && (
          <TablaDoc
            encabezados={['Recurso', 'Tipo', 'Cant.', 'Horas/día', 'Días/año', 'Mantenim.', 'Disp. desde', 'Ampliaciones']}
            filas={p.recursos.map((r) => [
              r.nombre,
              r.tipo,
              r.cantidad,
              r.horasDia,
              r.diasAnio,
              fmtPct(r.pctMantenimiento),
              `Año ${r.anioDisponible}`,
              r.expansiones.length ? r.expansiones.map((e) => `+${e.cantidad} en año ${e.anio} (${fmtK(e.costoKUSD)} kUSD)`).join('; ') : '—',
            ])}
            anchoPrimera="26%"
          />
        )}
        {p.servicios.length > 0 && (
          <>
            <TablaDoc
              encabezados={['Servicio', 'Precio (USD)', 'Demanda/mes', 'Duración (min)', 'Realizable año 1', 'Capacidad mensual', 'CVU (USD)', 'Ingreso año 1 (USD)']}
              filas={p.servicios.map((s) => {
                const cap = m.capacidadServicios[s.id]?.[1];
                return [
                  s.nombre,
                  fmtK(s.precioBase),
                  s.cantidadBaseMensual,
                  s.duracionMinutos,
                  fmtK(m.servicios.find((x) => x.id === s.id)?.valores[1]?.['srv_cantidad_real_mensual'] ?? 0),
                  cap ? fmtK(cap.capacidadMensual) : '—',
                  fmtK(s.costoVariableUnitario),
                  fmtK(m.servicios.find((x) => x.id === s.id)?.valores[1]?.['srv_ingreso_anual'] ?? 0),
                ];
              })}
              anchoPrimera="24%"
            />
            <AnalisisDoc modelo={m} clave="capacidad" titulo="Análisis de capacidad y servicios" />
          </>
        )}
        {p.consumos.length > 0 && (
          <TablaDoc encabezados={['Concepto', 'Unidad', 'Cantidad', 'Período']} filas={p.consumos.map((c) => [c.concepto, c.unidad, c.cantidad, c.periodo])} anchoPrimera="40%" />
        )}
      </Hoja>

      {/* 4.7 */}
      <Hoja>
        <TituloSeccion num="4.7" titulo="Análisis financiero (kUSD)" />
        <TablaDoc
          encabezados={['Componente', 'Monto']}
          filas={[
            ['Gastos previos', fmtK(val('gastos_previos_k', 0))],
            ['Inversión fija', fmtK(val('inversion_fija_k', 0))],
            ['Capital de trabajo', fmtK(param('capital_trabajo_k'))],
            ['INVERSIÓN TOTAL', fmtK(m.indicadores.inversionTotalKUSD)],
            ['Aportaciones', fmtK(m.indicadores.aportacionesTotalesKUSD)],
            ['Crédito externo', fmtK(param('credito_monto_k'))],
            ['Diferencia de financiación', fmtK(val('diferencia_financiacion_k', 0))],
          ]}
          anchoPrimera="60%"
        />
        <AnalisisDoc modelo={m} clave="inversion_financiacion" titulo="Análisis de inversión y financiación" />

        {p.financiero.deuda.habilitada && param('credito_monto_k') > 0 && (
          <>
            <TablaDoc
              encabezados={['Período', 'Saldo inicial', 'Desembolso', 'Interés devengado', 'Amortización', 'Saldo final']}
              filas={m.deuda.map((f) => [f.anio === 0 ? 'Año 0' : `Año ${f.anio}`, fmtK(f.saldoInicial), fmtK(f.desembolso), fmtK(f.interesDevengado), fmtK(f.amortizacion), fmtK(f.saldoFinal)])}
              anchoPrimera="18%"
            />
            <p className="text-[11px] text-slate-600">
              Gracia: {p.financiero.deuda.tipoGracia === 'total' ? 'total (intereses capitalizados)' : 'de principal (intereses corrientes)'} · Método: {p.financiero.deuda.metodo} · Desembolso: año {p.financiero.deuda.anioDesembolso}. Saldo final = inicial + desembolso + capitalización − amortización.
            </p>
          </>
        )}

        {m.depreciacion.length > 0 && (
          <TablaDoc
            encabezados={['Activo', 'Base depreciable', 'Vida útil', 'Disp. desde', 'Residual', 'Dep. año 1', 'Dep. año 3', 'Dep. año 5', 'Acumulada', 'VNL']}
            filas={m.depreciacion.map((a) => [
              a.concepto,
              fmtK(a.baseDepreciableKUSD),
              `${a.vidaUtilAnios} años`,
              `Año ${a.anioDisponible}`,
              fmtPct(a.valorResidualPct),
              fmtK(a.depreciacion[1] ?? 0),
              fmtK(a.depreciacion[3] ?? 0),
              fmtK(a.depreciacion[5] ?? 0),
              fmtK(a.acumulada),
              fmtK(a.vnl),
            ])}
            anchoPrimera="24%"
          />
        )}
        <AnalisisDoc modelo={m} clave="deuda_depreciacion" titulo="Análisis de deuda y depreciación" />

        <TablaDoc
          encabezados={['Concepto', ...years.map((t) => (t === 0 ? 'Año 0' : `Año ${t}`))]}
          filas={ESTADO_RESULTADOS.flatMap((g) =>
            g.lineas.map((l) => [
              l.etiqueta,
              ...years.map((t) => fmtK(valorLinea(m, p, l.ref, t))),
            ])
          )}
          anchoPrimera="22%"
        />
        <AnalisisDoc modelo={m} clave="ingresos_costos" titulo="Análisis de ingresos, costos y utilidades" />
      </Hoja>

      {/* 4.7.1 Flujos */}
      <Hoja>
        <TituloSeccion num="4.7.1" titulo="Flujos de caja y recuperación de la inversión (kUSD)" />
        <TablaDoc
          encabezados={['Flujo', ...years.map((t) => (t === 0 ? 'Año 0' : `Año ${t}`))]}
          filas={[
            ['Flujo del PROYECTO (FCFF)', ...years.map((t) => fmtK(m.indicadores.fcff[t] ?? 0))],
            ['Flujo acumulado del proyecto', ...years.map((t) => fmtK(m.indicadores.fcffAcumulado[t] ?? 0))],
            ['Flujo de los SOCIOS (FCFE)', ...years.map((t) => fmtK(m.indicadores.fcfe[t] ?? 0))],
            ['Flujo acumulado de los socios', ...years.map((t) => fmtK(m.indicadores.fcfeAcumulado[t] ?? 0))],
          ]}
          anchoPrimera="24%"
        />
        <p className="text-[11px] text-slate-600">
          Recuperación de la inversión total: <b>{recP.anios === null ? 'no recuperada en el horizonte' : `${fmtAnios(recP.anios)} (cruce en el año ${recP.anioCruce})`}</b> por interpolación lineal del FCFF acumulado. Recuperación del capital aportado: <b>{recS.anios === null ? 'no recuperada en el horizonte' : `${fmtAnios(recS.anios)} (cruce en el año ${recS.anioCruce})`}</b> sobre el FCFE acumulado. {(recP.indeterminado || recS.indeterminado) && 'ATENCIÓN: algún acumulado cambia de signo más de una vez: interpretación con cautela. '}
          {Object.values(m.indicadores.capexAmpliaciones).some((v) => v > 0) && `Las ampliaciones del escenario B añaden CAPEX en sus años (${Object.entries(m.indicadores.capexAmpliaciones).filter(([, v]) => v > 0).map(([t, v]) => `año ${t}: ${fmtK(v)}`).join(', ')}). `}
          El capital de trabajo {param('pct_recuperacion_capital_trabajo') > 0 ? `se recupera al ${fmtPct(param('pct_recuperacion_capital_trabajo'))} en el último año (regla parametrizada)` : 'no se recupera (tratamiento conservador)'}.
        </p>
        <AnalisisDoc modelo={m} clave="flujo_recuperacion" titulo="Análisis del flujo de caja y la recuperación" />

        {m.dividendos.length > 0 && (
          <>
            <TablaDoc
              encabezados={['Período', 'UDI', 'Base', 'Reserva', 'Propuestos', 'Pagables', 'Socio nacional', 'Saldo acumulable']}
              filas={m.dividendos.map((d) => [d.anio === 0 ? 'Año 0' : `Año ${d.anio}`, fmtK(d.udi), fmtK(d.base), fmtK(d.reserva), fmtK(d.propuestos), fmtK(d.pagables), fmtK(d.socioNacional), fmtK(d.saldoAcumulable)])}
              anchoPrimera="14%"
            />
            <p className="text-[11px] text-slate-600">Dividendos pagables = MIN(propuestos, caja acumulada FCFE): ningún reparto supera la liquidez modelada. Participación ≠ reparto.</p>
          </>
        )}
      </Hoja>

      {/* 4.8 + 4.9 */}
      <Hoja>
        <TituloSeccion num="4.8" titulo="Análisis o caracterización del mercado" />
        <Parrafo etiqueta="Requisitos regulatorios y registros" valor={p.mercado.requisitosRegulatorios} />
        <Parrafo etiqueta="Materias primas y materiales auxiliares" valor={p.mercado.materiasPrimas} />
        <Parrafo etiqueta="Fuentes de suministro" valor={p.mercado.fuentesSuministro} />
        <Parrafo etiqueta="Demanda aparente" valor={p.mercado.demandaAparente} />
        <Parrafo etiqueta="Demanda solvente" valor={p.mercado.demandaSolvente} />
        <Parrafo etiqueta="Método y fuentes de estimación" valor={`${p.mercado.metodoEstimacion} ${p.mercado.fuentesConsulta}`} />
        <Parrafo etiqueta="Exportaciones / divisas / moneda nacional" valor={`${p.mercado.ventasExportacion} ${p.mercado.ventasDivisas} ${p.mercado.ventasMonedaNacional}`} />
        <AnalisisDoc modelo={m} clave="mercado" titulo="Lectura de los datos de mercado" />
        <TituloSeccion num="4.9" titulo="Fuerza de trabajo" />
        <Parrafo etiqueta="Entidad autorizada a contratar" valor={p.fuerza.entidadContratante} />
        <TablaDoc
          encabezados={['Categoría', 'Operación', 'Salario promedio anual (CUP)']}
          filas={Object.entries(ETIQUETAS_GRUPO).map(([g, et]) => [
            et,
            String(m.indicadores.trabajadoresPorGrupo[g] ?? 0),
            (() => {
              const filas = p.personal.filter((x) => x.etapa === 'operacion' && x.grupo === g);
              const cant = filas.reduce((s, x) => s + x.cantidad, 0);
              return cant ? fmtCUP(filas.reduce((s, x) => s + x.cantidad * x.salarioPromedioAnualCUP, 0) / cant) : '—';
            })(),
          ])}
          anchoPrimera="40%"
        />
        <AnalisisDoc modelo={m} clave="fuerza_trabajo" titulo="Análisis de la fuerza de trabajo" />
      </Hoja>

      {/* 4.10 + 4.11 */}
      <Hoja>
        <TituloSeccion num="4.10" titulo="Inversiones" />
        {p.financiero.inversion.length > 0 && (
          <TablaDoc
            encabezados={['Concepto', 'Categoría', 'Moneda', 'Monto', 'Vida útil', 'Disp. desde', 'Residual']}
            filas={p.financiero.inversion.map((r) => [r.concepto, ETIQUETAS_CATEGORIA_INV[r.categoria], r.moneda, fmtK(r.monto), r.vidaUtilAnios > 0 ? `${r.vidaUtilAnios} años` : '—', r.anioDisponible > 0 ? `Año ${r.anioDisponible}` : '—', r.categoria === 'inversion_fija' ? fmtPct(r.valorResidualPct) : '—'])}
            anchoPrimera="30%"
          />
        )}
        {p.cronograma.length > 0 && (
          <TablaDoc encabezados={['Etapa', 'Inicio', 'Fin']} filas={p.cronograma.map((c) => [c.etapa, mesAnio(c.inicio), mesAnio(c.fin)])} anchoPrimera="44%" />
        )}
        <AnalisisDoc modelo={m} clave="inversiones_cronograma" titulo="Análisis de inversiones y cronograma" />
        <TituloSeccion num="4.11" titulo="Indicadores de beneficios directos al país (kUSD)" />
        <TablaDoc
          encabezados={['Partida (período)', ...years.map((t) => (t === 0 ? 'Año 0' : `Año ${t}`)), 'Total']}
          filas={BENEFICIOS_PAIS.map((l) => [
            `${l.etiqueta} ${l.incluyeAnioCero ? '[incluye año 0]' : '[años 1–N]'}`,
            ...years.map((t) => fmtK(valorLinea(m, p, l.ref, t))),
            fmtK(years.reduce((s, t) => s + valorLinea(m, p, l.ref, t), 0)),
          ])}
          anchoPrimera="22%"
        />
        <p className="text-[11px] text-slate-600">
          Total del período completo: <b>{fmtK(m.indicadores.beneficiosPaisAcumulados)} kUSD</b> (concilia con el resumen y las conclusiones). Subtotal de explotación (años 1–{p.ajustes.horizonteAnios}): <b>{fmtK(m.indicadores.beneficiosPaisExplotacion)} kUSD</b>.
        </p>
        <AnalisisDoc modelo={m} clave="beneficios_pais" titulo="Análisis de los beneficios directos al país" />
      </Hoja>

      {/* 4.12 + notas */}
      <Hoja>
        <TituloSeccion num="4.12" titulo="Conclusiones" />
        <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{p.conclusiones.texto || '—'}</p>
        <AnalisisDoc modelo={m} clave="conclusiones" titulo="Conclusiones (análisis dinámico del modelo)" />
        <TituloSeccion num="" titulo="Notas y supuestos del modelo" />
        <ul className="text-[11px] text-slate-600 space-y-1 list-disc pl-5">
          <li>Tasa del impuesto sobre utilidades: {fmtPct(param('tasa_impuesto_utilidades'))} — supuesto de demostración editable; no constituye la tasa legal aplicable.</li>
          <li>Tipo de cambio: {fmtK(param('tipo_cambio'))} CUP/USD (fecha de referencia: {p.parametros.find((x) => x.id === 'tipo_cambio')?.fechaRef || '—'}); conversión aplicada una sola vez.</li>
          <li>Redondeo: precisión interna completa; el redondeo (miles de USD con un decimal) es solo de presentación.</li>
          <li>Las fórmulas activas del motor, las variables del motor (mtr_*) y su traducción a Excel constan en «Configuración de cálculos» y en la hoja «Reglas» del libro exportado.</li>
          {esDemo && <li className="text-amber-800 font-medium">{ADVERTENCIA_DATOS_FICTICIOS}</li>}
        </ul>
      </Hoja>
    </div>
  );
}
