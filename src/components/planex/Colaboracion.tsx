'use client';

// ============================================================================
// PLANEX — Componentes de colaboración sincronizada:
//   * EstadoSincronizacion: indicador (pendiente/guardando/guardado/error/
//     conflicto/sin conexión) basado en el estado REAL del servidor.
//   * DialogoConflictos: comparación campo a campo del contenido local frente
//     al persistido, con resolución explícita (nunca fusión automática).
//   * DialogoHistorial: versiones guardadas + restauración con confirmación,
//     copia de seguridad automática y advertencias.
//   * DialogoActividad: registro de cambios con autoría.
//   * DialogoComentarios: observaciones por sección (no alteran los datos
//     financieros).
// ============================================================================

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  AlertTriangle, Check, CloudOff, History, Loader2, MessageSquare, RefreshCw, Save, ScrollText, Upload, X,
} from 'lucide-react';
import { usePlanex } from '@/lib/planex/store';
import { useAuth } from '@/lib/supabase/auth';
import {
  diferenciarJSON,
  extraerContenidoLocal,
  resolverConflicto,
  resumenSincronizacion,
  restaurarVersion,
  guardarVersionActual,
  seccionesPendientes,
  useSync,
} from '@/lib/supabase/sync';
import type { VersionRow, ActividadRow, ComentarioRow } from '@/lib/supabase/tipos';
import { listarActividad, agregarComentario, eliminarComentario, listarComentarios } from '@/lib/supabase/datos';
import { CLAVES_SECCION, nombreSeccion } from '@/lib/planex/secciones-sync';

// ----------------------------------------------------------------------------
// Indicador de estado de sincronización
// ----------------------------------------------------------------------------

export function EstadoSincronizacion({ compacto = false }: { compacto?: boolean }) {
  const estados = useSync((s) => s.estados);
  const conflictos = useSync((s) => s.conflictos);
  const conectado = useSync((s) => s.conectado);
  const guardadoEn = useSync((s) => s.guardadoEn);
  const [resumen, setResumen] = React.useState(resumenSincronizacion());

  React.useEffect(() => {
    setResumen(resumenSincronizacion());
  }, [estados, conflictos, conectado, guardadoEn]);

  const clase =
    resumen.tipo === 'conflicto' || resumen.tipo === 'error'
      ? 'text-destructive'
      : resumen.tipo === 'sin_conexion'
        ? 'text-amber-600 dark:text-amber-400'
        : resumen.tipo === 'pendiente' || resumen.tipo === 'guardando'
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-emerald-600 dark:text-emerald-400';

  const icono =
    resumen.tipo === 'conflicto' ? <AlertTriangle className="size-3.5" />
    : resumen.tipo === 'error' ? <AlertTriangle className="size-3.5" />
    : resumen.tipo === 'sin_conexion' ? <CloudOff className="size-3.5" />
    : resumen.tipo === 'guardando' ? <Loader2 className="size-3.5 animate-spin" />
    : resumen.tipo === 'pendiente' ? <Upload className="size-3.5" />
    : <Check className="size-3.5" />;

  return (
    <span className={`text-[11px] inline-flex items-center gap-1.5 ${clase} ${compacto ? '' : ''}`} role="status" aria-live="polite">
      {icono} {resumen.texto}
    </span>
  );
}

// ----------------------------------------------------------------------------
// Diálogo de conflictos de edición
// ----------------------------------------------------------------------------

