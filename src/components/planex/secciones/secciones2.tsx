'use client';

// Secciones 4.6 (técnico/operativo) y 4.7 (análisis financiero).
// Las cifras provienen SIEMPRE del motor (props modelo); los parámetros y
// reglas se editan en Configuración de cálculos, con acceso directo desde
// cada partida calculada.

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { TriangleAlert } from 'lucide-react';
import { usePlanex } from '@/lib/planex/store';
import { ComputedModel, ESTADO_RESULTADOS, ETIQUETAS_CATEGORIA_INV } from '@/lib/planex/types';
import { valorLinea } from '@/lib/planex/engine/engine';
import { fmtK, fmtPct, fmtAnios } from '@/lib/planex/format';
import { Seccion, Ayuda, AdvertenciaDemo, Campo, CampoTexto, TablaEditor, CeldaCalculada, Columna, NumInput, GraficoFlujo } from '../comunes';
import { AYUDAS_METODOLOGICAS } from '@/lib/planex/templates/default';
import type { ServicioRow, ConsumoRow, InversionRow } from '@/lib/planex/types';

const ayuda = (clave: string) => AYUDAS_METODOLOGICAS.find((a) => a.clave === clave);

// ---------------------------------------------------------------------------
// 4.6 Técnico
// ---------------------------------------------------------------------------

