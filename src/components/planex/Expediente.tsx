// ============================================================================
// PLANEX-DATA-001 — Vista «Expediente documental» (completitud).
//
// Sección adicional de la app visible SOLO en el proyecto Holguín:
// expone el estado de cobertura de la metodología, el inventario de
// fuentes (con SHA-256), las contradicciones sin resolver, las brechas
// con su plan de cierre y el registro de información fidedigna. Todo se
// deriva de los módulos de datos (misma fuente que el PDF de brechas).
// ============================================================================

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, FileDown, ShieldCheck, TriangleAlert, CircleAlert, ListChecks, FileSearch } from 'lucide-react';
import { toast } from 'sonner';
import { usePlanex } from '@/lib/planex/store';
import { Seccion } from './comunes';
import {
  coberturaGlobal,
  coberturaPorEpigrafe,
  censoRegistro,
  EPIGRAFES,
} from '@/lib/planex/data/holguin/cobertura';
import {
  CONTRADICCIONES,
  BRECHAS,
  VALIDACIONES,
  PLAN_CIERRE,
  resumenExpediente,
} from '@/lib/planex/data/holguin/brechas';
import { FUENTES, RESUMEN_FUENTES, SHA256_ZIP } from '@/lib/planex/data/holguin/fuentes';
import { REGISTRO } from '@/lib/planex/data/holguin/registro';
import { exportarInformeBrechasPDF } from '@/lib/planex/io/informe-brechas';
import { exportarConsultasPDF, exportarConsultasDOCX } from '@/lib/planex/io/consultas';

const pct = (x: number) => `${(x * 100).toFixed(1).replace('.', ',')} %`;