export function DialogoConflictos({ abierto, alCerrar }: { abierto: boolean; alCerrar: () => void }) {
  const conflictos = useSync((s) => s.conflictos);
  const proyecto = usePlanex((s) => s.proyecto);
  const [detallando, setDetallando] = React.useState<string | null>(null);

  const lista = Object.values(conflictos).filter((c): c is NonNullable<typeof c> => !!c);
  if (lista.length === 0) {
    return (
      <Dialog open={abierto} onOpenChange={(a) => !a && alCerrar()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sin conflictos pendientes</DialogTitle>
            <DialogDescription>No hay secciones con conflicto de edición en este momento.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );
  }

  const contenidoLocal = (clave: string) => extraerContenidoLocal(proyecto, clave as never);

  return (
    <Dialog open={abierto} onOpenChange={(a) => !a && alCerrar()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" /> Conflictos de edición ({lista.length})
          </DialogTitle>
          <DialogDescription>
            Otro colaborador guardó estas secciones mientras usted las editaba. Su trabajo local se ha
            conservado íntegro: compare los cambios y decida explícitamente. No se efectúa ninguna fusión
            automática de datos financieros.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {lista.map((c) => {
            const diferencias = detallando === c.clave ? diferenciarJSON(contenidoLocal(c.clave), c.contenidoRemoto) : [];
            return (
              <div key={c.clave} className="rounded-xl border p-3 space-y-2.5">
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <div>
                    <div className="font-medium text-sm">Sección «{nombreSeccion(c.clave)}»</div>
                    <div className="text-xs text-muted-foreground">
                      Versión del servidor {c.versionRemota} · guardada por <b>{c.autor}</b> el{' '}
                      {new Date(c.fecha).toLocaleString('es-ES')}
                    </div>
                  </div>
                  <Badge variant="destructive" className="text-[10px]">conflicto</Badge>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setDetallando(detallando === c.clave ? null : c.clave)}>
                    <ScrollText className="size-3.5" /> {detallando === c.clave ? 'Ocultar diferencias' : 'Comparar'}
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => void resolverConflicto(c.clave, 'copia_y_remoto')}>
                    <Save className="size-3.5" /> Guardar copia local y cargar la remota
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => void resolverConflicto(c.clave, 'remoto')}>
                    <RefreshCw className="size-3.5" /> Cargar versión remota
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => {
                      if (confirm(`¿Sobrescribir de forma EXPLÍCITA los cambios de ${c.autor} en «${nombreSeccion(c.clave)}» con su versión local?\n\nLos cambios del otro colaborador quedarán en el historial de versiones, no en el plan activo.`)) {
                        void resolverConflicto(c.clave, 'sobrescribir');
                      }
                    }}
                  >
                    <Upload className="size-3.5" /> Sobrescribir con la mía
                  </Button>
                </div>

                {detallando === c.clave && (
                  <div className="rounded-lg border overflow-hidden text-xs">
                    <table className="w-full">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          <th className="text-left font-medium px-2 py-1.5">Campo</th>
                          <th className="text-left font-medium px-2 py-1.5">Su versión (local)</th>
                          <th className="text-left font-medium px-2 py-1.5">Versión de {c.autor}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {diferencias.length === 0 && (
                          <tr><td colSpan={3} className="px-2 py-2 text-muted-foreground">Sin diferencias detectables al nivel de hojas JSON.</td></tr>
                        )}
                        {diferencias.map((d, i) => (
                          <tr key={i} className="border-t">
                            <td className="px-2 py-1.5 font-mono text-[11px] align-top">{d.ruta}</td>
                            <td className="px-2 py-1.5 align-top font-mono text-[11px] break-all">{d.antes}</td>
                            <td className="px-2 py-1.5 align-top font-mono text-[11px] break-all">{d.despues}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------------------------------
// Diálogo de historial de versiones
// ----------------------------------------------------------------------------

export function DialogoHistorial({ abierto, alCerrar }: { abierto: boolean; alCerrar: () => void }) {
  const planId = useSync((s) => s.planId);
  const [versiones, setVersiones] = React.useState<VersionRow[] | null>(null);
  const [cargando, setCargando] = React.useState(false);
  const [descripcion, setDescripcion] = React.useState('');
  const [restaurando, setRestaurando] = React.useState<string | null>(null);
  const [objetivo, setObjetivo] = React.useState<VersionRow | null>(null);

  const traer = React.useCallback(async () => {
    if (!planId) return;
    setCargando(true);
    try {
      const { traerVersiones } = await import('@/lib/supabase/sync');
      setVersiones(await traerVersiones());
    } catch (e) {
      toast.error('No se pudo leer el historial', { description: (e as Error).message });
    } finally {
      setCargando(false);
    }
  }, [planId]);

  React.useEffect(() => {
    if (abierto) void traer();
  }, [abierto, traer]);

  const guardar = async () => {
    if (seccionesPendientes().length > 3 && !confirm('Hay cambios pendientes; se guardarán en el servidor antes de crear la versión. ¿Continuar?')) return;
    const r = await guardarVersionActual(descripcion);
    if (r.ok) {
      toast.success('Versión guardada', { description: 'Queda registrada con su autoría en el historial.' });
      setDescripcion('');
      void traer();
    } else {
      toast.error('No se pudo guardar la versión', { description: r.error });
    }
  };

  const restaurar = async (v: VersionRow) => {
    setObjetivo(null);
    setRestaurando(v.id);
    const r = await restaurarVersion(v.id);
    setRestaurando(null);
    if (r.ok) {
      toast.success(`Restaurada la versión ${v.version_number}`, {
        description: 'El historial se conserva; el estado anterior quedó como copia de seguridad.',
      });
      void traer();
    } else {
      toast.error('No se pudo restaurar', { description: r.error });
    }
  };

  return (
    <Dialog open={abierto} onOpenChange={(a) => !a && alCerrar()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-4" /> Historial de versiones
          </DialogTitle>
          <DialogDescription>
            Instantáneas inmutables del plan. Restaurar una versión NO borra el historial: antes de aplicarse se
            guarda automáticamente una copia de seguridad con el estado actual.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border p-3 space-y-2">
          <div className="text-sm font-medium">Guardar versión actual</div>
          <div className="flex gap-2">
            <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción del cambio (opcional)" className="h-8 text-sm" />
            <Button size="sm" className="h-8 gap-1.5 shrink-0" onClick={() => void guardar()}>
              <Save className="size-3.5" /> Guardar
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          {cargando && <div className="text-xs text-muted-foreground">Cargando…</div>}
          {versiones && versiones.length === 0 && (
            <div className="text-xs text-muted-foreground py-2">Todavía no hay versiones guardadas de este plan.</div>
          )}
          {versiones?.map((v) => (
            <div key={v.id} className="rounded-lg border p-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-medium">Versión {v.version_number} <span className="text-muted-foreground font-normal text-xs">· {v.description || 'sin descripción'}</span></div>
                <div className="text-[11px] text-muted-foreground">
                  {new Date(v.created_at).toLocaleString('es-ES')} · por {v.created_by_name ?? '—'}
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5 shrink-0"
                disabled={restaurando === v.id}
                onClick={() => setObjetivo(v)}
              >
                {restaurando === v.id ? <Loader2 className="size-3.5 animate-spin" /> : <History className="size-3.5" />}
                Restaurar
              </Button>
            </div>
          ))}
        </div>

        <Dialog open={!!objetivo} onOpenChange={(a) => !a && setObjetivo(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Restaurar la versión {objetivo?.version_number}</DialogTitle>
              <DialogDescription>
                Fecha: {objetivo ? new Date(objetivo.created_at).toLocaleString('es-ES') : ''} · Autor: {objetivo?.created_by_name ?? '—'} ·{' '}
                {objetivo?.description || 'sin descripción'}.
                <br /><br />
                <b>Se sustituirá la versión activa del plan</b> por esta instantánea. Antes de aplicar el cambio se
                guardará automáticamente una copia de seguridad con el estado actual, y el historial se conserva
                íntegro. ¿Desea continuar?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setObjetivo(null)}>Cancelar</Button>
              <Button size="sm" onClick={() => objetivo && void restaurar(objetivo)}>Restaurar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------------------------------
// Diálogo de actividad
// ----------------------------------------------------------------------------

const ETIQUETAS_ACTIVIDAD: Record<string, string> = {
  seccion_creada: 'Sección creada',
  seccion_actualizada: 'Sección actualizada',
  plan_creado: 'Plan creado',
  plan_actualizado: 'Metadatos actualizados',
  version_guardada: 'Versión guardada',
  version_restaurada: 'Versión restaurada',
  comentario: 'Comentario',
};

export function DialogoActividad({ abierto, alCerrar }: { abierto: boolean; alCerrar: () => void }) {
  const planId = useSync((s) => s.planId);
  const [filas, setFilas] = React.useState<ActividadRow[] | null>(null);

  React.useEffect(() => {
    if (!abierto || !planId) return;
    void listarActividad(planId)
      .then(setFilas)
      .catch((e) => {
        toast.error('No se pudo leer la actividad', { description: (e as Error).message });
        setFilas([]);
      });
  }, [abierto, planId]);

  return (
    <Dialog open={abierto} onOpenChange={(a) => !a && alCerrar()}>
      <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScrollText className="size-4" /> Actividad del plan
          </DialogTitle>
          <DialogDescription>
            Registro de cambios relevantes con autoría. Las escrituras de secciones quedan registradas por el
            servidor; el historial es append-only (ningún colaborador puede editarlo).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          {filas === null && <div className="text-xs text-muted-foreground">Cargando…</div>}
          {filas?.map((f) => (
            <div key={f.id} className="rounded-lg border px-2.5 py-2 text-xs flex items-start gap-2">
              <Badge variant="outline" className="text-[10px] shrink-0">
                {ETIQUETAS_ACTIVIDAD[f.operation] ?? f.operation}
              </Badge>
              <div className="min-w-0 flex-1">
                {f.section_key && <div className="font-medium">{nombreSeccion(f.section_key)}</div>}
                {f.field_path && !f.section_key && <div className="text-muted-foreground">{f.field_path}</div>}
                {f.section_key && f.field_path && f.operation.includes('actualizad') && (
                  <div className="text-muted-500">{f.field_path}</div>
                )}
              </div>
              <div className="text-right text-muted-foreground shrink-0">
                <div>{f.user_name ?? '—'}</div>
                <div>{new Date(f.created_at).toLocaleString('es-ES')}</div>
              </div>
            </div>
          ))}
          {filas?.length === 0 && <div className="text-xs text-muted-foreground">Sin actividad registrada.</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ----------------------------------------------------------------------------
// Diálogo de comentarios por sección
// ----------------------------------------------------------------------------

export function DialogoComentarios({ abierto, alCerrar }: { abierto: boolean; alCerrar: () => void }) {
  const planId = useSync((s) => s.planId);
  const usuario = useAuth((s) => s.usuario);
  const proyecto = usePlanex((s) => s.proyecto);
  const [filas, setFilas] = React.useState<ComentarioRow[] | null>(null);
  const [texto, setTexto] = React.useState('');
  const [seccion, setSeccion] = React.useState<string>('general');
  const [enviando, setEnviando] = React.useState(false);

  const traer = React.useCallback(async () => {
    if (!planId) return;
    try {
      setFilas(await listarComentarios(planId));
    } catch (e) {
      toast.error('No se pudieron leer los comentarios', { description: (e as Error).message });
    }
  }, [planId]);

  React.useEffect(() => {
    if (abierto) void traer();
  }, [abierto, traer]);

  const publicar = async () => {
    if (!texto.trim() || !planId) return;
    setEnviando(true);
    try {
      await agregarComentario(planId, (seccion === '' ? null : seccion) as never, texto.trim());
      setTexto('');
      await traer();
      toast.success('Comentario publicado');
    } catch (e) {
      toast.error('No se pudo publicar el comentario', { description: (e as Error).message });
    } finally {
      setEnviando(false);
    }
  };

  const borrar = async (id: string) => {
    const ok = await eliminarComentario(id);
    if (ok) await traer();
    else toast.error('No se pudo eliminar el comentario');
  };

  return (
    <Dialog open={abierto} onOpenChange={(a) => !a && alCerrar()}>
      <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="size-4" /> Comentarios del plan
          </DialogTitle>
          <DialogDescription>
            Observaciones para los colaboradores. Los comentarios no modifican datos financieros ni
            disparan recálculos.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Select value={seccion} onValueChange={setSeccion}>
            <SelectTrigger className="h-8 text-xs w-56" aria-label="Sección del comentario">
              <SelectValue placeholder="Sección" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="" className="text-xs">Plan general</SelectItem>
              {CLAVES_SECCION.map((c) => (
                <SelectItem key={c} value={c} className="text-xs">{nombreSeccion(c)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escriba una observación…"
            className="text-sm min-h-[38px] h-[38px] resize-none"
            rows={2}
            disabled={enviando}
          />
          <Button size="sm" className="gap-1.5 shrink-0 self-end" onClick={() => void publicar()} disabled={enviando || !texto.trim()}>
            <MessageSquare className="size-3.5" /> Publicar
          </Button>
        </div>

        <div className="space-y-1.5">
          {filas === null && <div className="text-xs text-muted-foreground">Cargando…</div>}
          {filas?.map((c) => (
            <div key={c.id} className="rounded-lg border px-2.5 py-2 text-xs flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <b>{c.user_name ?? '—'}</b>
                  <span className="text-muted-foreground">· {c.section_key ? nombreSeccion(c.section_key) : 'Plan general'}</span>
                </div>
                <div className="mt-0.5 break-words">{c.content}</div>
                <div className="text-muted-foreground mt-0.5">{new Date(c.created_at).toLocaleString('es-ES')}</div>
              </div>
              {usuario?.id === c.user_id && (
                <button className="text-muted-foreground hover:text-destructive shrink-0" onClick={() => void borrar(c.id)} aria-label="Eliminar comentario">
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          ))}
          {filas?.length === 0 && <div className="text-xs text-muted-foreground">Sin comentarios todavía.</div>}
        </div>
        <p className="text-[11px] text-muted-foreground">
          Proyecto abierto: <b>{proyecto.nombre}</b>
        </p>
      </DialogContent>
    </Dialog>
  );
}
