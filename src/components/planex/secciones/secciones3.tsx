'use client';

// Secciones 4.8–4.12: mercado, fuerza de trabajo, inversiones (con cronograma),
// beneficios directos al país y conclusiones.

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sparkles } from 'lucide-react';
import { usePlanex } from '@/lib/planex/store';
import { ComputedModel, BENEFICIOS_PAIS, ETIQUETAS_GRUPO } from '@/lib/planex/types';
import { valorLinea } from '@/lib/planex/engine/engine';
import { fmtK, fmtCUP, fmtAnios, mesAnio } from '@/lib/planex/format';
import { Seccion, Ayuda, AdvertenciaDemo, Campo, CampoTexto, TablaEditor, CeldaCalculada, Columna, NumInput } from '../comunes';
import { AYUDAS_METODOLOGICAS } from '@/lib/planex/templates/default';
import type { PersonalRow, VehiculoRow, CronogramaRow } from '@/lib/planex/types';

const ayuda = (clave: string) => AYUDAS_METODOLOGICAS.find((a) => a.clave === clave);

// ---------------------------------------------------------------------------
// 4.8 Mercado
// ---------------------------------------------------------------------------

export function SeccionMercado() {
  const p = usePlanex((s) => s.proyecto);
  const actualizar = usePlanex((s) => s.actualizar);
  const campos: [string, keyof typeof p.mercado, number][] = [
    ['Caracterización de productos y servicios', 'caracterizacion', 3],
    ['Requisitos regulatorios y registros necesarios', 'requisitosRegulatorios', 3],
    ['Materias primas y materiales auxiliares', 'materiasPrimas', 3],
    ['Fuentes y ubicación de los suministros', 'fuentesSuministro', 3],
    ['Consumo estimado', 'consumoEstimado', 2],
    ['Demanda aparente', 'demandaAparente', 2],
    ['Demanda solvente', 'demandaSolvente', 2],
    ['Método de estimación', 'metodoEstimacion', 2],
    ['Fuentes consultadas (documentar fechas)', 'fuentesConsulta', 2],
    ['Comercialización: exportaciones', 'ventasExportacion', 2],
    ['Comercialización: ventas en divisas', 'ventasDivisas', 2],
    ['Comercialización: ventas en moneda nacional', 'ventasMonedaNacional', 2],
  ];
  return (
    <Seccion num="4.8" titulo="Análisis o caracterización del mercado" descripcion="Regulación, suministros, demanda y dirección de las ventas. Documente fuentes, fechas y métodos: no presente supuestos como hechos demostrados.">
      <Ayuda titulo={ayuda('mercado')?.titulo ?? ''} texto={ayuda('mercado')?.texto ?? ''} />
      <div className="grid gap-4 md:grid-cols-2">
        {campos.map(([etiqueta, clave, filas]) => (
          <Campo
            key={clave}
            etiqueta={etiqueta}
            valor={p.mercado[clave]}
            onChange={(v) => actualizar((x) => void ((x.mercado[clave] as string) = v))}
            filas={filas}
          />
        ))}
      </div>
    </Seccion>
  );
}

// ---------------------------------------------------------------------------
// 4.9 Fuerza de trabajo
// ---------------------------------------------------------------------------

