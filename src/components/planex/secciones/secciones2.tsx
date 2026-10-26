'use client';

// Secciones 4.6 (técnico/operativo) y 4.7 (análisis financiero).
// Las cifras provienen SIEMPRE del motor (props modelo); los parámetros y
// reglas se editan en Configuración de cálculos, con acceso directo desde
// cada partida calculada.
//
// Esquema 2.0.0 (misión §5–§8): recursos operativos con escenarios A/B,
// calendario de deuda, depreciación por activo, flujos FCFF/FCFE, dividendos
// con reservas y caja, y análisis narrativos dinámicos por tabla.

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TriangleAlert } from 'lucide-react';
import { usePlanex } from '@/lib/planex/store';
import {
  ComputedModel,
  ESTADO_RESULTADOS,
  ETIQUETAS_CATEGORIA_INV,
  ETIQUETAS_RECURSO,
  ETIQUETAS_METODO_AMORT,
  ETIQUETAS_TIPO_GRACIA,
} from '@/lib/planex/types';
import { valorLinea } from '@/lib/planex/engine/engine';
import { fmtK, fmtPct, fmtAnios } from '@/lib/planex/format';
import { Seccion, Ayuda, AdvertenciaDemo, Campo, CampoTexto, TablaEditor, CeldaCalculada, Columna, NumInput, GraficoFlujo, PanelAnalisis, EnlaceAyuda } from '../comunes';
import { AYUDAS_METODOLOGICAS } from '@/lib/planex/templates/default';
import type { ServicioRow, ConsumoRow, InversionRow, RecursoRow } from '@/lib/planex/types';

const ayuda = (clave: string) => AYUDAS_METODOLOGICAS.find((a) => a.clave === clave);

// ---------------------------------------------------------------------------
// 4.6 Técnico
// ---------------------------------------------------------------------------