export function SeccionTecnico({ modelo }: { modelo: ComputedModel }) {
  const p = usePlanex((s) => s.proyecto);
  const actualizar = usePlanex((s) => s.actualizar);
  const { addServicio, updServicio, addConsumo, updConsumo, delFila, moverFila } = usePlanex();
  const setSeccion = usePlanex((s) => s.setSeccion);

  const columnas: Columna<ServicioRow>[] = [
    { titulo: 'Servicio', valor: (s) => s.nombre, onEdit: (s, v) => updServicio(s.id, { nombre: String(v) }), celda: 'min-w-52' },
    { titulo: 'Precio unit. (USD)', tipo: 'numero', ancho: '100px', valor: (s) => String(s.precioBase), onEdit: (s, v) => updServicio(s.id, { precioBase: Number(v) }) },
    { titulo: 'Cant. mensual', tipo: 'numero', ancho: '95px', valor: (s) => String(s.cantidadBaseMensual), onEdit: (s, v) => updServicio(s.id, { cantidadBaseMensual: Number(v) }) },
    { titulo: 'Capacidad máx. mensual', tipo: 'numero', ancho: '110px', valor: (s) => String(s.capacidadMaxMensual), onEdit: (s, v) => updServicio(s.id, { capacidadMaxMensual: Number(v) }) },
    { titulo: 'Costo var. unit. (USD)', tipo: 'numero', ancho: '105px', valor: (s) => String(s.costoVariableUnitario), onEdit: (s, v) => updServicio(s.id, { costoVariableUnitario: Number(v) }) },
    {
      titulo: 'Ingreso año 1',
      calculada: true,
      ancho: '100px',
      valor: (s) => '0',
      render: (s) => {
        const sc = modelo.servicios.find((x) => x.id === s.id);
        const v = sc?.valores[1]?.['srv_ingreso_anual'] ?? 0;
        const excede = sc && sc.capacidadesExcedidas.length > 0;
        return (
          <div className="flex items-center justify-end gap-1">
            {excede && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-amber-600 dark:text-amber-400">
                    <TriangleAlert className="size-3.5" />
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-64 text-xs">Supera la capacidad instalada en los años {sc!.capacidadesExcedidas.join(', ')}</TooltipContent>
              </Tooltip>
            )}
            <CeldaCalculada valor={fmtK(v)} formula="srv_precio_proy * srv_cantidad_anual" alPulsar={() => setSeccion('config')} />
          </div>
        );
      },
    },
    {
      titulo: 'Margen año 1',
      calculada: true,
      ancho: '100px',
      valor: (s) => '0',
      render: (s) => <CeldaCalculada valor={fmtK(modelo.servicios.find((x) => x.id === s.id)?.valores[1]?.['srv_margen_contribucion'] ?? 0)} formula="srv_ingreso_anual - srv_costo_variable_total" alPulsar={() => setSeccion('config')} />,
    },
    { titulo: 'Fuente del supuesto', valor: (s) => s.fuente, onEdit: (s, v) => updServicio(s.id, { fuente: String(v) }), celda: 'min-w-40' },
  ];

  const columnasConsumo: Columna<ConsumoRow>[] = [
    { titulo: 'Concepto', valor: (c) => c.concepto, onEdit: (c, v) => updConsumo(c.id, { concepto: String(v) }), celda: 'min-w-40' },
    { titulo: 'Unidad', valor: (c) => c.unidad, onEdit: (c, v) => updConsumo(c.id, { unidad: String(v) }), ancho: '100px' },
    { titulo: 'Cantidad', tipo: 'numero', ancho: '90px', valor: (c) => String(c.cantidad), onEdit: (c, v) => updConsumo(c.id, { cantidad: Number(v) }) },
    { titulo: 'Período', valor: (c) => c.periodo, onEdit: (c, v) => updConsumo(c.id, { periodo: String(v) }), ancho: '110px' },
    { titulo: 'Observación', valor: (c) => c.observacion, onEdit: (c, v) => updConsumo(c.id, { observacion: String(v) }), celda: 'min-w-32' },
  ];

  const capacidadExcedida = modelo.servicios.filter((s) => s.capacidadesExcedidas.length > 0);

  return (
    <Seccion num="4.6" titulo="Aspectos técnicos y operativos" descripcion="Caracterización, capacidad, tecnologías, localización, infraestructura y consumos. La tabla de servicios alimenta directamente el modelo financiero.">
      <Ayuda titulo={ayuda('tecnico')?.titulo ?? ''} texto={ayuda('tecnico')?.texto ?? ''} />
      <div className="grid gap-4 md:grid-cols-2">
        <Campo etiqueta="Caracterización de bienes y servicios" valor={p.tecnico.caracterizacion} onChange={(v) => actualizar((x) => void (x.tecnico.caracterizacion = v))} filas={4} />
        <Campo etiqueta="Capacidad instalada" valor={p.tecnico.capacidadInstalada} onChange={(v) => actualizar((x) => void (x.tecnico.capacidadInstalada = v))} filas={4} />
        <Campo etiqueta="Plazo para alcanzar los niveles previstos" valor={p.tecnico.plazoNiveles} onChange={(v) => actualizar((x) => void (x.tecnico.plazoNiveles = v))} filas={2} />
        <Campo etiqueta="Tecnologías utilizadas" valor={p.tecnico.tecnologiasActuales} onChange={(v) => actualizar((x) => void (x.tecnico.tecnologiasActuales = v))} filas={2} />
        <Campo etiqueta="Tecnologías a incorporar" valor={p.tecnico.tecnologiasNuevas} onChange={(v) => actualizar((x) => void (x.tecnico.tecnologiasNuevas = v))} filas={3} />
        <CampoTexto etiqueta="Localización" valor={p.tecnico.localizacion} onChange={(v) => actualizar((x) => void (x.tecnico.localizacion = v))} />
        <Campo etiqueta="Infraestructura requerida" valor={p.tecnico.infraestructura} onChange={(v) => actualizar((x) => void (x.tecnico.infraestructura = v))} filas={2} />
        <Campo etiqueta="Terrenos e instalaciones" valor={p.tecnico.terrenosInstalaciones} onChange={(v) => actualizar((x) => void (x.tecnico.terrenosInstalaciones = v))} filas={2} />
        <div className="md:col-span-2">
          <Campo etiqueta="Necesidades de construcción" valor={p.tecnico.necesidadesConstruccion} onChange={(v) => actualizar((x) => void (x.tecnico.necesidadesConstruccion = v))} filas={2} />
        </div>
      </div>

      <TablaEditor
        titulo="Servicios: precios, volúmenes, capacidad y costos variables (motores de ingreso y costo)"
        columnas={columnas}
        filas={p.servicios}
        onAdd={addServicio}
        onDel={(id) => delFila('servicios', id)}
        onMove={(id, d) => moverFila('servicios', id, d)}
        addLabel="Añadir servicio"
        vacio="Sin servicios. Añada filas con precio, volumen, capacidad y costo variable para que el motor calcule ingresos y costos."
      />
      {capacidadExcedida.length > 0 && (
        <div className="rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1">
          <div className="font-semibold flex items-center gap-1.5">
            <TriangleAlert className="size-4" /> Capacidad instalada superada
          </div>
          {capacidadExcedida.map((s) => (
            <div key={s.id}>
              «{s.nombre}» supera la capacidad en los años {s.capacidadesExcedidas.join(', ')}. Revise la capacidad máxima, el crecimiento del volumen o la ocupación.
            </div>
          ))}
        </div>
      )}

      <TablaEditor
        titulo="Estimación de consumos (agua, electricidad, portadores energéticos, residuos)"
        columnas={columnasConsumo}
        filas={p.consumos}
        onAdd={addConsumo}
        onDel={(id) => delFila('consumos', id)}
        addLabel="Añadir consumo"
      />
    </Seccion>
  );
}