export function SeccionFuerza({ modelo }: { modelo: ComputedModel }) {
  const p = usePlanex((s) => s.proyecto);
  const actualizar = usePlanex((s) => s.actualizar);
  const { addPersonal, updPersonal, delFila, setSeccion } = usePlanex();

  const columnas: Columna<PersonalRow>[] = [
    {
      titulo: 'Etapa',
      tipo: 'select',
      ancho: '130px',
      valor: (r) => r.etapa,
      onEdit: (r, v) => updPersonal(r.id, { etapa: v as PersonalRow['etapa'] }),
      opciones: [
        { valor: 'montaje', etiqueta: 'Montaje (año 0)' },
        { valor: 'operacion', etiqueta: 'Operación (años 1+)' },
      ],
    },
    {
      titulo: 'Categoría',
      tipo: 'select',
      ancho: '190px',
      valor: (r) => r.grupo,
      onEdit: (r, v) => updPersonal(r.id, { grupo: v as PersonalRow['grupo'] }),
      opciones: Object.entries(ETIQUETAS_GRUPO).map(([valor, etiqueta]) => ({ valor, etiqueta })),
    },
    { titulo: 'Cantidad', tipo: 'numero', ancho: '80px', valor: (r) => String(r.cantidad), onEdit: (r, v) => updPersonal(r.id, { cantidad: Number(v) }) },
    { titulo: 'Salario promedio anual (CUP)', tipo: 'numero', ancho: '150px', valor: (r) => String(r.salarioPromedioAnualCUP), onEdit: (r, v) => updPersonal(r.id, { salarioPromedioAnualCUP: Number(v) }) },
  ];

  const grupos = Object.keys(ETIQUETAS_GRUPO) as (keyof typeof ETIQUETAS_GRUPO)[];

  return (
    <Seccion num="4.9" titulo="Fuerza de trabajo" descripcion="Cubanos y extranjeros, directivos y otros trabajadores, subtotales, salario promedio anual en CUP y costo laboral vinculado al modelo financiero.">
      <Ayuda titulo={ayuda('fuerza')?.titulo ?? ''} texto={ayuda('fuerza')?.texto ?? ''} />
      <CampoTexto etiqueta="Entidad autorizada a contratar la fuerza de trabajo" valor={p.fuerza.entidadContratante} onChange={(v) => actualizar((x) => void (x.fuerza.entidadContratante = v))} />
      <TablaEditor
        titulo="Trabajadores por categoría y etapa de contratación"
        columnas={columnas}
        filas={p.personal}
        onAdd={addPersonal}
        onDel={(id) => delFila('personal', id)}
        addLabel="Añadir categoría"
        vacio="Sin personal definido: el costo laboral de la proyección será cero."
      />
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium">Subtotales (calculados) y costo laboral</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="overflow-x-auto">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-52">Categoría</TableHead>
                  <TableHead className="text-right">Etapa montaje (año 0)</TableHead>
                  <TableHead className="text-right">Etapa operación (años 1+)</TableHead>
                  <TableHead className="text-right min-w-32">Salario promedio anual (CUP)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grupos.map((g) => {
                  const montaje = p.personal.filter((r) => r.grupo === g && r.etapa === 'montaje');
                  const operacion = p.personal.filter((r) => r.grupo === g && r.etapa === 'operacion');
                  const cantM = montaje.reduce((s, r) => s + r.cantidad, 0);
                  const cantO = operacion.reduce((s, r) => s + r.cantidad, 0);
                  const prom = operacion.length ? operacion.reduce((s, r) => s + r.cantidad * r.salarioPromedioAnualCUP, 0) / Math.max(1, cantO) : 0;
                  return (
                    <TableRow key={g}>
                      <TableCell>{ETIQUETAS_GRUPO[g]}</TableCell>
                      <TableCell className="text-right tabular-nums">{cantM || '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{cantO || '—'}</TableCell>
                      <TableCell>
                        <CeldaCalculada valor={prom ? fmtCUP(prom) : '—'} formula="Σ(cantidad × salario) / Σ(cantidad)" alPulsar={() => setSeccion('config')} />
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className="font-semibold">
                  <TableCell>TOTAL</TableCell>
                  <TableCell className="text-right tabular-nums">{modelo.indicadores.trabajadoresMontaje || '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{modelo.indicadores.totalTrabajadores}</TableCell>
                  <TableCell>
                    <CeldaCalculada valor={modelo.indicadores.salarioPromedioAnualCUP === null ? '—' : fmtCUP(modelo.indicadores.salarioPromedioAnualCUP)} formula="salario promedio ponderado" alPulsar={() => setSeccion('config')} />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Badge variant="outline">Cubanos: {modelo.indicadores.cubanos}</Badge>
            <Badge variant="outline">Extranjeros: {modelo.indicadores.extranjeros}</Badge>
            <Badge variant="outline">
              Costo laboral año 1: {fmtK(modelo.valores['costo_laboral_k']?.[1] ?? 0)} kUSD (regla: SUMA_PERSONAL(cantidad × salario_anual_proy) × factor / tipo_cambio / 1000)
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Seccion>
  );
}

// ---------------------------------------------------------------------------
// 4.10 Inversiones
// ---------------------------------------------------------------------------

export function SeccionInversiones() {
  const p = usePlanex((s) => s.proyecto);
  const { addVehiculo, updVehiculo, addCronograma, updCronograma, delFila } = usePlanex();

  const columnasVeh: Columna<VehiculoRow>[] = [
    { titulo: 'Tipo de vehículo', valor: (r) => r.tipo, onEdit: (r, v) => updVehiculo(r.id, { tipo: String(v) }), celda: 'min-w-56' },
    { titulo: 'Cantidad', tipo: 'numero', ancho: '90px', valor: (r) => String(r.cantidad), onEdit: (r, v) => updVehiculo(r.id, { cantidad: Number(v) }) },
    { titulo: 'Monto estimado (kUSD)', tipo: 'numero', ancho: '130px', valor: (r) => String(r.montoKUSD), onEdit: (r, v) => updVehiculo(r.id, { montoKUSD: Number(v) }) },
  ];

  const columnasCro: Columna<CronogramaRow>[] = [
    { titulo: 'Etapa', valor: (r) => r.etapa, onEdit: (r, v) => updCronograma(r.id, { etapa: String(v) }), celda: 'min-w-56' },
    { titulo: 'Inicio (aaaa-mm)', valor: (r) => r.inicio, onEdit: (r, v) => updCronograma(r.id, { inicio: String(v) }), ancho: '110px' },
    { titulo: 'Fin (aaaa-mm)', valor: (r) => r.fin, onEdit: (r, v) => updCronograma(r.id, { fin: String(v) }), ancho: '110px' },
    { titulo: 'Observación', valor: (r) => r.observacion, onEdit: (r, v) => updCronograma(r.id, { observacion: String(v) }), celda: 'min-w-32' },
  ];

  return (
    <Seccion num="4.10" titulo="Inversiones" descripcion="Las partidas de inversión (construcción y montaje, maquinaria y equipos, otros e inducidas) se gestionan en 4.7; aquí se completa el desglose de vehículos y el cronograma inversionista.">
      <Ayuda titulo={ayuda('inversiones')?.titulo ?? ''} texto={ayuda('inversiones')?.texto ?? ''} />
      <TablaEditor titulo="Desglose de vehículos por tipo, cantidad y monto estimado" columnas={columnasVeh} filas={p.financiero.vehiculos} onAdd={addVehiculo} onDel={(id) => delFila('vehiculos', id)} addLabel="Añadir vehículo" />
      <TablaEditor
        titulo="Cronograma: preinversión, ejecución, desactivación e inicio de explotación, pruebas y puesta en marcha"
        columnas={columnasCro}
        filas={p.cronograma}
        onAdd={addCronograma}
        onDel={(id) => delFila('cronograma', id)}
        addLabel="Añadir etapa"
      />
      {p.cronograma.length > 0 && (
        <Card>
          <CardContent className="pt-6 space-y-2">
            {p.cronograma.map((c) => (
              <div key={c.id} className="flex items-center gap-3 text-sm">
                <div className="w-56 shrink-0 truncate" title={c.etapa}>
                  {c.etapa}
                </div>
                <div className="flex-1 h-5 rounded bg-muted relative overflow-hidden">
                  {(() => {
                    const anios = p.cronograma.flatMap((x) => [Number(x.inicio.slice(0, 4)), Number(x.fin.slice(0, 4))]).filter((n) => Number.isFinite(n));
                    const min = Math.min(...anios, 2026);
                    const max = Math.max(...anios, 2027);
                    const ini = Number(c.inicio.slice(0, 4)) + (Number(c.inicio.slice(5, 7)) || 1) / 12;
                    const fin = Number(c.fin.slice(0, 4)) + (Number(c.fin.slice(5, 7)) || 12) / 12;
                    const izq = ((ini - min) / Math.max(1, max - min)) * 100;
                    const ancho = Math.max(3, ((fin - ini) / Math.max(1, max - min)) * 100);
                    return <div className="absolute top-0.5 bottom-0.5 rounded bg-primary/70" style={{ left: `${izq}%`, width: `${ancho}%` }} title={`${mesAnio(c.inicio)} → ${mesAnio(c.fin)}`} />;
                  })()}
                </div>
                <div className="text-xs text-muted-foreground w-28 text-right">
                  {mesAnio(c.inicio)} → {mesAnio(c.fin)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </Seccion>
  );
}

// ---------------------------------------------------------------------------
// 4.11 Beneficios al país
// ---------------------------------------------------------------------------

export function SeccionBeneficios({ modelo }: { modelo: ComputedModel }) {
  const p = usePlanex((s) => s.proyecto);
  const setSeccion = usePlanex((s) => s.setSeccion);
  const years = modelo.years;
  const rec = modelo.indicadores.recuperacionAnios;
  const N = p.ajustes.horizonteAnios;

  return (
    <Seccion num="4.11" titulo="Indicadores de beneficios directos al país" descripcion="Por año: impuestos, dividendos de la parte cubana, aranceles, pagos por fuerza de trabajo, canon, royalties y otros. Partidas vinculadas al modelo sin doble contabilización.">
      <Ayuda titulo={ayuda('beneficios')?.titulo ?? ''} texto={ayuda('beneficios')?.texto ?? ''} />
      <Card>
        <CardContent className="px-2">
          <div className="overflow-x-auto">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10 min-w-56">Partida</TableHead>
                  {years.map((t) => (
                    <TableHead key={t} className="text-right min-w-24">
                      {t === 0 ? 'Año 0' : `Año ${t}`}
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {BENEFICIOS_PAIS.map((linea) => (
                  <TableRow key={linea.id} className={linea.negrita ? 'font-semibold' : ''}>
                    <TableCell className="sticky left-0 bg-background z-10">{linea.etiqueta}</TableCell>
                    {years.map((t) => (
                      <TableCell key={t} className="px-1">
                        <CeldaCalculada
                          valor={fmtK(valorLinea(modelo, p, linea.ref, t))}
                          formula={linea.ref.tipo === 'regla' ? (p.reglas.find((r) => r.id === linea.ref.id)?.expresion ?? '') : `parámetro ${linea.ref.id}`}
                          alPulsar={() => setSeccion('config')}
                        />
                      </TableCell>
                    ))}
                    <TableCell className="px-1">
                      <CeldaCalculada valor={fmtK(years.reduce((s, t) => s + valorLinea(modelo, p, linea.ref, t), 0))} formula="suma del período" alPulsar={() => setSeccion('config')} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <div className={`rounded-lg border p-3 text-sm ${rec !== null && N >= Math.ceil(rec + 1) ? 'border-emerald-300/60 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300' : 'border-amber-300/60 bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200'}`}>
        Período de análisis: {N} años {rec !== null ? `(recuperación ${fmtAnios(rec)}; requisito ≥ recuperación + 1 ${N >= Math.ceil(rec + 1) ? 'cumplido' : 'PENDIENTE de ampliar'})` : '— la inversión no se recupera en el horizonte'}. Beneficios acumulados: <b>{fmtK(modelo.indicadores.beneficiosPaisAcumulados)} kUSD</b>, de los cuales impuestos sobre utilidades: {fmtK(modelo.indicadores.impuestosTotales)} kUSD.
      </div>
    </Seccion>
  );
}

// ---------------------------------------------------------------------------
// 4.12 Conclusiones
// ---------------------------------------------------------------------------

export function SeccionConclusiones({ modelo }: { modelo: ComputedModel }) {
  const p = usePlanex((s) => s.proyecto);
  const actualizar = usePlanex((s) => s.actualizar);
  const ind = modelo.indicadores;

  const generarBorrador = () => {
    const rec = ind.recuperacionAnios;
    const texto = [
      `El modelo financiero activo proyecta una inversión total de ${fmtK(ind.inversionTotalKUSD)} miles de USD y un horizonte de análisis de ${p.ajustes.horizonteAnios} años.`,
      rec === null
        ? 'Con los supuestos actuales, la inversión no se recupera dentro del horizonte de análisis, por lo que la viabilidad preliminar no puede sostenerse y deben revisarse precios, volúmenes, costos o el propio alcance del proyecto.'
        : `El flujo de caja acumulado recupera la inversión en aproximadamente ${fmtAnios(rec)}, manteniéndose el horizonte de análisis un año o más por encima de la recuperación, como exige la metodología.`,
      `La utilidad después de impuestos acumulada en el período asciende a ${fmtK(ind.utilidadNetaAcumulada)} miles de USD y los beneficios directos al país acumulados a ${fmtK(ind.beneficiosPaisAcumulados)} miles de USD, incluyendo ${fmtK(ind.impuestosTotales)} por impuesto sobre utilidades conforme a la regla activa.`,
      `La propuesta contempla ${ind.totalTrabajadores} empleos directos en operación (${ind.cubanos} cubanos y ${ind.extranjeros} extranjeros) con un salario promedio anual de ${fmtCUP(ind.salarioPromedioAnualCUP ?? 0)}.`,
      'Estas conclusiones son preliminares y editables: no debe declararse viable un proyecto solo porque presente beneficios contables en un año. Quedan pendientes de validación la demanda solvente, los precios, los costos, la tasa tributaria aplicable y los requisitos legales, sanitarios y de inversión correspondientes.',
    ].join(' ');
    actualizar((x) => void (x.conclusiones.texto = texto));
  };

  return (
    <Seccion
      num="4.12"
      titulo="Conclusiones"
      descripcion="Viabilidad preliminar, resultados económicos, recuperación, beneficios al país, empleo, tecnología, encadenamientos, impacto territorial, riesgos y condiciones pendientes."
      acciones={
        <Button variant="outline" size="sm" onClick={generarBorrador} className="gap-1.5">
          <Sparkles className="size-3.5" /> Generar borrador desde el modelo
        </Button>
      }
    >
      <Ayuda titulo={ayuda('conclusiones')?.titulo ?? ''} texto={ayuda('conclusiones')?.texto ?? ''} />
      <Campo etiqueta="Conclusiones del plan de negocios" valor={p.conclusiones.texto} onChange={(v) => actualizar((x) => void (x.conclusiones.texto = v))} filas={12} />
      {p.planex.plantillaOrigen === 'clinica' && <AdvertenciaDemo />}
    </Seccion>
  );
}