export function SeccionTecnico({ modelo }: { modelo: ComputedModel }) {
  const p = usePlanex((s) => s.proyecto);
  const actualizar = usePlanex((s) => s.actualizar);
  const { addServicio, updServicio, toggleRecursoServicio, addConsumo, updConsumo, delFila, moverFila, addRecurso, updRecurso, addExpansion, updExpansion, setEscenarioCapacidad, setSeccion } = usePlanex();
  const umbralUtil = p.parametros.find((x) => x.id === 'umbral_utilizacion_capacidad')?.valor ?? 0.9;

  const columnasServicio: Columna<ServicioRow>[] = [
    { titulo: 'Servicio', valor: (s) => s.nombre, onEdit: (s, v) => updServicio(s.id, { nombre: String(v) }), celda: 'min-w-48' },
    { titulo: 'Precio unit. (USD)', tipo: 'numero', ancho: '90px', valor: (s) => String(s.precioBase), onEdit: (s, v) => updServicio(s.id, { precioBase: Number(v) }) },
    { titulo: 'Demanda mensual (año 1)', tipo: 'numero', ancho: '105px', valor: (s) => String(s.cantidadBaseMensual), onEdit: (s, v) => updServicio(s.id, { cantidadBaseMensual: Number(v) }) },
    { titulo: 'Duración (min)', tipo: 'numero', ancho: '80px', valor: (s) => String(s.duracionMinutos), onEdit: (s, v) => updServicio(s.id, { duracionMinutos: Number(v) }) },
    { titulo: 'Tope directo (0 = solo recursos)', tipo: 'numero', ancho: '115px', valor: (s) => String(s.capacidadMaxMensual), onEdit: (s, v) => updServicio(s.id, { capacidadMaxMensual: Number(v) }) },
    { titulo: 'Costo var. unit. (USD)', tipo: 'numero', ancho: '95px', valor: (s) => String(s.costoVariableUnitario), onEdit: (s, v) => updServicio(s.id, { costoVariableUnitario: Number(v) }) },
    {
      titulo: 'Recursos que ocupa',
      calculada: false,
      ancho: '150px',
      valor: (s) => String(s.recursoIds.length),
      render: (s) => (
        <div className="flex flex-wrap gap-1">
          {p.recursos.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => toggleRecursoServicio(s.id, r.id)}
              className={`rounded-full border px-2 py-0.5 text-[10px] transition-colors ${(s.recursoIds ?? []).includes(r.id) ? 'bg-primary text-primary-foreground border-primary' : 'text-muted-foreground hover:bg-muted'}`}
              title={r.nombre}
            >
              {r.nombre.slice(0, 14)}
            </button>
          ))}
          {!p.recursos.length && <span className="text-[10px] text-muted-foreground">sin recursos definidos</span>}
        </div>
      ),
    },
    {
      titulo: 'Canal (4.8)',
      tipo: 'select',
      ancho: '150px',
      valor: (s) => s.canal ?? 'ninguno',
      opciones: [
        { valor: 'ninguno', etiqueta: 'Sin declarar' },
        { valor: 'plaza', etiqueta: 'Venta en plaza' },
        { valor: 'exportacion', etiqueta: 'Exportación' },
        { valor: 'plataformas_exterior', etiqueta: 'Plataformas (pagos exterior)' },
      ],
      onEdit: (s, v) => updServicio(s.id, { canal: v === 'ninguno' ? undefined : (v as ServicioRow['canal']) }),
    },
    {
      titulo: 'Realizable año 1 / capacidad',
      calculada: true,
      ancho: '140px',
      valor: (s) => '0',
      render: (s) => {
        const sc = modelo.servicios.find((x) => x.id === s.id);
        const cap = modelo.capacidadServicios[s.id]?.[1];
        const limitada = sc && sc.capacidadesExcedidas.length > 0;
        return (
          <div className="flex items-center justify-end gap-1">
            {limitada && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-amber-600 dark:text-amber-400">
                    <TriangleAlert className="size-3.5" />
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-64 text-xs">Demanda no atendible en los años {sc!.capacidadesExcedidas.join(', ')}: el motor limita la producción a la capacidad del escenario activo.</TooltipContent>
              </Tooltip>
            )}
            <CeldaCalculada
              valor={`${fmtK(sc?.valores[1]?.['srv_cantidad_real_mensual'] ?? 0)} / ${cap ? fmtK(cap.capacidadMensual) : '—'}`}
              formula="MIN(demanda proyectada, capacidad del escenario activo)"
              alPulsar={() => setSeccion('config')}
            />
          </div>
        );
      },
    },
    { titulo: 'Fuente del supuesto', valor: (s) => s.fuente, onEdit: (s, v) => updServicio(s.id, { fuente: String(v) }), celda: 'min-w-32' },
  ];

  const columnasRecurso: Columna<RecursoRow>[] = [
    { titulo: 'Recurso', valor: (r) => r.nombre, onEdit: (r, v) => updRecurso(r.id, { nombre: String(v) }), celda: 'min-w-40' },
    {
      titulo: 'Tipo',
      tipo: 'select',
      ancho: '110px',
      valor: (r) => r.tipo,
      onEdit: (r, v) => updRecurso(r.id, { tipo: v as RecursoRow['tipo'] }),
      opciones: Object.entries(ETIQUETAS_RECURSO).map(([valor, etiqueta]) => ({ valor, etiqueta })),
    },
    { titulo: 'Cantidad', tipo: 'numero', ancho: '80px', valor: (r) => String(r.cantidad), onEdit: (r, v) => updRecurso(r.id, { cantidad: Number(v) }) },
    { titulo: 'Horas/día', tipo: 'numero', ancho: '80px', valor: (r) => String(r.horasDia), onEdit: (r, v) => updRecurso(r.id, { horasDia: Number(v) }) },
    { titulo: 'Días/año', tipo: 'numero', ancho: '80px', valor: (r) => String(r.diasAnio), onEdit: (r, v) => updRecurso(r.id, { diasAnio: Number(v) }) },
    { titulo: 'Mantenim. %', tipo: 'numero', ancho: '85px', valor: (r) => String(r.pctMantenimiento), onEdit: (r, v) => updRecurso(r.id, { pctMantenimiento: Number(v) }) },
    { titulo: 'Disp. desde año', tipo: 'numero', ancho: '95px', valor: (r) => String(r.anioDisponible), onEdit: (r, v) => updRecurso(r.id, { anioDisponible: Number(v) }) },
    {
      titulo: 'Ampliaciones (escenario B)',
      calculada: false,
      ancho: '260px',
      valor: (r) => String(r.expansiones.length),
      render: (r) => (
        <div className="space-y-1">
          {r.expansiones.map((e) => (
            <div key={e.id} className="flex items-center gap-1 text-[11px]">
              <NumInput valor={e.anio} onChange={(n) => updExpansion(r.id, e.id, { anio: n })} className="h-6 w-14" min={1} />
              <span className="text-muted-foreground">año, +</span>
              <NumInput valor={e.cantidad} onChange={(n) => updExpansion(r.id, e.id, { cantidad: n })} className="h-6 w-14" />
              <span className="text-muted-foreground">uds,</span>
              <NumInput valor={e.costoKUSD} onChange={(n) => updExpansion(r.id, e.id, { costoKUSD: n })} className="h-6 w-16" />
              <span className="text-muted-foreground">kUSD,</span>
              <NumInput valor={e.vidaUtilAnios} onChange={(n) => updExpansion(r.id, e.id, { vidaUtilAnios: n })} className="h-6 w-14" />
              <span className="text-muted-foreground">vida</span>
              <button type="button" className="text-destructive text-xs px-1" onClick={() => delFila('expansiones', e.id)} aria-label="Eliminar ampliación">
                ×
              </button>
            </div>
          ))}
          <button type="button" className="text-[11px] text-primary underline" onClick={() => addExpansion(r.id)}>
            + ampliación
          </button>
        </div>
      ),
    },
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
    <Seccion num="4.6" titulo="Aspectos técnicos y operativos" descripcion="Caracterización, capacidad DERIVADA de recursos operativos (escenarios A/B), tecnologías, localización, infraestructura y consumos."
      acciones={<EnlaceAyuda articulo="guia-advertencia-capacidad" etiqueta="Cómo interpretar la capacidad" />}>
      <Ayuda titulo={ayuda('tecnico')?.titulo ?? ''} texto={ayuda('tecnico')?.texto ?? ''} />
      <div className="grid gap-4 md:grid-cols-2">
        <Campo etiqueta="Caracterización de bienes y servicios" valor={p.tecnico.caracterizacion} onChange={(v) => actualizar((x) => void (x.tecnico.caracterizacion = v))} filas={4} />
        <Campo etiqueta="Capacidad instalada (descripción de los recursos y su operación)" valor={p.tecnico.capacidadInstalada} onChange={(v) => actualizar((x) => void (x.tecnico.capacidadInstalada = v))} filas={4} />
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

      {/* Escenario de capacidad */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium">Escenario de capacidad (misión §7.3)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <Select value={p.tecnico.escenarioCapacidad} onValueChange={(v) => setEscenarioCapacidad(v as 'A_constante' | 'B_ampliacion')}>
              <SelectTrigger className="w-72 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="A_constante" className="text-xs">A — Capacidad constante (limita la producción a la base instalada)</SelectItem>
                <SelectItem value="B_ampliacion" className="text-xs">B — Ampliación programada (CAPEX y capacidad en sus años)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground flex-1 min-w-64">
              Escenario ACTIVO: <b>{p.tecnico.escenarioCapacidad === 'B_ampliacion' ? 'B (ampliaciones)' : 'A (capacidad constante)'}</b>.{' '}
              {p.tecnico.escenarioCapacidad === 'B_ampliacion'
                ? 'Las ampliaciones de la tabla de recursos generan CAPEX y nueva capacidad desde su año de ejecución.'
                : 'Las ampliaciones definidas quedan IGNORADAS: la demanda no atendible se pierde y se advierte.'}
            </p>
          </div>
        </CardContent>
      </Card>

      <TablaEditor
        titulo="Recursos operativos (la capacidad se deriva de aquí: unidades × horas/día × días/año × (1 − mantenimiento))"
        columnas={columnasRecurso}
        filas={p.recursos}
        onAdd={addRecurso}
        onDel={(id) => delFila('recursos', id)}
        onMove={(id, d) => moverFila('recursos', id, d)}
        addLabel="Añadir recurso"
        vacio="Sin recursos operativos: la capacidad no está limitada por recursos y el diagnóstico lo señala. Defina gabinetes, equipos, profesionales…"
      />

      {/* Utilización de recursos */}
      {modelo.recursosCalculados.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">Utilización de recursos por año (demanda compartida / disponible)</CardTitle>
          </CardHeader>
          <CardContent className="px-2">
            <div className="overflow-x-auto">
              <Table className="min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-40">Recurso</TableHead>
                    {modelo.years.filter((t) => t >= 1).map((t) => (
                      <TableHead key={t} className="text-right">Año {t}</TableHead>
                    ))}
                    <TableHead className="text-right">Máx.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modelo.recursosCalculados.map((r) => {
                    const utilMax = Math.max(...Object.values(r.utilizacion));
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.nombre}</TableCell>
                        {modelo.years.filter((t) => t >= 1).map((t) => (
                          <TableCell key={t} className="text-right">
                            <span className={`tabular-nums text-xs ${utilMax > umbralUtil ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                              {fmtPct(r.utilizacion[t] ?? 0)}
                            </span>
                          </TableCell>
                        ))}
                        <TableCell className="text-right">
                          <span className={`tabular-nums text-xs font-semibold ${utilMax > umbralUtil ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {fmtPct(utilMax)}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Umbral de referencia del análisis: {fmtPct(umbralUtil)} (parámetro «umbral_utilizacion_capacidad», no interviene en ningún cálculo).
            </p>
          </CardContent>
        </Card>
      )}

      <TablaEditor
        titulo="Servicios: precios, demanda prevista, duración, recursos y costos variables (motores de ingreso y costo)"
        columnas={columnasServicio}
        filas={p.servicios}
        onAdd={addServicio}
        onDel={(id) => delFila('servicios', id)}
        onMove={(id, d) => moverFila('servicios', id, d)}
        addLabel="Añadir servicio"
        vacio="Sin servicios. Añada filas con precio, demanda, duración, recursos y costo variable para que el motor calcule ingresos y costos."
      />
      {capacidadExcedida.length > 0 && (
        <div className="rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1">
          <div className="font-semibold flex items-center gap-1.5">
            <TriangleAlert className="size-4" /> Demanda prevista no atendible con la capacidad del escenario activo
          </div>
          {capacidadExcedida.map((s) => (
            <div key={s.id}>
              «{s.nombre}» solo puede atenderse parcialmente en los años {s.capacidadesExcedidas.join(', ')}: el motor ha LIMITADO ingresos y costos a la demanda realmente atendible (escenario B permite programar ampliaciones con su CAPEX).
            </div>
          ))}
        </div>
      )}

      <PanelAnalisis titulo="Análisis de capacidad y servicios" clave="capacidad" modelo={modelo} />

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
  const { setHorizonte, setOtrosIngresos, addInversion, updInversion, delFila, moverFila, updDeuda, setSeccion } = usePlanex();
  const years = modelo.years;
  const N = p.ajustes.horizonteAnios;
  const val = (id: string, t: number) => modelo.valores[id]?.[t] ?? 0;
  const param = (id: string) => p.parametros.find((x) => x.id === id)?.valor ?? 0;
  const setSeccionConfig = () => setSeccion('config');
  const recP = modelo.indicadores.recuperacionProyecto;
  const recS = modelo.indicadores.recuperacionSocios;

  const columnasInv: Columna<InversionRow>[] = [
    { titulo: 'Concepto', valor: (r) => r.concepto, onEdit: (r, v) => updInversion(r.id, { concepto: String(v) }), celda: 'min-w-44' },
    {
      titulo: 'Categoría',
      tipo: 'select',
      ancho: '130px',
      valor: (r) => r.categoria,
      onEdit: (r, v) => updInversion(r.id, { categoria: v as InversionRow['categoria'] }),
      opciones: Object.entries(ETIQUETAS_CATEGORIA_INV).map(([valor, etiqueta]) => ({ valor, etiqueta })),
    },
    {
      titulo: 'Moneda',
      tipo: 'select',
      ancho: '80px',
      valor: (r) => r.moneda,
      onEdit: (r, v) => updInversion(r.id, { moneda: v as 'USD' | 'CUP' }),
      opciones: [
        { valor: 'USD', etiqueta: 'USD' },
        { valor: 'CUP', etiqueta: 'CUP' },
      ],
    },
    { titulo: 'Monto (miles)', tipo: 'numero', ancho: '90px', valor: (r) => String(r.monto), onEdit: (r, v) => updInversion(r.id, { monto: Number(v) }) },
    { titulo: 'Vida útil (años)', tipo: 'numero', ancho: '90px', valor: (r) => String(r.vidaUtilAnios), onEdit: (r, v) => updInversion(r.id, { vidaUtilAnios: Number(v) }) },
    { titulo: 'Disponible desde año', tipo: 'numero', ancho: '105px', valor: (r) => String(r.anioDisponible), onEdit: (r, v) => updInversion(r.id, { anioDisponible: Number(v) }) },
    { titulo: 'Residual %', tipo: 'numero', ancho: '80px', valor: (r) => String(r.valorResidualPct), onEdit: (r, v) => updInversion(r.id, { valorResidualPct: Number(v) }) },
    {
      titulo: 'Depreciación año 1',
      calculada: true,
      ancho: '100px',
      valor: (r) => '0',
      render: (r) => {
        const a = modelo.depreciacion.find((x) => x.id === r.id);
        return <CeldaCalculada valor={fmtK(a?.depreciacion[1] ?? 0)} formula="MIN(cuota lineal, base − acumulada), solo desde el año de disponibilidad" alPulsar={setSeccionConfig} />;
      },
    },
    { titulo: 'Observación', valor: (r) => r.observacion, onEdit: (r, v) => updInversion(r.id, { observacion: String(v) }), celda: 'min-w-32' },
  ];

  const dif = val('diferencia_financiacion_k', 0);

  return (
    <Seccion num="4.7" titulo="Análisis financiero" descripcion="Inversión inicial, financiación, calendario de deuda, depreciación por activo, proyecciones, flujos FCFF/FCFE, recuperación e dividendos. Todas las celdas verdes provienen del motor."
      acciones={<EnlaceAyuda articulo="guia-plan-financiado" etiqueta="¿Cómo sé si el plan está financiado?" />}>
      <Ayuda titulo={ayuda('financiero')?.titulo ?? ''} texto={ayuda('financiero')?.texto ?? ''} />

      {/* --- Inversión inicial --- */}
      <TablaEditor
        titulo="Costo total de la inversión inicial (miles, en la moneda indicada; activos con vida útil, disponibilidad y residual)"
        columnas={columnasInv}
        filas={p.financiero.inversion}
        onAdd={addInversion}
        onDel={(id) => delFila('inversion', id)}
        onMove={(id, d) => moverFila('inversion', id, d)}
        addLabel="Añadir partida de inversión"
        vacio="Sin partidas de inversión. Añada gastos previos e inversión fija con su vida útil y año de disponibilidad."
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

      <PanelAnalisis titulo="Análisis de inversión y financiación" clave="inversion_financiacion" modelo={modelo} />

      {/* --- Cobertura temporal (R2 §1): comprometido vs disponible por período --- */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium">Cobertura temporal de la financiación (kUSD)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Fuentes comprometidas (todo el proyecto)', val('financiacion_disponible_k', 0), 'aportaciones + otras fuentes + crédito (conciliación total)'],
              ['Disponibles con desembolso en el año 0', modelo.arranque.fuentesAnio0, 'aportaciones del año 0 + otras fuentes + crédito desembolsado en el año 0'],
              ['Necesidad total del arranque', modelo.arranque.necesidadTotal, 'inversión total + salidas de caja netas del año 0 (inventario)'],
              ['Brecha temporal del año 0', modelo.arranque.brecha, 'fuentes del año 0 − necesidad total (nominal: ' + fmtK(modelo.arranque.brechaNominal) + ')'],
            ].map(([et, v, f]) => (
              <div key={String(et)} className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">{et}</div>
                <CeldaCalculada valor={fmtK(Number(v))} formula={String(f)} alPulsar={setSeccionConfig} />
              </div>
            ))}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Aportaciones</TableHead>
                <TableHead className="text-right">Otras fuentes</TableHead>
                <TableHead className="text-right">Crédito</TableHead>
                <TableHead className="text-right">Necesidades</TableHead>
                <TableHead className="text-right">Cobertura acum.</TableHead>
                <TableHead className="text-right">Caja proyectada</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {modelo.cobertura.porAnio.map((f) => (
                <TableRow key={f.anio} className={f.cajaProyectada < -0.05 ? 'bg-destructive/10' : undefined}>
                  <TableCell>{f.anio === 0 ? 'Año 0 (montaje)' : `Año ${f.anio}`}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtK(f.aportaciones)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtK(f.otrasFuentes)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtK(f.credito)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtK(f.necesidades)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtK(f.saldoCobertura)}</TableCell>
                  <TableCell className="text-right tabular-nums">{fmtK(f.cajaProyectada)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {modelo.cobertura.deficitCaja.length > 0 ? (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              DÉFICIT TEMPORAL de tesorería:{' '}
              {modelo.cobertura.deficitCaja
                .map((d) => `año ${d.anio}: faltan ${fmtK(d.monto)} kUSD${d.cubiertoEn !== null ? ` (cubiertas desde el año ${d.cubiertoEn})` : ''}`)
                .join('; ')}
              . {modelo.arranque.brechaNominal >= -0.05 ? 'La financiación total cuadra: el problema es de CALENDARIO, no de cuantía.' : 'Además, la financiación total no cubre la necesidad: problema de cuantía y calendario.'}
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-300/60 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-sm text-emerald-900 dark:text-emerald-200">
              Sin déficits temporales: la tesorería proyectada no es negativa en ningún año (las «otras fuentes» se suponen disponibles en el año 0: el parámetro no declara fecha).
            </div>
          )}
        </CardContent>
      </Card>

      {/* --- Calendario de deuda --- */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium">Calendario financiero de la deuda (misión §6)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3 items-end">
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">¿Hay crédito?</span>
              <Select value={p.financiero.deuda.habilitada ? 'si' : 'no'} onValueChange={(v) => updDeuda({ habilitada: v === 'si' })}>
                <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="si" className="text-xs">Sí</SelectItem>
                  <SelectItem value="no" className="text-xs">No</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Año de desembolso</span>
              <NumInput valor={p.financiero.deuda.anioDesembolso} onChange={(n) => updDeuda({ anioDesembolso: Math.max(0, Math.trunc(n)) })} className="h-8 w-20" min={0} />
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Tipo de gracia</span>
              <Select value={p.financiero.deuda.tipoGracia} onValueChange={(v) => updDeuda({ tipoGracia: v as 'principal' | 'total' })}>
                <SelectTrigger className="w-56 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="principal" className="text-xs">{ETIQUETAS_TIPO_GRACIA.principal}</SelectItem>
                  <SelectItem value="total" className="text-xs">{ETIQUETAS_TIPO_GRACIA.total}</SelectItem>
                </SelectContent>
              </Select>
            </label>
            <label className="text-xs space-y-1">
              <span className="text-muted-foreground">Método de amortización</span>
              <Select value={p.financiero.deuda.metodo} onValueChange={(v) => updDeuda({ metodo: v as 'capital_constante' | 'sistema_frances' | 'pago_unico' })}>
                <SelectTrigger className="w-64 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ETIQUETAS_METODO_AMORT).map(([valor, etiqueta]) => (
                    <SelectItem key={valor} value={valor} className="text-xs">{etiqueta}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <p className="text-[11px] text-muted-foreground flex-1 min-w-56">
              Tasa, gracia (años) y plazo se parametrizan en Configuración de cálculos. El calendario verifica saldo final = saldo inicial + desembolso + capitalización − amortización, y ninguna cuota supera el saldo pendiente.
            </p>
          </div>
          {p.financiero.deuda.habilitada && (
            <div className="overflow-x-auto">
              <Table className="min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-right">Saldo inicial</TableHead>
                    <TableHead className="text-right">Desembolso</TableHead>
                    <TableHead className="text-right">Interés devengado</TableHead>
                    <TableHead className="text-right">Interés capitalizado</TableHead>
                    <TableHead className="text-right">Amortización</TableHead>
                    <TableHead className="text-right">Saldo final</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modelo.deuda.map((f) => (
                    <TableRow key={f.anio}>
                      <TableCell>{f.anio === 0 ? 'Año 0 (montaje)' : `Año ${f.anio}`}</TableCell>
                      {[f.saldoInicial, f.desembolso, f.interesDevengado, f.interesCapitalizado, f.amortizacion, f.saldoFinal].map((v, i) => (
                        <TableCell key={i} className="text-right">
                          <CeldaCalculada valor={fmtK(v)} formula="calendario del motor: parámetros del crédito + tipo de gracia + método" alPulsar={setSeccionConfig} />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* --- Depreciación por activo --- */}
      {modelo.depreciacion.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">Depreciación por activo (misión §5) — kUSD</CardTitle>
          </CardHeader>
          <CardContent className="px-2">
            <div className="overflow-x-auto">
              <Table className="min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-44">Activo</TableHead>
                    <TableHead className="text-right">Base depreciable</TableHead>
                    <TableHead className="text-right">Vida útil</TableHead>
                    <TableHead className="text-right">Disp. desde</TableHead>
                    <TableHead className="text-right">Año 1</TableHead>
                    <TableHead className="text-right">Año 2</TableHead>
                    <TableHead className="text-right">Año 3</TableHead>
                    <TableHead className="text-right">Año 5</TableHead>
                    <TableHead className="text-right">Acumulada</TableHead>
                    <TableHead className="text-right">VNL cierre</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modelo.depreciacion.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.concepto}</TableCell>
                      <TableCell className="text-right"><CeldaCalculada valor={fmtK(a.baseDepreciableKUSD)} formula="monto × (1 − residual); CUP convertido al tipo de cambio" /></TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{a.vidaUtilAnios}</TableCell>
                      <TableCell className="text-right tabular-nums text-xs">{a.anioDisponible}</TableCell>
                      {[1, 2, 3, 5].map((t) => (
                        <TableCell key={t} className="text-right"><CeldaCalculada valor={fmtK(a.depreciacion[t] ?? 0)} formula="MIN(base/vida, base − acumulada), solo desde el año de disponibilidad" /></TableCell>
                      ))}
                      <TableCell className="text-right"><CeldaCalculada valor={fmtK(a.acumulada)} formula="suma del calendario" /></TableCell>
                      <TableCell className="text-right"><CeldaCalculada valor={fmtK(a.vnl)} formula="base − acumulada" /></TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold bg-muted/40">
                    <TableCell>TOTAL</TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell />
                    {[1, 2, 3, 5].map((t) => (
                      <TableCell key={t} className="text-right tabular-nums text-xs">{fmtK(modelo.depreciacionTotal[t] ?? 0)}</TableCell>
                    ))}
                    <TableCell />
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              La depreciación de cada activo se limita a su importe depreciable, respeta su vida útil y solo corre desde su año de disponibilidad (un activo no disponible no deprecia). No es desembolso: el flujo de caja la reincorpora una sola vez.
            </p>
          </CardContent>
        </Card>
      )}

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
                      {t === 0 ? 'Año 0 (montaje)' : `Año ${t}`}
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
                    Servicio de la deuda y dividendos (memoria; NO son gasto del estado de resultados)
                  </TableCell>
                </TableRow>
                {(['amortizacion_k', 'saldo_deuda_k', 'dividendos_pagables_k'] as const).map((id) => {
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

      <PanelAnalisis titulo="Análisis de ingresos, costos y utilidades" clave="ingresos_costos" modelo={modelo} />
      <PanelAnalisis titulo="Análisis de deuda y depreciación" clave="deuda_depreciacion" modelo={modelo} />

      {/* --- Flujos de caja FCFF / FCFE --- */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium">Flujos de caja y recuperación: proyecto (FCFF) y socios (FCFE)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Recuperación — inversión total (FCFF)</div>
              <CeldaCalculada valor={recP.anios === null ? 'No recuperada' : fmtAnios(recP.anios)} formula={`FCFF acumulado. ${recP.motivo}`} alPulsar={setSeccionConfig} />
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Recuperación — capital aportado (FCFE)</div>
              <CeldaCalculada valor={recS.anios === null ? 'No recuperada' : fmtAnios(recS.anios)} formula={`FCFE acumulado. ${recS.motivo}`} alPulsar={setSeccionConfig} />
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Requisito metodológico</div>
              <div className={`px-2 py-1 text-sm font-medium ${recP.anios !== null && N >= Math.ceil(recP.anios + 1) ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {recP.anios === null ? 'Sin recuperación: amplíe horizonte o revise supuestos' : N >= Math.ceil(recP.anios + 1) ? `Cumple: ${N} ≥ recuperación + 1` : `Horizonte insuficiente (≥ ${Math.ceil(recP.anios + 1)} años)`}
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">CAPEX de ampliaciones (escenario B)</div>
              <CeldaCalculada valor={`${fmtK(Object.values(modelo.indicadores.capexAmpliaciones).reduce((s, v) => s + v, 0))} kUSD`} formula="suma de las ampliaciones activas" alPulsar={setSeccionConfig} />
            </div>
          </div>
          <div className="overflow-x-auto">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-52">Concepto (kUSD)</TableHead>
                  {years.map((t) => (
                    <TableHead key={t} className="text-right min-w-24">
                      {t === 0 ? 'Año 0' : `Año ${t}`}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {([
                  ['Flujo del PROYECTO (FCFF)', 'flujo_proyecto_k', 'UDI + intereses devengados + depreciación − CAPEX ampliaciones + recuperación CT (año 0: − inversión total)'],
                  ['Flujo acumulado del proyecto', 'flujo_acumulado_proyecto_k', 'IF(PERIODO = 0, flujo_proyecto_k, LAG(…) + flujo_proyecto_k)'],
                  ['Saldo pendiente (inversión total)', 'saldo_pendiente_proyecto_k', 'MAX(0, −acumulado del proyecto)'],
                  ['Flujo de los SOCIOS (FCFE)', 'flujo_socios_k', 'FCFF − interés pagado + desembolso − amortización'],
                  ['Flujo acumulado de los socios', 'flujo_acumulado_socios_k', 'recurrencia LAG'],
                  ['Saldo pendiente (capital aportado)', 'saldo_pendiente_socios_k', 'MAX(0, −acumulado de los socios)'],
                ] as const).map(([et, id, fml]) => (
                  <TableRow key={id} className={id.includes('acumulado') ? 'font-semibold' : ''}>
                    <TableCell>{et}</TableCell>
                    {years.map((t) => (
                      <TableCell key={t} className="px-1">
                        <CeldaCalculada valor={fmtK(val(id, t))} formula={fml} alPulsar={setSeccionConfig} />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <GraficoFlujo years={years} acumulado={modelo.valores['flujo_acumulado_proyecto_k'] ?? {}} umbral={0} fmtEje={fmtK} />
          <div className="flex gap-2 flex-wrap text-xs text-muted-foreground">
            <Badge variant="outline">FCFF: perspectiva del proyecto (excluye financiación)</Badge>
            <Badge variant="outline">FCFE: perspectiva del capital aportado</Badge>
            <Badge variant="outline">Interpolación lineal intranual</Badge>
            {(recP.indeterminado || recS.indeterminado) && <Badge className="bg-amber-500/15 text-amber-700 border-amber-500/40">Flujos no convencionales: interpretar con cautela</Badge>}
          </div>
        </CardContent>
      </Card>

      <PanelAnalisis titulo="Análisis del flujo de caja y la recuperación" clave="flujo_recuperacion" modelo={modelo} />

      {/* --- Dividendos --- */}
      {modelo.dividendos.length > 0 && (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm font-medium">Módulo de dividendos (misión §8) — kUSD</CardTitle>
          </CardHeader>
          <CardContent className="px-2">
            <div className="overflow-x-auto">
              <Table className="min-w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-44">Concepto</TableHead>
                    {years.map((t) => (
                      <TableHead key={t} className="text-right min-w-20">{t === 0 ? 'Año 0' : `Año ${t}`}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {([
                    ['Utilidad después de impuestos', (d) => d.udi, 'regla activa'],
                    ['Saldo acumulable previo', (d) => d.saldoAcumulablePrevio, 'recurrencia'],
                    ['Base distribuible', (d) => d.base, 'MAX(0, UDI + saldo previo)'],
                    ['Reserva', (d) => d.reserva, 'pct_reserva_legal × base'],
                    ['Distribuible', (d) => d.distribuible, 'base − reserva'],
                    ['Dividendos propuestos', (d) => d.propuestos, 'pct_reparto_dividendos × distribuible'],
                    ['Caja acumulada disponible (FCFE)', (d) => d.cajaAcumulada, 'flujo acumulado de los socios'],
                    ['Dividendos PAGABLES', (d) => d.pagables, 'MIN(propuestos, MAX(0, caja))'],
                    ['— socio nacional', (d) => d.socioNacional, 'pagables × participación cubana'],
                    ['— socio extranjero', (d) => d.socioExtranjero, 'pagables × (1 − participación cubana)'],
                  ] as const).map(([et, fn, fml]) => (
                    <TableRow key={et} className={et === 'Dividendos PAGABLES' ? 'font-semibold bg-muted/30' : ''}>
                      <TableCell>{et}</TableCell>
                      {years.map((t) => {
                        const d = modelo.dividendos.find((x) => x.anio === t);
                        return (
                          <TableCell key={t} className="text-right">
                            <CeldaCalculada valor={fmtK(d ? fn(d) : 0)} formula={fml} alPulsar={setSeccionConfig} />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Ningún dividendo supera la caja modelada; los propuestos por encima de la caja quedan restringidos y el diagnóstico lo advierte. La PARTICIPACIÓN (composición del capital) y el REPARTO (fracción distribuible) son conceptos distintos.
            </p>
          </CardContent>
        </Card>
      )}

      {(p.planex.plantillaOrigen === 'clinica' || p.planex.plantillaOrigen === 'centro') && <AdvertenciaDemo compacto />}
      <div className="text-xs text-muted-foreground">
        Los parámetros que alimentan estas proyecciones (tasas, crecimiento, canon, públicos, admin, reserva, recuperación del capital de trabajo…) se editan en «Configuración de cálculos», accesible también desde cualquier celda verde.
      </div>
    </Seccion>
  );
}