// ---------------------------------------------------------------------------
// 4.7 Financiero
// ---------------------------------------------------------------------------

export function SeccionFinanciero({ modelo }: { modelo: ComputedModel }) {
  const p = usePlanex((s) => s.proyecto);
  const actualizar = usePlanex((s) => s.actualizar);
  const { setHorizonte, setOtrosIngresos, addInversion, updInversion, delFila, moverFila, setSeccion } = usePlanex();
  const years = modelo.years;
  const N = p.ajustes.horizonteAnios;
  const val = (id: string, t: number) => modelo.valores[id]?.[t] ?? 0;
  const param = (id: string) => p.parametros.find((x) => x.id === id)?.valor ?? 0;
  const setSeccionConfig = () => setSeccion('config');

  const columnasInv: Columna<InversionRow>[] = [
    { titulo: 'Concepto', valor: (r) => r.concepto, onEdit: (r, v) => updInversion(r.id, { concepto: String(v) }), celda: 'min-w-52' },
    {
      titulo: 'Categoría',
      tipo: 'select',
      ancho: '140px',
      valor: (r) => r.categoria,
      onEdit: (r, v) => updInversion(r.id, { categoria: v as InversionRow['categoria'] }),
      opciones: Object.entries(ETIQUETAS_CATEGORIA_INV).map(([valor, etiqueta]) => ({ valor, etiqueta })),
    },
    {
      titulo: 'Moneda',
      tipo: 'select',
      ancho: '85px',
      valor: (r) => r.moneda,
      onEdit: (r, v) => updInversion(r.id, { moneda: v as 'USD' | 'CUP' }),
      opciones: [
        { valor: 'USD', etiqueta: 'USD' },
        { valor: 'CUP', etiqueta: 'CUP' },
      ],
    },
    { titulo: 'Monto (miles)', tipo: 'numero', ancho: '95px', valor: (r) => String(r.monto), onEdit: (r, v) => updInversion(r.id, { monto: Number(v) }) },
    { titulo: 'Vida útil (años)', tipo: 'numero', ancho: '95px', valor: (r) => String(r.vidaUtilAnios), onEdit: (r, v) => updInversion(r.id, { vidaUtilAnios: Number(v) }) },
    { titulo: 'Observación', valor: (r) => r.observacion, onEdit: (r, v) => updInversion(r.id, { observacion: String(v) }), celda: 'min-w-32' },
  ];

  const dif = val('diferencia_financiacion_k', 0);
  const rec = modelo.indicadores.recuperacionAnios;

  return (
    <Seccion num="4.7" titulo="Análisis financiero" descripcion="Inversión inicial, fuentes de financiamiento, proyección de ingresos, costos y utilidades, flujos de caja y recuperación. Todas las celdas verdes provienen del motor de cálculo configurable.">
      <Ayuda titulo={ayuda('financiero')?.titulo ?? ''} texto={ayuda('financiero')?.texto ?? ''} />

      {/* --- Inversión inicial --- */}
      <TablaEditor
        titulo="Costo total de la inversión inicial (miles, en la moneda indicada; no se suman monedas sin conversión)"
        columnas={columnasInv}
        filas={p.financiero.inversion}
        onAdd={addInversion}
        onDel={(id) => delFila('inversion', id)}
        onMove={(id, d) => moverFila('inversion', id, d)}
        addLabel="Añadir partida de inversión"
        vacio="Sin partidas de inversión. Añada gastos previos e inversión fija con su vida útil."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ['Gastos previos (kUSD)', val('gastos_previos_k', 0)],
          ['Inversión fija (kUSD)', val('inversion_fija_k', 0)],
          ['Capital de trabajo (kUSD)', param('capital_trabajo_k')],
          ['INVERSIÓN TOTAL (kUSD)', val('inversion_total_k', 0)],
        ].map(([et, v], i) => (
          <Card key={String(et)}>
            <CardContent className="pt-4 pb-3 px-4">
              <div className="text-xs text-muted-foreground">{et}</div>
              <CeldaCalculada valor={fmtK(Number(v))} formula={i === 3 ? 'gastos_previos_k + inversion_fija_k + capital_trabajo_k' : 'regla del motor'} alPulsar={setSeccionConfig} />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* --- Financiación --- */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium">Fuentes de financiamiento (kUSD)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Aportaciones', val('aportaciones_total_k', 0), 'SUMA_APORTACIONES(monto_aportacion)'],
              ['Otras fuentes', param('otras_fuentes_k'), 'parámetro otras_fuentes_k'],
              ['Crédito externo', param('credito_monto_k'), 'parámetro credito_monto_k'],
              ['Financiación disponible', val('financiacion_disponible_k', 0), 'aportaciones + otras fuentes + crédito'],
              ['Necesidad de financiación', val('necesidad_financiacion_k', 0), 'inversión − aportaciones − otras fuentes'],
              ['Diferencia', dif, 'disponible − inversión'],
            ].map(([et, v, f]) => (
              <div key={String(et)} className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">{et}</div>
                <CeldaCalculada valor={fmtK(Number(v))} formula={String(f)} alPulsar={setSeccionConfig} />
              </div>
            ))}
          </div>
          <div className="text-xs text-muted-foreground">
            Condiciones del crédito: tasa <b>{fmtPct(param('tasa_interes'))}</b> · gracia <b>{param('periodo_gracia')}</b> año(s) · amortización <b>{param('plazo_amortizacion')}</b> año(s) · tipo de cambio <b>{fmtK(param('tipo_cambio'))} CUP/USD</b>. Todos editables en Configuración de cálculos.
          </div>
          {dif < -0.05 && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              Financiación insuficiente: faltan {fmtK(Math.abs(dif))} kUSD. Aumente las aportaciones, otras fuentes o el crédito.
            </div>
          )}
          {dif > 0.05 && (
            <div className="rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm text-amber-900 dark:text-amber-200">
              Exceso de financiación sin asignar: {fmtK(dif)} kUSD. Verifique si corresponde a capital de trabajo adicional o ajuste las fuentes.
            </div>
          )}
        </CardContent>
      </Card>

      {/* --- Proyecciones --- */}
      <Card>
        <CardHeader className="py-3 flex flex-row items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-sm font-medium">Proyección de ingresos, costos y utilidades (kUSD)</CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Horizonte de análisis</span>
            <NumInput valor={N} onChange={(n) => setHorizonte(n)} className="h-7 w-16" min={1} />
            <span>años</span>
          </div>
        </CardHeader>
        <CardContent className="px-2">
          <div className="overflow-x-auto">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10 min-w-56">Concepto</TableHead>
                  {years.map((t) => (
                    <TableHead key={t} className="text-right min-w-24">
                      {t === 0 ? 'Año 0 (inv.)' : `Año ${t}`}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {ESTADO_RESULTADOS.map((grupo) => (
                  <React.Fragment key={grupo.titulo}>
                    <TableRow>
                      <TableCell colSpan={years.length + 1} className="text-[11px] uppercase tracking-wide text-muted-foreground bg-muted/40 font-semibold">
                        {grupo.titulo}
                      </TableCell>
                    </TableRow>
                    {grupo.lineas.map((linea) => (
                      <TableRow key={linea.id}>
                        <TableCell className={`sticky left-0 bg-background z-10 ${linea.negrita ? 'font-semibold' : ''}`}>{linea.etiqueta}</TableCell>
                        {years.map((t) => {
                          if (linea.ref.tipo === 'entrada') {
                            return (
                              <TableCell key={t} className="px-1">
                                {t === 0 ? (
                                  <div className="text-right text-muted-foreground">—</div>
                                ) : (
                                  <NumInput valor={p.financiero.otrosIngresos[t - 1] ?? 0} onChange={(n) => setOtrosIngresos(t - 1, n)} className="h-8" />
                                )}
                              </TableCell>
                            );
                          }
                          const v = valorLinea(modelo, p, linea.ref, t);
                          const regla = linea.ref.tipo === 'regla' ? p.reglas.find((r) => r.id === linea.ref.id) : undefined;
                          return (
                            <TableCell key={t} className="px-1">
                              <CeldaCalculada
                                valor={fmtK(v)}
                                formula={regla?.expresion ?? `parámetro ${linea.ref.tipo === 'param' ? linea.ref.id : ''}`}
                                alPulsar={setSeccionConfig}
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </React.Fragment>
                ))}
                <TableRow>
                  <TableCell colSpan={years.length + 1} className="text-[11px] uppercase tracking-wide text-muted-foreground bg-muted/40 font-semibold">
                    Servicio de la deuda
                  </TableCell>
                </TableRow>
                {(['amortizacion_k', 'saldo_deuda_k'] as const).map((id) => {
                  const r = p.reglas.find((x) => x.id === id);
                  if (!r) return null;
                  return (
                    <TableRow key={id}>
                      <TableCell className="sticky left-0 bg-background z-10">{r.nombre}</TableCell>
                      {years.map((t) => (
                        <TableCell key={t} className="px-1">
                          <CeldaCalculada valor={fmtK(val(id, t))} formula={r.expresion} alPulsar={setSeccionConfig} />
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* --- Flujo de caja --- */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium">Flujo de caja y recuperación de la inversión</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Período de recuperación</div>
              <CeldaCalculada valor={rec === null ? 'No recuperado en el horizonte' : fmtAnios(rec)} formula="interpolación lineal del flujo acumulado (no la utilidad contable)" alPulsar={setSeccionConfig} />
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Requisito metodológico</div>
              <div className={`px-2 py-1 text-sm font-medium ${rec !== null && N >= Math.ceil(rec + 1) ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {rec === null ? 'Amplíe el horizonte o revise supuestos' : N >= Math.ceil(rec + 1) ? `Cumple: ${N} ≥ recuperación + 1` : `Horizonte insuficiente (≥ ${Math.ceil(rec + 1)} años)`}
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Utilidad neta acumulada</div>
              <CeldaCalculada valor={`${fmtK(modelo.indicadores.utilidadNetaAcumulada)} kUSD`} formula="suma de utilidad después de impuestos" alPulsar={setSeccionConfig} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-52">Concepto</TableHead>
                  {years.map((t) => (
                    <TableHead key={t} className="text-right min-w-24">
                      {t === 0 ? 'Año 0' : `Año ${t}`}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {([
                  ['FLUJO DE CAJA NETO', 'flujo_neto_k'],
                  ['FLUJO DE CAJA ACUMULADO', 'flujo_acumulado_k'],
                  ['Saldo pendiente de recuperar', 'saldo_pendiente_k'],
                ] as const).map(([et, id]) => (
                  <TableRow key={id} className={id === 'flujo_acumulado_k' ? 'font-semibold' : ''}>
                    <TableCell>{et}</TableCell>
                    {years.map((t) => (
                      <TableCell key={t} className="px-1">
                        <CeldaCalculada
                          valor={fmtK(val(id, t))}
                          formula={id === 'flujo_acumulado_k' ? 'IF(PERIODO = 0, flujo_neto_k, LAG(flujo_acumulado_k, 1) + flujo_neto_k)' : id === 'flujo_neto_k' ? 'IF(PERIODO = 0, -inversion_total_k, utilidad_despues_impuestos_k + depreciacion_anual_k - amortizacion_k)' : 'MAX(0, -flujo_acumulado_k)'}
                          alPulsar={setSeccionConfig}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <GraficoFlujo years={years} acumulado={modelo.valores['flujo_acumulado_k'] ?? {}} umbral={modelo.indicadores.inversionTotalKUSD} />
          <div className="flex gap-2 flex-wrap text-xs text-muted-foreground">
            <Badge variant="outline">Año 0 = desembolso de la inversión</Badge>
            <Badge variant="outline">Los flujos se basan en caja, no en utilidad contable</Badge>
          </div>
        </CardContent>
      </Card>

      {p.planex.plantillaOrigen === 'clinica' && <AdvertenciaDemo compacto />}
      <div className="text-xs text-muted-foreground">
        Los parámetros que alimentan estas proyecciones (tasas, crecimiento, canon, públicos, admin…) se editan en «Configuración de cálculos», accesible también desde cualquier celda verde.
      </div>
    </Seccion>
  );
}
