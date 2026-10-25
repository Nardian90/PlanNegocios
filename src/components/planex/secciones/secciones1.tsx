'use client';

// Secciones 4.1–4.5: información general, título, índice, resumen ejecutivo
// y descripción del negocio (incluida la tabla de aportaciones).

import * as React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { FileText, ListOrdered } from 'lucide-react';
import { usePlanex } from '@/lib/planex/store';
import { ComputedModel, ETIQUETAS_APORTACION, DECLARACION_RESPONSABILIDAD } from '@/lib/planex/types';
import { fmtK, fmtAnios, fechaLarga } from '@/lib/planex/format';
import { Seccion, Ayuda, AdvertenciaDemo, Campo, CampoTexto, TablaEditor, CeldaCalculada, Columna, PanelAnalisis } from '../comunes';
import { AYUDAS_METODOLOGICAS } from '@/lib/planex/templates/default';
import type { AportacionRow } from '@/lib/planex/types';

const ayuda = (clave: string) => AYUDAS_METODOLOGICAS.find((a) => a.clave === clave);

export function SeccionGeneral({ modelo }: { modelo: ComputedModel }) {
  const p = usePlanex((s) => s.proyecto);
  const actualizar = usePlanex((s) => s.actualizar);
  const setSeccion = usePlanex((s) => s.setSeccion);
  const esDemo = p.planex.plantillaOrigen === 'clinica' || p.planex.plantillaOrigen === 'centro';

  return (
    <Seccion num="4.1" titulo="Información general" descripcion="Autoría, firma, fecha y declaración de responsabilidad sobre la veracidad de los datos.">
      <Ayuda titulo={ayuda('general')?.titulo ?? ''} texto={ayuda('general')?.texto ?? ''} />
      <Card>
        <CardContent className="grid gap-4 md:grid-cols-2 pt-6">
          <CampoTexto etiqueta="Nombre de quien elaboró el plan" valor={p.general.elaboradoPor} onChange={(v) => actualizar((x) => void (x.general.elaboradoPor = v))} placeholder="Nombre y apellidos" />
          <CampoTexto etiqueta="Cargo" valor={p.general.cargo} onChange={(v) => actualizar((x) => void (x.general.cargo = v))} placeholder="Cargo o responsabilidad" />
          <CampoTexto etiqueta="Firma o identificación" valor={p.general.firmaIdentificacion} onChange={(v) => actualizar((x) => void (x.general.firmaIdentificacion = v))} placeholder="Identificación de la firma" />
          <CampoTexto etiqueta="Fecha" tipo="date" valor={p.general.fecha} onChange={(v) => actualizar((x) => void (x.general.fecha = v))} />
          <div className="md:col-span-2 flex items-start gap-3 rounded-lg border p-3">
            <Switch checked={p.general.declaracionResponsabilidad} onCheckedChange={(v) => actualizar((x) => void (x.general.declaracionResponsabilidad = v))} />
            <div className="text-sm">
              <div className="font-medium">Declaración de responsabilidad</div>
              <p className="text-muted-foreground text-xs mt-1">{DECLARACION_RESPONSABILIDAD}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Seccion num="4.2" titulo="Título" descripcion="Nombre del proyecto y denominación de la propuesta.">
        <Card>
          <CardContent className="grid gap-4 pt-6">
            <CampoTexto etiqueta="Nombre del proyecto" valor={p.titulo.nombreProyecto} onChange={(v) => actualizar((x) => void (x.titulo.nombreProyecto = v))} placeholder="Nombre comercial del proyecto" />
            <CampoTexto etiqueta="Denominación de la propuesta" valor={p.titulo.denominacionPropuesta} onChange={(v) => actualizar((x) => void (x.titulo.denominacionPropuesta = v))} placeholder="Denominación de la propuesta de negocio" />
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Inversión total</div>
                <CeldaCalculada valor={`${fmtK(modelo.indicadores.inversionTotalKUSD)} kUSD`} formula="gastos_previos_k + inversion_fija_k + capital_trabajo_k" />
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Recuperación (inversión total / FCFF)</div>
                <CeldaCalculada valor={modelo.indicadores.recuperacionProyecto.anios === null ? 'No recuperada' : fmtAnios(modelo.indicadores.recuperacionProyecto.anios)} formula="interpolación lineal del flujo acumulado del proyecto" />
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Recuperación (capital socios / FCFE)</div>
                <CeldaCalculada valor={modelo.indicadores.recuperacionSocios.anios === null ? 'No recuperada' : fmtAnios(modelo.indicadores.recuperacionSocios.anios)} formula="interpolación lineal del flujo acumulado de los socios" />
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Fecha del documento</div>
                <div className="px-2 py-1 text-sm">{fechaLarga(p.general.fecha || p.actualizado)}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </Seccion>

      <Seccion num="4.3" titulo="Índice" descripcion="Generado automáticamente; la numeración se corresponde con el PDF exportable.">
        <Card>
          <CardContent className="pt-6">
            <ul className="text-sm space-y-1.5">
              {[
                ['4.4', 'Resumen ejecutivo', 'resumen'],
                ['4.5', 'Descripción del negocio', 'negocio'],
                ['4.6', 'Aspectos técnicos y operativos', 'tecnico'],
                ['4.7', 'Análisis financiero', 'financiero'],
                ['4.8', 'Análisis o caracterización del mercado', 'mercado'],
                ['4.9', 'Fuerza de trabajo', 'fuerza'],
                ['4.10', 'Inversiones', 'inversiones'],
                ['4.11', 'Indicadores de beneficios directos al país', 'beneficios'],
                ['4.12', 'Conclusiones', 'conclusiones'],
                ['⚙', 'Configuración de cálculos', 'config'],
              ].map(([num, titulo, id]) => (
                <li key={id}>
                  <Button variant="ghost" size="sm" className="gap-2 justify-start w-full sm:w-auto text-muted-foreground" onClick={() => setSeccion(id)}>
                    <ListOrdered className="size-3.5" />
                    <span className="font-mono text-xs w-10 text-left">{num}</span> {titulo}
                  </Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </Seccion>

      {esDemo && <AdvertenciaDemo />}
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <FileText className="size-3.5" /> Este plan proviene de la plantilla «{p.planex.plantillaOrigen}». Esquema {p.planex.schemaVersion}.
      </p>
    </Seccion>
  );
}

export function SeccionResumen({ modelo }: { modelo: ComputedModel }) {
  const p = usePlanex((s) => s.proyecto);
  const actualizar = usePlanex((s) => s.actualizar);
  const esDemo = p.planex.plantillaOrigen === 'clinica' || p.planex.plantillaOrigen === 'centro';
  const ind = modelo.indicadores;

  const kpi = (etiqueta: string, valor: string) => (
    <div className="rounded-lg border p-3 bg-card">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{etiqueta}</div>
      <div className="text-lg font-semibold tabular-nums mt-0.5">{valor}</div>
    </div>
  );

  return (
    <Seccion num="4.4" titulo="Resumen ejecutivo" descripcion="Síntesis del negocio con cifras vinculadas al modelo financiero activo: se actualizan solas al cambiar parámetros o fórmulas.">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {kpi('Inversión total', `${fmtK(ind.inversionTotalKUSD)} kUSD`)}
        {kpi('Aportaciones', `${fmtK(ind.aportacionesTotalesKUSD)} kUSD`)}
        {kpi('Ingresos año 1', `${fmtK(ind.ingresosTotales[1] ?? 0)} kUSD`)}
        {kpi('Utilidad neta año 1', `${fmtK(ind.utilidadNeta[1] ?? 0)} kUSD`)}
        {kpi('Recuperación — inversión (FCFF)', ind.recuperacionProyecto.anios === null ? 'No recuperada' : fmtAnios(ind.recuperacionProyecto.anios))}
        {kpi('Recuperación — socios (FCFE)', ind.recuperacionSocios.anios === null ? 'No recuperada' : fmtAnios(ind.recuperacionSocios.anios))}
        {kpi('Beneficios al país (período completo)', `${fmtK(ind.beneficiosPaisAcumulados)} kUSD`)}
        {kpi('Empleos en operación', String(ind.totalTrabajadores))}
      </div>
      <PanelAnalisis titulo="Resumen ejecutivo (análisis dinámico)" clave="resumen_ejecutivo" modelo={modelo} />
      <Campo etiqueta="Descripción del negocio y resultados esperados (texto editable del usuario)" valor={p.resumen.introduccion} onChange={(v) => actualizar((x) => void (x.resumen.introduccion = v))} filas={7} />
      <Campo etiqueta="Notas" valor={p.resumen.notas} onChange={(v) => actualizar((x) => void (x.resumen.notas = v))} filas={3} />
      {esDemo && <AdvertenciaDemo />}
    </Seccion>
  );
}

export function SeccionNegocio({ modelo }: { modelo: ComputedModel }) {
  const p = usePlanex((s) => s.proyecto);
  const actualizar = usePlanex((s) => s.actualizar);
  const { addAportacion, updAportacion, updAportacionMonto, delFila } = usePlanex();

  const opcionesTipo = Object.entries(ETIQUETAS_APORTACION).map(([valor, etiqueta]) => ({ valor, etiqueta }));

  const columnas: Columna<AportacionRow>[] = [
    {
      titulo: 'Socio',
      tipo: 'select',
      ancho: '110px',
      valor: (a) => a.socio,
      onEdit: (a, v) => updAportacion(a.id, { socio: v as 'nacional' | 'extranjero' }),
      opciones: [
        { valor: 'nacional', etiqueta: 'Nacional' },
        { valor: 'extranjero', etiqueta: 'Extranjero' },
      ],
    },
    {
      titulo: 'Tipo de aporte',
      tipo: 'select',
      valor: (a) => a.tipo,
      onEdit: (a, v) => updAportacion(a.id, { tipo: v as AportacionRow['tipo'] }),
      opciones: opcionesTipo,
    },
    { titulo: 'Año 1', tipo: 'numero', ancho: '90px', valor: (a) => String(a.montos[0] ?? 0), onEdit: (a, v) => updAportacionMonto(a.id, 0, Number(v)) },
    { titulo: 'Año 2', tipo: 'numero', ancho: '90px', valor: (a) => String(a.montos[1] ?? 0), onEdit: (a, v) => updAportacionMonto(a.id, 1, Number(v)) },
    { titulo: 'Año 3', tipo: 'numero', ancho: '90px', valor: (a) => String(a.montos[2] ?? 0), onEdit: (a, v) => updAportacionMonto(a.id, 2, Number(v)) },
    {
      titulo: 'Total',
      calculada: true,
      ancho: '95px',
      valor: (a) => String(a.montos.reduce((s, m) => s + m, 0)),
      render: (a) => <CeldaCalculada valor={fmtK(a.montos.reduce((s, m) => s + m, 0))} formula="suma de los tres años" />,
    },
    { titulo: 'Referencia documental', valor: (a) => a.referenciaDocumental, onEdit: (a, v) => updAportacion(a.id, { referenciaDocumental: String(v) }), celda: 'min-w-40' },
  ];

  const faltanDerechos = p.aportaciones.filter((a) => a.tipo === 'derechos_reales' && !a.referenciaDocumental.trim());

  return (
    <Seccion num="4.5" titulo="Descripción del negocio" descripcion="Modalidad, objeto, fundamentación, inversionistas y aportaciones de los socios.">
      <Ayuda titulo={ayuda('negocio')?.titulo ?? ''} texto={ayuda('negocio')?.texto ?? ''} />
      <div className="grid gap-4 md:grid-cols-2">
        <CampoTexto etiqueta="Modalidad de la inversión extranjera" valor={p.negocio.modalidad} onChange={(v) => actualizar((x) => void (x.negocio.modalidad = v))} placeholder="Empresa Mixta / Contrato de asociación / Inversión total" />
        <CampoTexto etiqueta="Plazo de vigencia" valor={p.negocio.plazoVigencia} onChange={(v) => actualizar((x) => void (x.negocio.plazoVigencia = v))} />
        <div className="md:col-span-2">
          <Campo etiqueta="Objeto social o contractual" valor={p.negocio.objetoSocial} onChange={(v) => actualizar((x) => void (x.negocio.objetoSocial = v))} filas={3} />
        </div>
        <div className="md:col-span-2">
          <Campo etiqueta="Fundamentación y propuesta de valor" valor={p.negocio.fundamentacion} onChange={(v) => actualizar((x) => void (x.negocio.fundamentacion = v))} filas={4} />
        </div>
        <Campo etiqueta="Relación con los objetivos de la inversión extranjera (Ley 118)" valor={p.negocio.objetivosInversion} onChange={(v) => actualizar((x) => void (x.negocio.objetivosInversion = v))} filas={3} />
        <Campo etiqueta="Relación con el PNDES" valor={p.negocio.relacionPNDES} onChange={(v) => actualizar((x) => void (x.negocio.relacionPNDES = v))} filas={3} />
        <Campo etiqueta="Relación con la estrategia territorial (EDT)" valor={p.negocio.relacionEDT} onChange={(v) => actualizar((x) => void (x.negocio.relacionEDT = v))} filas={3} />
        <Campo etiqueta="Bienes y servicios" valor={p.negocio.bienesServicios} onChange={(v) => actualizar((x) => void (x.negocio.bienesServicios = v))} filas={3} />
        <Campo etiqueta="Análisis del mercado interno" valor={p.negocio.mercadoInterno} onChange={(v) => actualizar((x) => void (x.negocio.mercadoInterno = v))} filas={3} />
        <Campo etiqueta="Análisis del mercado externo" valor={p.negocio.mercadoExterno} onChange={(v) => actualizar((x) => void (x.negocio.mercadoExterno = v))} filas={3} />
        <div className="md:col-span-2">
          <Campo etiqueta="Regla de distribución de beneficios" valor={p.negocio.reglaDistribucion} onChange={(v) => actualizar((x) => void (x.negocio.reglaDistribucion = v))} filas={2} />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="flex items-center gap-2">
              <Badge variant="outline">Inversionista extranjero</Badge>
            </div>
            <CampoTexto etiqueta="Nombre" valor={p.inversionistaExtranjero.nombre} onChange={(v) => actualizar((x) => void (x.inversionistaExtranjero.nombre = v))} />
            <CampoTexto etiqueta="Domicilio" valor={p.inversionistaExtranjero.domicilio} onChange={(v) => actualizar((x) => void (x.inversionistaExtranjero.domicilio = v))} />
            <CampoTexto etiqueta="Identificación fiscal" valor={p.inversionistaExtranjero.identificacionFiscal} onChange={(v) => actualizar((x) => void (x.inversionistaExtranjero.identificacionFiscal = v))} />
            <Campo etiqueta="Experiencia" valor={p.inversionistaExtranjero.experiencia} onChange={(v) => actualizar((x) => void (x.inversionistaExtranjero.experiencia = v))} filas={2} />
            <Campo etiqueta="Vinculación con el mercado cubano" valor={p.inversionistaExtranjero.vinculacionCuba} onChange={(v) => actualizar((x) => void (x.inversionistaExtranjero.vinculacionCuba = v))} filas={2} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3 pt-6">
            <div className="flex items-center gap-2">
              <Badge variant="outline">Inversionista nacional</Badge>
            </div>
            <CampoTexto etiqueta="Nombre" valor={p.inversionistaNacional.nombre} onChange={(v) => actualizar((x) => void (x.inversionistaNacional.nombre = v))} />
            <CampoTexto etiqueta="Domicilio" valor={p.inversionistaNacional.domicilio} onChange={(v) => actualizar((x) => void (x.inversionistaNacional.domicilio = v))} />
            <CampoTexto etiqueta="Identificación fiscal" valor={p.inversionistaNacional.identificacionFiscal} onChange={(v) => actualizar((x) => void (x.inversionistaNacional.identificacionFiscal = v))} />
            <Campo etiqueta="Experiencia" valor={p.inversionistaNacional.experiencia} onChange={(v) => actualizar((x) => void (x.inversionistaNacional.experiencia = v))} filas={2} />
            <Campo etiqueta="Vinculación con el mercado cubano" valor={p.inversionistaNacional.vinculacionCuba} onChange={(v) => actualizar((x) => void (x.inversionistaNacional.vinculacionCuba = v))} filas={2} />
          </CardContent>
        </Card>
      </div>

      <TablaEditor
        titulo="Aportaciones de los socios (miles de USD con un decimal)"
        columnas={columnas}
        filas={p.aportaciones}
        onAdd={addAportacion}
        onDel={(id) => delFila('aportaciones', id)}
        addLabel="Añadir aportación"
        vacio="Sin aportaciones definidas. El análisis de financiación marcará la insuficiencia correspondiente."
      />
      <PanelAnalisis titulo="Análisis de las aportaciones" clave="aportaciones" modelo={modelo} />
      {faltanDerechos.length > 0 && (
        <div className="rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-200">
          Hay {faltanDerechos.length} aporte(s) por derechos reales sin referencia documental. La metodología exige adjuntar la certificación de la Dirección de Patrimonio del MFP cuando corresponda.
        </div>
      )}
    </Seccion>
  );
}
