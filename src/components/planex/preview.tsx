'use client';

// Vista previa documental: representación de lectura (hojas tamaño carta,
// fondo claro constante) del plan vigente. No es una captura de la interfaz
// de edición: los datos provienen del motor activo.

import * as React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { usePlanex } from '@/lib/planex/store';
import { ComputedModel, ESTADO_RESULTADOS, BENEFICIOS_PAIS, ETIQUETAS_APORTACION, ETIQUETAS_CATEGORIA_INV, ETIQUETAS_GRUPO, ADVERTENCIA_DATOS_FICTICIOS, DECLARACION_RESPONSABILIDAD } from '@/lib/planex/types';
import { valorLinea } from '@/lib/planex/engine/engine';
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

export function VistaPrevia({ abierto, cerrar, modelo }: { abierto: boolean; cerrar: () => void; modelo: ComputedModel }) {
  const p = usePlanex((s) => s.proyecto);
  const m = modelo;
  const esDemo = p.planex.plantillaOrigen === 'clinica';
  const years = m.years;
  const val = (id: string, t: number) => m.valores[id]?.[t] ?? 0;
  const param = (id: string) => p.parametros.find((x) => x.id === id)?.valor ?? 0;

  const imprimir = () => window.print();

  return (
    <Dialog open={abierto} onOpenChange={(o) => !o && cerrar()}>
      <DialogContent className="max-w-[900px] w-[94vw] h-[90vh] overflow-y-auto print:h-auto print:overflow-visible print:max-w-none print:w-auto p-0">
        <DialogHeader className="px-6 pt-6 pb-2 print:hidden sticky top-0 bg-background z-10 border-b">
          <DialogTitle className="flex items-center justify-between gap-3 flex-wrap">
            <span>Previsualización del plan</span>
            <Button variant="outline" size="sm" onClick={imprimir} className="gap-1.5">
              <Printer className="size-4" /> Imprimir
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="px-4 pb-8 print:p-0">
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
              <div><b>Inversión total:</b> {fmtK(m?.indicadores.inversionTotalKUSD ?? 0)} miles de USD</div>
              <div><b>Horizonte de análisis:</b> {p.ajustes.horizonteAnios} años</div>
              <div><b>Período de recuperación:</b> {m?.indicadores.recuperacionAnios == null ? 'no recuperado en el horizonte' : fmtAnios(m.indicadores.recuperacionAnios)}</div>
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
              {['4.1 Información general', '4.2 Título', '4.3 Índice', '4.4 Resumen ejecutivo', '4.5 Descripción del negocio', '4.6 Aspectos técnicos y operativos', '4.7 Análisis financiero', '4.8 Análisis o caracterización del mercado', '4.9 Fuerza de trabajo', '4.10 Inversiones', '4.11 Indicadores de beneficios directos al país', '4.12 Conclusiones', 'Notas y supuestos del modelo'].map((s) => (
                <li key={s} className="font-medium">{s}</li>
              ))}
            </ol>
            <p className="text-[11px] text-slate-500 mt-4">La numeración de páginas definitiva se genera en la exportación PDF.</p>
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
                ['Aportaciones (kUSD)', fmtK(val('aportaciones_total_k', 0))],
                ['Ingresos totales año 1 (kUSD)', fmtK(m.indicadores.ingresosTotales[1] ?? 0)],
                ['Utilidad después de impuestos año 1 (kUSD)', fmtK(m.indicadores.utilidadNeta[1] ?? 0)],
                ['Período de recuperación', m.indicadores.recuperacionAnios === null ? 'No recuperado' : fmtAnios(m.indicadores.recuperacionAnios)],
                ['Beneficios al país acumulados (kUSD)', fmtK(m.indicadores.beneficiosPaisAcumulados)],
                ['Empleos en operación', String(m.indicadores.totalTrabajadores)],
                ['Salario promedio anual', m.indicadores.salarioPromedioAnualCUP === null ? '—' : fmtCUP(m.indicadores.salarioPromedioAnualCUP)],
              ]}
              anchoPrimera="60%"
            />
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
            {p.aportaciones.length > 0 && (
              <TablaDoc
                encabezados={['Socio', 'Tipo de aporte', 'Año 1', 'Año 2', 'Año 3', 'Total']}
                filas={p.aportaciones.map((a) => [
                  a.socio === 'nacional' ? 'Nacional' : 'Extranjero',
                  ETIQUETAS_APORTACION[a.tipo],
                  ...a.montos.map((mm) => fmtK(mm)),
                  fmtK(a.montos.reduce((s, mm) => s + mm, 0)),
                ])}
              />
            )}
          </Hoja>

          {/* 4.6 */}
          <Hoja>
            <TituloSeccion num="4.6" titulo="Aspectos técnicos y operativos" />
            <Parrafo etiqueta="Caracterización" valor={p.tecnico.caracterizacion} />
            <Parrafo etiqueta="Capacidad instalada" valor={p.tecnico.capacidadInstalada} />
            <Parrafo etiqueta="Plazo para alcanzar los niveles previstos" valor={p.tecnico.plazoNiveles} />
            <Parrafo etiqueta="Tecnologías actuales" valor={p.tecnico.tecnologiasActuales} />
            <Parrafo etiqueta="Tecnologías a incorporar" valor={p.tecnico.tecnologiasNuevas} />
            <Parrafo etiqueta="Localización" valor={p.tecnico.localizacion} />
            <Parrafo etiqueta="Infraestructura" valor={p.tecnico.infraestructura} />
            {p.servicios.length > 0 && m && (
              <TablaDoc
                encabezados={['Servicio', 'Precio (USD)', 'Cant./mes', 'Capacidad', 'CVU (USD)', 'Ingreso año 1 (USD)']}
                filas={p.servicios.map((s) => [
                  s.nombre,
                  fmtK(s.precioBase),
                  s.cantidadBaseMensual,
                  s.capacidadMaxMensual,
                  fmtK(s.costoVariableUnitario),
                  fmtK(m.servicios.find((x) => x.id === s.id)?.valores[1]?.['srv_ingreso_anual'] ?? 0),
                ])}
                anchoPrimera="34%"
              />
            )}
            {p.consumos.length > 0 && (
              <TablaDoc encabezados={['Concepto', 'Unidad', 'Cantidad', 'Período']} filas={p.consumos.map((c) => [c.concepto, c.unidad, c.cantidad, c.periodo])} anchoPrimera="40%" />
            )}
          </Hoja>

          {/* 4.7 */}
          <Hoja>
            <TituloSeccion num="4.7" titulo="Análisis financiero (kUSD)" />
            {m && (
              <>
                <TablaDoc
                  encabezados={['Componente', 'Monto']}
                  filas={[
                    ['Gastos previos', fmtK(val('gastos_previos_k', 0))],
                    ['Inversión fija', fmtK(val('inversion_fija_k', 0))],
                    ['Capital de trabajo', fmtK(param('capital_trabajo_k'))],
                    ['INVERSIÓN TOTAL', fmtK(m.indicadores.inversionTotalKUSD)],
                    ['Aportaciones', fmtK(val('aportaciones_total_k', 0))],
                    ['Crédito externo', fmtK(param('credito_monto_k'))],
                    ['Diferencia de financiación', fmtK(val('diferencia_financiacion_k', 0))],
                  ]}
                  anchoPrimera="60%"
                />
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
                <TablaDoc
                  encabezados={['Flujo', ...years.map((t) => (t === 0 ? 'Año 0' : `Año ${t}`))]}
                  filas={[
                    ['FLUJO NETO', ...years.map((t) => fmtK(val('flujo_neto_k', t)))],
                    ['FLUJO ACUMULADO', ...years.map((t) => fmtK(val('flujo_acumulado_k', t)))],
                    ['Saldo pendiente', ...years.map((t) => fmtK(val('saldo_pendiente_k', t)))],
                  ]}
                  anchoPrimera="22%"
                />
                <p className="text-[11px] text-slate-600">
                  Recuperación: <b>{m.indicadores.recuperacionAnios === null ? 'no recuperado en el horizonte' : fmtAnios(m.indicadores.recuperacionAnios)}</b> (interpolación del flujo acumulado). Impuesto sobre utilidades con regla demostrativa: tasa {fmtPct(param('tasa_impuesto_utilidades'))} editable; no constituye la tasa legal aplicable.
                </p>
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
            <TituloSeccion num="4.9" titulo="Fuerza de trabajo" />
            <Parrafo etiqueta="Entidad autorizada a contratar" valor={p.fuerza.entidadContratante} />
            {m && (
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
            )}
          </Hoja>

          {/* 4.10 + 4.11 */}
          <Hoja>
            <TituloSeccion num="4.10" titulo="Inversiones" />
            {p.financiero.inversion.length > 0 && (
              <TablaDoc
                encabezados={['Concepto', 'Categoría', 'Moneda', 'Monto', 'Vida útil']}
                filas={p.financiero.inversion.map((r) => [r.concepto, ETIQUETAS_CATEGORIA_INV[r.categoria], r.moneda, fmtK(r.monto), r.vidaUtilAnios > 0 ? `${r.vidaUtilAnios} años` : '—'])}
                anchoPrimera="40%"
              />
            )}
            {p.cronograma.length > 0 && (
              <TablaDoc encabezados={['Etapa', 'Inicio', 'Fin']} filas={p.cronograma.map((c) => [c.etapa, mesAnio(c.inicio), mesAnio(c.fin)])} anchoPrimera="44%" />
            )}
            <TituloSeccion num="4.11" titulo="Indicadores de beneficios directos al país (kUSD)" />
            {m && (
              <TablaDoc
                encabezados={['Partida', ...years.map((t) => (t === 0 ? 'Año 0' : `Año ${t}`)), 'Total']}
                filas={BENEFICIOS_PAIS.map((l) => [l.etiqueta, ...years.map((t) => fmtK(valorLinea(m, p, l.ref, t))), fmtK(years.reduce((s, t) => s + valorLinea(m, p, l.ref, t), 0))])}
                anchoPrimera="24%"
              />
            )}
          </Hoja>

          {/* 4.12 + notas */}
          <Hoja>
            <TituloSeccion num="4.12" titulo="Conclusiones" />
            <p className="text-[13px] leading-relaxed whitespace-pre-wrap">{p.conclusiones.texto || '—'}</p>
            <TituloSeccion num="" titulo="Notas y supuestos del modelo" />
            <ul className="text-[11px] text-slate-600 space-y-1 list-disc pl-5">
              <li>Tasa del impuesto sobre utilidades: {fmtPct(param('tasa_impuesto_utilidades'))} — supuesto de demostración editable; no constituye la tasa legal aplicable.</li>
              <li>Tipo de cambio: {fmtK(param('tipo_cambio'))} CUP/USD (fecha de referencia: {p.parametros.find((x) => x.id === 'tipo_cambio')?.fechaRef || '—'}).</li>
              <li>Las fórmulas activas del motor y su traducción a Excel constan en la sección «Configuración de cálculos» y en la hoja «Reglas» del libro exportado.</li>
              {esDemo && <li className="text-amber-800 font-medium">{ADVERTENCIA_DATOS_FICTICIOS}</li>}
            </ul>
          </Hoja>
        </div>
      </DialogContent>
    </Dialog>
  );
}