const ETIQUETA_ESTADO: Record<string, { texto: string; clase: string }> = {
  completo: { texto: 'Completo', clase: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' },
  parcial: { texto: 'Parcial', clase: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' },
  pendiente: { texto: 'Pendiente', clase: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200' },
  derivado: { texto: 'Dinámico', clase: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200' },
};

const ETIQUETA_CAT: Record<string, { texto: string; clase: string }> = {
  A: { texto: 'A · Confirmado', clase: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' },
  B: { texto: 'B · Derivado', clase: 'bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200' },
  C: { texto: 'C · Provisional', clase: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200' },
  D: { texto: 'D · Contradictorio', clase: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200' },
  E: { texto: 'E · Pendiente', clase: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200' },
  F: { texto: 'F · No aplicable', clase: 'bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-200' },
};

export function SeccionExpediente() {
  const [exportando, setExportando] = React.useState(false);
  const glob = coberturaGlobal();
  const censo = censoRegistro();
  const res = resumenExpediente();
  const porEpi = coberturaPorEpigrafe();

  const exportar = async () => {
    setExportando(true);
    try {
      await exportarInformeBrechasPDF();
      toast.success('Informe de brechas documentales generado', {
        description: 'PDF compuesto con el motor editorial de PLANEX desde el registro de datos.',
      });
    } catch (e) {
      toast.error('No se pudo generar el informe', { description: (e as Error).message });
    } finally {
      setExportando(false);
    }
  };

  const exportarConsultas = async (formato: 'pdf' | 'docx') => {
    setExportando(true);
    try {
      if (formato === 'pdf') await exportarConsultasPDF();
      else await exportarConsultasDOCX();
      toast.success(formato === 'pdf' ? 'Consultas al promotor generadas (PDF)' : 'Consultas al promotor generadas (DOCX editable)', {
        description: 'Supuestos, dudas y pendientes del expediente, compuestos desde el mismo registro de datos.',
      });
    } catch (e) {
      toast.error('No se pudo generar el documento de consultas', { description: (e as Error).message });
    } finally {
      setExportando(false);
    }
  };

  return (
    <Seccion
      num="ED"
      titulo="Expediente documental — completitud, fuentes y diagnóstico"
      descripcion="Estado de cobertura de la información del expediente Holguín: qué está respaldado por fuentes, qué contradice a qué y qué falta. Misma fuente de datos que el informe PDF de brechas."
      acciones={
        <div className="flex gap-2">
          <Button size="sm" onClick={() => void exportar()} disabled={exportando}>
            <FileDown className="size-3.5" /> {exportando ? 'Generando…' : 'Informe PDF de brechas'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => void exportarConsultas('pdf')} disabled={exportando}>
            <FileDown className="size-3.5" /> Consultas PDF
          </Button>
          <Button size="sm" variant="outline" onClick={() => void exportarConsultas('docx')} disabled={exportando}>
            <FileDown className="size-3.5" /> Consultas DOCX
          </Button>
        </div>
      }
    >
      {/* ------------------------------------------------ resumen */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="pt-5">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Campos completados</div>
            <div className="text-lg font-semibold tabular-nums">{pct(glob.pctCamposCompletados)}</div>
            <div className="text-[10px] text-muted-foreground mt-1">{glob.camposCompletos} de {glob.camposTotales - glob.camposDerivados} obligatorios</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Contradicciones</div>
            <div className="text-lg font-semibold tabular-nums text-red-700 dark:text-red-300">{res.contradicciones}</div>
            <div className="text-[10px] text-muted-foreground mt-1">{res.contradiccionesCriticas} crítica(s) · {res.contradiccionesAltas} alta(s)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Brechas</div>
            <div className="text-lg font-semibold tabular-nums">{res.brechas}</div>
            <div className="text-[10px] text-muted-foreground mt-1">{res.brechasBloqueantes} bloqueante(s)</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Validaciones normativas</div>
            <div className="text-lg font-semibold tabular-nums">{res.validaciones}</div>
            <div className="text-[10px] text-muted-foreground mt-1">{res.validacionesSinEvidencia} sin evidencia adjunta</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">Datos del registro</div>
            <div className="text-lg font-semibold tabular-nums">{censo.total}</div>
            <div className="text-[10px] text-muted-foreground mt-1">{censo.confirmados} confirmados · {censo.derivados} derivados · {censo.provisionales} provisionales · {censo.contradictorios} contradictorios</div>
          </CardContent>
        </Card>
      </div>
      <p className="text-xs text-muted-foreground">{glob.denominadorNota}</p>

      {/* ------------------------------------------------ matriz de cobertura */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ListChecks className="size-4 text-primary" /> Matriz de cobertura por epígrafe (4.1–4.12)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {EPIGRAFES.map((e) => {
            const c = porEpi.find((x) => x.epigrafe === e.id);
            const abierta = c ? c.completos < c.total : false;
            return (
              <Collapsible key={e.id}>
                <div className="flex items-center gap-3 rounded-lg border px-3 py-2">
                  <Badge variant="outline" className="w-12 justify-center tabular-nums">{e.id}</Badge>
                  <div className="text-xs flex-1">{e.titulo}</div>
                  <div className="flex items-center gap-1.5 text-[10px] tabular-nums text-muted-foreground">
                    <span className="inline-block size-2 rounded-full bg-emerald-500" /> {c?.completos ?? 0}
                    <span className="inline-block size-2 rounded-full bg-amber-500 ml-1" /> {c?.parciales ?? 0}
                    <span className="inline-block size-2 rounded-full bg-red-500 ml-1" /> {c?.pendientes ?? 0}
                    <span className="inline-block size-2 rounded-full bg-sky-500 ml-1" /> {c?.derivados ?? 0}
                  </div>
                  <CollapsibleTrigger asChild>
                    <Button size="icon" variant="ghost" className="size-7" aria-label={`Detalle de ${e.id}`}>
                      <ChevronDown className={`size-4 transition-transform ${abierta ? '' : 'rotate-180'}`} />
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent className="px-4 pb-2">
                  <div className="space-y-1.5">
                    {e.campos.map((campo) => (
                      <div key={campo.campo} className="flex items-start gap-2 text-xs">
                        <Badge className={`shrink-0 text-[10px] ${ETIQUETA_ESTADO[campo.estado].clase}`}>{ETIQUETA_ESTADO[campo.estado].texto}</Badge>
                        <div className="flex-1">
                          <span className="font-medium">{campo.campo}.</span>{' '}
                          <span className="text-muted-foreground">{campo.observacion}</span>
                          <div className="text-[10px] text-muted-foreground mt-0.5">Evidencia: {campo.evidencia}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </CardContent>
      </Card>

      {/* ------------------------------------------------ contradicciones */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TriangleAlert className="size-4 text-red-600" /> Contradicciones del expediente (no resueltas en silencio)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {CONTRADICCIONES.map((c) => (
            <div key={c.id} className="rounded-lg border px-3 py-2">
              <div className="flex items-center gap-2 text-xs font-medium">
                <Badge variant="outline" className="tabular-nums">{c.id}</Badge>
                <span>{c.titulo}</span>
                <Badge className={`text-[10px] ${c.severidad === 'critica' ? 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200' : c.severidad === 'alta' ? 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200' : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'}`}>
                  {c.severidad}
                </Badge>
              </div>
              <ul className="mt-1.5 space-y-1">
                {c.valores.map((v) => (
                  <li key={v.valor} className="text-xs text-muted-foreground">• {v.valor} — {v.fuenteLocalizador}</li>
                ))}
              </ul>
              <p className="text-xs mt-1.5"><span className="font-medium">Impacto:</span> {c.impacto}</p>
              <p className="text-xs mt-1"><span className="font-medium">Acción requerida:</span> {c.accionRequerida}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ------------------------------------------------ brechas + plan */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <CircleAlert className="size-4 text-amber-600" /> Información faltante y plan de cierre priorizado
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {PLAN_CIERRE.map((bloque) => (
            <div key={bloque.bloque}>
              <div className="text-xs font-semibold mb-1">{bloque.titulo}</div>
              <p className="text-[11px] text-muted-foreground mb-1.5">{bloque.secuenci}</p>
              <div className="space-y-1.5">
                {BRECHAS.filter((b) => bloque.brechas.includes(b.id)).map((b) => (
                  <div key={b.id} className="rounded-lg border px-3 py-2">
                    <div className="flex items-center gap-2 text-xs font-medium">
                      <Badge variant="outline" className="tabular-nums">{b.id}</Badge>
                      <span>{b.titulo}</span>
                      <Badge className={`text-[10px] ${b.prioridad === 'bloqueante' ? 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200' : b.prioridad === 'alta' ? 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200' : 'bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-200'}`}>
                        {b.prioridad}
                      </Badge>
                    </div>
                    <p className="text-xs mt-1"><span className="font-medium">Falta:</span> {b.falta}</p>
                    <p className="text-xs text-muted-foreground mt-0.5"><span className="font-medium">Motivo:</span> {b.motivo}</p>
                    <p className="text-xs text-muted-foreground mt-0.5"><span className="font-medium">Se pide al promotor:</span> {b.requiere}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Criterio de cierre: {b.criterioCierre}. Registro: {b.registroIds.join(', ')}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ------------------------------------------------ validaciones normativas */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <ShieldCheck className="size-4 text-primary" /> Validaciones normativas y administrativas pendientes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {VALIDACIONES.map((v) => (
            <div key={v.id} className="flex items-start gap-2 text-xs rounded-lg border px-3 py-2">
              <Badge variant="outline" className="tabular-nums shrink-0">{v.id}</Badge>
              <div className="flex-1">
                <span className="font-medium">{v.requisito}.</span>{' '}
                <span className="text-muted-foreground">Norma invocada: {v.normaInvocada} Evidencia del expediente: {v.evidenciaExpediente}</span>
                <div className="text-[11px] text-muted-foreground mt-0.5">Pendiente: {v.pendiente}</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ------------------------------------------------ fuentes */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileSearch className="size-4 text-primary" /> Inventario de fuentes ({RESUMEN_FUENTES.total} documentos, {RESUMEN_FUENTES.leidasCompletas} leídos completos)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          <p className="text-[11px] text-muted-foreground">
            ZIP analizado: Planex.zip ({(RESUMEN_FUENTES.bytesZip / 1024).toFixed(0)} KiB), sha256 {SHA256_ZIP.slice(0, 16)}…. Los originales no se copian al repositorio.
          </p>
          {FUENTES.map((f) => (
            <div key={f.id} className="rounded-lg border px-3 py-2">
              <div className="flex items-center gap-2 text-xs">
                <Badge variant="outline" className="tabular-nums">{f.id}</Badge>
                <span className="font-medium flex-1">{f.nombre}</span>
                <Badge variant="secondary" className="text-[10px]">{f.tipo}</Badge>
                <Badge variant="secondary" className="text-[10px]">{(f.bytes / 1024).toFixed(0)} KiB</Badge>
                <Badge className={`text-[10px] ${f.estadoLectura === 'completa' ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200' : 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200'}`}>
                  {f.estadoLectura === 'completa' ? 'lectura completa' : 'visual parcial'}
                </Badge>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">{f.aporte}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">sha256: {f.sha256.slice(0, 24)}… · Limitaciones: {f.limitaciones.join(' ')}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* ------------------------------------------------ registro */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileSearch className="size-4 text-primary" /> Registro de información fidedigna ({REGISTRO.length} datos)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {REGISTRO.map((r) => (
            <Collapsible key={r.id}>
              <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs">
                <Badge variant="outline" className="tabular-nums shrink-0">{r.id}</Badge>
                <Badge className={`text-[10px] shrink-0 ${ETIQUETA_CAT[r.categoria].clase}`}>{ETIQUETA_CAT[r.categoria].texto}</Badge>
                <span className="flex-1 truncate">{r.campo}</span>
                <CollapsibleTrigger asChild>
                  <Button size="icon" variant="ghost" className="size-6" aria-label={`Detalle de ${r.id}`}>
                    <ChevronDown className="size-3.5" />
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent className="px-4 pb-2 text-xs space-y-1">
                <p><span className="font-medium">Valor literal:</span> {r.valorLiteral}</p>
                {r.valorNormalizado && <p><span className="font-medium">Valor normalizado:</span> {r.valorNormalizado}</p>}
                {r.derivacion && <p className="text-muted-foreground"><span className="font-medium">Fórmula conservada:</span> {r.derivacion}</p>}
                <p className="text-muted-foreground"><span className="font-medium">Fuente:</span> {r.fuenteId} — {r.localizador}</p>
                <p className="text-muted-foreground"><span className="font-medium">Tratamiento en PLANEX:</span> {r.tratamiento}</p>
                {r.observaciones && <p className="text-muted-foreground">{r.observaciones}</p>}
              </CollapsibleContent>
            </Collapsible>
          ))}
        </CardContent>
      </Card>
    </Seccion>
  );
}
