'use client';

// ============================================================================
// PLANEX — Vista de Colaboración, historial de versiones y comparación
// (#/colaboracion?plan=<uuid>&tab=<pestaña>&a=<idVersión>&b=<idVersión>).
//
// MISIÓN UX-002 §4.1: la colaboración y el historial NO viven en modales.
// Es una vista dedicada del sistema de navegación, con pestañas internas
// sincronizadas con la URL (enlaces directos, Atrás/Adelante, recarga):
//
//   · Resumen y actividad   — últimos cambios con autoría y estado del plan.
//   · Historial de versiones — instantáneas inmutables, guardar, restauración
//                             con confirmación explícita y trazabilidad.
//   · Comparar versiones     — diferencias REALES campo a campo entre dos
//                             instantáneas (datos generales, supuestos,
//                             inversiones, financiación, proyecciones…).
//   · Comentarios           — observaciones por sección entre colaboradores.
//   · Colaboradores         — participantes del espacio y permisos reales.
//   · Conflictos            — solo cuando existen conflictos de edición
//                             activos (comparación y resolución explícita).
//
// La restauración nunca borra historial: antes de aplicar el cambio se guarda
// automáticamente una copia de seguridad del estado vigente (trazabilidad).
// ============================================================================

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import {
  AlertTriangle, ArrowLeftRight, ArrowUpRight, GitCompareArrows, History, Loader2,
  MessageSquare, PanelLeftClose, RefreshCw, Save, ScrollText, Trash2, TriangleAlert, Users,
} from 'lucide-react';
import { usePlanex } from '@/lib/planex/store';
import { useAuth } from '@/lib/supabase/auth';
import {
  diferenciarJSON,
  extraerContenidoLocal,
  guardarVersionActual,
  restaurarVersion,
  resolverConflicto,
  resumenSincronizacion,
  seccionesPendientes,
  traerVersiones,
  useSync,
} from '@/lib/supabase/sync';
import type { VersionRow, ActividadRow, ComentarioRow, MembresiaRow } from '@/lib/supabase/tipos';
import type { MiembroWorkspace } from '@/lib/supabase/datos';
import { listarActividad, agregarComentario, eliminarComentario, listarComentarios, listarMiembrosWorkspace } from '@/lib/supabase/datos';
import { compararSnapshots } from '@/lib/supabase/comparar-versiones';
import { CLAVES_SECCION, nombreSeccion } from '@/lib/planex/secciones-sync';
import { navegar, parametrosDesdeHash } from './navegacion';
import { EstadoSincronizacion } from './Colaboracion';
import { EnlaceAyuda } from './comunes';

const ETIQUETAS_ACTIVIDAD: Record<string, string> = {
  seccion_creada: 'Sección creada',
  seccion_actualizada: 'Sección actualizada',
  plan_creado: 'Plan creado',
  plan_actualizado: 'Metadatos actualizados',
  version_guardada: 'Versión guardada',
  version_restaurada: 'Versión restaurada',
  comentario: 'Comentario',
};

const ETIQUETA_ESTADO: Record<string, string> = {
  borrador: 'Borrador',
  en_revision: 'En revisión',
  finalizado: 'Finalizado',
};

const ETIQUETA_ROL: Record<MembresiaRow['role'], string> = {
  owner: 'Propietario del espacio',
  editor: 'Editor',
  viewer: 'Solo lectura',
};

type Pestanna = 'actividad' | 'historial' | 'comparar' | 'comentarios' | 'colaboradores' | 'conflictos';

const PESTANNAS: { id: Pestanna; titulo: string; icono: React.ReactNode }[] = [
  { id: 'actividad', titulo: 'Resumen y actividad', icono: <ScrollText className="size-3.5" /> },
  { id: 'historial', titulo: 'Historial de versiones', icono: <History className="size-3.5" /> },
  { id: 'comparar', titulo: 'Comparar versiones', icono: <GitCompareArrows className="size-3.5" /> },
  { id: 'comentarios', titulo: 'Comentarios', icono: <MessageSquare className="size-3.5" /> },
  { id: 'colaboradores', titulo: 'Colaboradores', icono: <Users className="size-3.5" /> },
];

/** Cambia la pestaña (y parámetros) SIN crear una entrada nueva en el historial. */
function sincronizarHash(params: Record<string, string | undefined>): void {
  const actuales = parametrosDesdeHash();
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...actuales, ...params })) {
    if (v !== undefined && v !== '') p.set(k, v);
  }
  const destino = `#/colaboracion?${p.toString()}`;
  if (window.location.hash === destino) return;
  window.history.replaceState(null, '', destino);
  // Notifica el cambio a los hooks que leen el hash (sin ensuciar Atrás/Adelante).
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

// ----------------------------------------------------------------------------
// Vista principal
// ----------------------------------------------------------------------------

export function VistaColaboracion() {
  const proyecto = usePlanex((s) => s.proyecto);
  const planId = useSync((s) => s.planId);
  const planMeta = useSync((s) => s.plan);
  const cargandoSync = useSync((s) => s.cargando);
  const errorCarga = useSync((s) => s.errorCarga);
  const conflictos = useSync((s) => s.conflictos);

  const [montado, setMontado] = React.useState(false);
  const [planRuta, setPlanRuta] = React.useState<string | null>(() => parametrosDesdeHash().plan ?? null);
  const [pestanna, setPestanna] = React.useState<Pestanna>(() => {
    const t = parametrosDesdeHash().tab;
    const validas: Pestanna[] = ['actividad', 'historial', 'comparar', 'comentarios', 'colaboradores', 'conflictos'];
    return validas.includes(t as Pestanna) ? (t as Pestanna) : 'actividad';
  });

  React.useEffect(() => setMontado(true), []);

  React.useEffect(() => {
    const leer = () => {
      setPlanRuta(parametrosDesdeHash().plan ?? null);
      const t = parametrosDesdeHash().tab as Pestanna;
      const validas: Pestanna[] = ['actividad', 'historial', 'comparar', 'comentarios', 'colaboradores', 'conflictos'];
      setPestanna(validas.includes(t) ? t : 'actividad');
    };
    window.addEventListener('hashchange', leer);
    return () => window.removeEventListener('hashchange', leer);
  }, []);

  React.useEffect(() => {
    if (!montado) return;
    if (!planRuta) {
      navegar('/proyectos');
      return;
    }
    if (planId !== planRuta) void import('@/lib/supabase/sync').then((m) => m.cargarPlan(planRuta!));
  }, [planRuta, montado, planId]);

  const listaConflictos = React.useMemo(
    () => Object.values(conflictos).filter((c): c is NonNullable<typeof c> => !!c),
    [conflictos],
  );

  const alCambiarPestanna = (t: string) => {
    sincronizarHash({ tab: t === 'actividad' ? '' : t });
  };

  if (!montado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Cargando PLANEX Cuba…</div>
      </div>
    );
  }

  if (cargandoSync || (planRuta && planId !== planRuta)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground animate-pulse">Cargando la colaboración del plan…</div>
      </div>
    );
  }

  if (errorCarga && !planMeta) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-xl border bg-card p-6 text-sm space-y-3">
          <div className="flex items-center gap-2 font-semibold"><TriangleAlert className="size-4 text-destructive" /> No se pudo abrir el plan</div>
          <p className="text-muted-foreground text-xs">{errorCarga}</p>
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={() => planRuta && void import('@/lib/supabase/sync').then((m) => m.cargarPlan(planRuta))}>Reintentar</Button>
            <Button size="sm" variant="outline" onClick={() => navegar('/proyectos')}>Volver a proyectos</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* -------------------------------------------------- cabecera del plan */}
      <header className="border-b sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="max-w-6xl mx-auto px-4 py-3 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => planId && navegar(`/editor?plan=${planId}`)} aria-label="Volver al editor del plan">
              <PanelLeftClose className="size-3.5" /> <span className="hidden sm:inline">Volver al editor</span>
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-semibold truncate">{proyecto.nombre || planMeta?.title || 'Plan compartido'}</h1>
              <p className="text-[11px] text-muted-foreground">
                Colaboración, versiones y permisos del espacio compartido
              </p>
            </div>
            {planMeta && (
              <Badge variant="outline" className="text-[10px] shrink-0">{ETIQUETA_ESTADO[planMeta.status]}</Badge>
            )}
            <EstadoSincronizacion />
            <EnlaceAyuda articulo="guia-compartir-plan" etiqueta="Permisos y versiones" />
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4">
          <Tabs value={pestanna} onValueChange={alCambiarPestanna}>
            <TabsList className={`w-full h-auto p-1 overflow-x-auto ${listaConflictos.length > 0 ? 'grid grid-cols-3 sm:grid-cols-6' : 'grid grid-cols-3 sm:grid-cols-5'}`}>
              {PESTANNAS.map((t) => (
                <TabsTrigger key={t.id} value={t.id} className="gap-1.5 text-xs px-2.5 py-1.5 shrink-0">
                  {t.icono} <span className="hidden sm:inline">{t.titulo}</span><span className="sm:hidden">{t.titulo.split(' ')[0]}</span>
                </TabsTrigger>
              ))}
              {listaConflictos.length > 0 && (
                <TabsTrigger value="conflictos" className="gap-1.5 text-xs px-2.5 py-1.5 shrink-0 text-destructive">
                  <AlertTriangle className="size-3.5" /> <span className="hidden sm:inline">Conflictos ({listaConflictos.length})</span><span className="sm:hidden">Conflictos</span>
                </TabsTrigger>
              )}
            </TabsList>
          </Tabs>
        </div>
      </header>

      {/* -------------------------------------------------- contenido */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {pestanna === 'actividad' && <PestannaActividad />}
        {pestanna === 'historial' && <PestannaHistorial />}
        {pestanna === 'comparar' && <PestannaComparar />}
        {pestanna === 'comentarios' && <PestannaComentarios />}
        {pestanna === 'colaboradores' && <PestannaColaboradores />}
        {pestanna === 'conflictos' && (listaConflictos.length > 0 ? <PestannaConflictos /> : <Vacio titulo="Sin conflictos pendientes" detalle="No hay secciones con conflicto de edición en este momento." />)}
      </main>

      {/* Los avisos de esta vista (guardar versión, restaurar, conflictos):
          el Toaster vive AQUÍ porque el editor no está montado en esta vista. */}
      <Toaster richColors position="bottom-right" />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Pestaña: Resumen y actividad
// ----------------------------------------------------------------------------

function PestannaActividad() {
  const planMeta = useSync((s) => s.plan);
  const planId = useSync((s) => s.planId);
  const conectado = useSync((s) => s.conectado);
  const [filas, setFilas] = React.useState<ActividadRow[] | null>(null);
  const [versiones, setVersiones] = React.useState<VersionRow[] | null>(null);
  const [resumen, setResumen] = React.useState(resumenSincronizacion());
  const pendientes = seccionesPendientes();
  const conflictos = useSync((s) => s.conflictos);
  const nConflictos = Object.values(conflictos).filter(Boolean).length;

  React.useEffect(() => {
    const cargar = async () => {
      if (!planId) return;
      try {
        const [acts, vers] = await Promise.all([listarActividad(planId), traerVersiones()]);
        setFilas(acts);
        setVersiones(vers);
      } catch (e) {
        toast.error('No se pudo leer la actividad', { description: (e as Error).message });
        setFilas([]);
      }
    };
    void cargar();
    const id = setInterval(() => setResumen(resumenSincronizacion()), 1500);
    return () => clearInterval(id);
  }, [planId]);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <TarjetaResumen titulo="Estado del plan" valor={planMeta ? ETIQUETA_ESTADO[planMeta.status] : '—'}
          detalle={planMeta ? `Actualizado ${new Date(planMeta.updated_at).toLocaleString('es-ES')}${planMeta.updated_by_name ? ` · por ${planMeta.updated_by_name}` : ''}` : undefined} />
        <TarjetaResumen titulo="Sincronización" valor={resumen.texto} detalle={conectado ? 'Conectado con Supabase' : 'Sin conexión: los cambios se conservan localmente'} />
        <TarjetaResumen titulo="Última versión"
          valor={versiones && versiones.length > 0 ? `v${versiones[0].version_number}` : 'Sin versiones'}
          detalle={versiones && versiones.length > 0 ? `${new Date(versiones[0].created_at).toLocaleString('es-ES')}${versiones[0].created_by_name ? ` · por ${versiones[0].created_by_name}` : ''}` : 'Guarde una versión para dejar un punto de restauración'} />
        <TarjetaResumen titulo="Atención requerida"
          valor={`${nConflictos} conflicto(s) · ${pendientes.length} pendiente(s)`}
          detalle={nConflictos > 0 ? 'Revise la pestaña Conflictos' : pendientes.length > 0 ? 'Cambios locales aún no confirmados en el servidor' : 'Todo confirmado en el servidor'} />
      </div>

      <section className="space-y-2" aria-label="Actividad reciente">
        <h2 className="text-sm font-semibold flex items-center gap-2"><ScrollText className="size-4" /> Actividad del plan</h2>
        <p className="text-xs text-muted-foreground">
          Registro de cambios relevantes con autoría, guardado por el servidor. El registro es append-only:
          ningún colaborador puede editarlo ni borrarlo.
        </p>
        {filas === null && <div className="text-xs text-muted-foreground py-2">Cargando…</div>}
        <div className="space-y-1.5">
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
          {filas?.length === 0 && <Vacio titulo="Sin actividad registrada todavía" detalle="Los cambios confirmados de los colaboradores aparecerán aquí con autoría y fecha." />}
        </div>
      </section>
    </div>
  );
}

function TarjetaResumen({ titulo, valor, detalle }: { titulo: string; valor: string; detalle?: string }) {
  return (
    <div className="rounded-xl border p-3 space-y-1">
      <div className="text-[11px] text-muted-foreground">{titulo}</div>
      <div className="text-sm font-medium leading-snug">{valor}</div>
      {detalle && <div className="text-[11px] text-muted-foreground leading-relaxed">{detalle}</div>}
    </div>
  );
}

function Vacio({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="rounded-xl border border-dashed p-6 text-center space-y-1.5">
      <div className="text-sm font-medium">{titulo}</div>
      <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">{detalle}</p>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Pestaña: Historial de versiones
// ----------------------------------------------------------------------------

function PestannaHistorial() {
  const planId = useSync((s) => s.planId);
  const [versiones, setVersiones] = React.useState<VersionRow[] | null>(null);
  const [cargando, setCargando] = React.useState(false);
  const [descripcion, setDescripcion] = React.useState('');
  const [guardando, setGuardando] = React.useState(false);
  const [restaurando, setRestaurando] = React.useState<string | null>(null);
  const [objetivo, setObjetivo] = React.useState<VersionRow | null>(null);
  const [detalle, setDetalle] = React.useState<string | null>(null);

  const traer = React.useCallback(async () => {
    if (!planId) return;
    setCargando(true);
    try {
      setVersiones(await traerVersiones());
    } catch (e) {
      toast.error('No se pudo leer el historial', { description: (e as Error).message });
    } finally {
      setCargando(false);
    }
  }, [planId]);

  React.useEffect(() => {
    void traer();
  }, [traer]);

  const guardar = async () => {
    if (seccionesPendientes().length > 3 && !confirm('Hay cambios pendientes; se guardarán en el servidor antes de crear la versión. ¿Continuar?')) return;
    setGuardando(true);
    const r = await guardarVersionActual(descripcion);
    setGuardando(false);
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
        description: 'El historial se conserva; el estado anterior quedó como copia de seguridad automática.',
      });
      void traer();
    } else {
      toast.error('No se pudo restaurar', { description: r.error });
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-xl border p-3 space-y-2" aria-label="Guardar versión actual">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold flex items-center gap-2"><Save className="size-4" /> Guardar versión actual</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Instantánea inmutable de TODAS las secciones del plan. Útil antes de cambios estructurales o de una ronda de revisión.
            </p>
          </div>
          <EnlaceAyuda articulo="guia-versiones-comparar" etiqueta="Cómo usar las versiones" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción del cambio (opcional)" className="h-8 text-sm flex-1 min-w-56" />
          <Button size="sm" className="h-8 gap-1.5 shrink-0" onClick={() => void guardar()} disabled={guardando}>
            {guardando ? <Loader2 className="size-3.5 animate-spin" /> : <Save className="size-3.5" />} Guardar versión
          </Button>
        </div>
      </section>

      <section className="space-y-2" aria-label="Versiones guardadas">
        <h2 className="text-sm font-semibold flex items-center gap-2"><History className="size-4" /> Versiones guardadas</h2>
        <p className="text-xs text-muted-foreground">
          Restaurar NO borra el historial: antes de aplicarse se guarda automáticamente una copia de
          seguridad con el estado vigente, de modo que la restauración es trazable y reversible.
        </p>
        {cargando && <div className="text-xs text-muted-foreground">Cargando…</div>}
        {versiones && versiones.length === 0 && (
          <Vacio titulo="Todavía no hay versiones guardadas" detalle="Guarde la primera versión para dejar un punto de restauración con autoría y fecha." />
        )}
        <div className="space-y-2">
          {versiones?.map((v) => {
            const abierto = detalle === v.id;
            return (
              <div key={v.id} className="rounded-xl border p-3 space-y-2.5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium">
                      Versión {v.version_number}
                      <span className="text-muted-foreground font-normal text-xs"> · {v.description || 'sin descripción'}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(v.created_at).toLocaleString('es-ES')} · por {v.created_by_name ?? '—'}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 shrink-0">
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={() => setDetalle(abierto ? null : v.id)} aria-expanded={abierto}>
                      {abierto ? 'Ocultar detalles' : 'Detalles'}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5"
                      onClick={() => sincronizarHash({ tab: 'comparar', a: v.id, b: undefined })}>
                      <GitCompareArrows className="size-3.5" /> Comparar
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" disabled={restaurando === v.id} onClick={() => setObjetivo(v)}>
                      {restaurando === v.id ? <Loader2 className="size-3.5 animate-spin" /> : <History className="size-3.5" />} Restaurar
                    </Button>
                  </div>
                </div>
                {abierto && (
                  <div className="rounded-lg border bg-muted/30 p-2.5 text-xs space-y-1.5">
                    <div className="text-muted-foreground">
                      Instantánea guardada en el servidor. Formato <code>{v.snapshot?.formato ?? 'planex.version.1'}</code>
                      {v.snapshot?.generado ? ` · generada ${new Date(String(v.snapshot.generado)).toLocaleString('es-ES')}` : ''}.
                    </div>
                    <div className="text-muted-foreground">
                      Secciones incluidas ({Object.keys(v.snapshot?.secciones ?? {}).length}):
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {Object.keys(v.snapshot?.secciones ?? {}).map((c) => (
                        <Badge key={c} variant="outline" className="text-[10px] font-normal">{nombreSeccion(c)}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Confirmación de restauración: acción breve y acotada (modal permitido) */}
      <Dialog open={!!objetivo} onOpenChange={(a) => !a && setObjetivo(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Restaurar la versión {objetivo?.version_number}</DialogTitle>
            <DialogDescription>
              Fecha: {objetivo ? new Date(objetivo.created_at).toLocaleString('es-ES') : ''} · Autor: {objetivo?.created_by_name ?? '—'} ·{' '}
              {objetivo?.description || 'sin descripción'}.
              <br /><br />
              Se sustituirá la versión activa del plan por esta instantánea. Antes de aplicar el cambio se
              guardará automáticamente una copia de seguridad con el estado actual y el historial se
              conserva íntegro. ¿Desea continuar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setObjetivo(null)}>Cancelar</Button>
            <Button size="sm" onClick={() => objetivo && void restaurar(objetivo)}>Restaurar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Pestaña: Comparar versiones (diferencias reales campo a campo)
// ----------------------------------------------------------------------------

function PestannaComparar() {
  const [versiones, setVersiones] = React.useState<VersionRow[] | null>(null);
  const [idA, setIdA] = React.useState<string>('');
  const [idB, setIdB] = React.useState<string>('');

  // Selección inicial desde la URL (?a= / ?b=) y enlaces «Comparar» del historial.
  React.useEffect(() => {
    const p = parametrosDesdeHash();
    if (p.a) setIdA(p.a);
    if (p.b) setIdB(p.b);
  }, []);

  React.useEffect(() => {
    void traerVersiones().then((vs) => {
      setVersiones(vs);
      setIdA((prev) => prev || vs[1]?.id || vs[0]?.id || '');
      setIdB((prev) => prev || vs[0]?.id || '');
    }).catch((e) => {
      toast.error('No se pudo leer el historial', { description: (e as Error).message });
      setVersiones([]);
    });
  }, []);

  const va = versiones?.find((v) => v.id === idA) ?? null;
  const vb = versiones?.find((v) => v.id === idB) ?? null;

  const alElegir = (cual: 'a' | 'b', id: string) => {
    if (cual === 'a') setIdA(id);
    else setIdB(id);
    sincronizarHash(cual === 'a' ? { a: id } : { b: id });
  };

  const intercambiar = () => {
    const na = idB;
    const nb = idA;
    setIdA(na);
    setIdB(nb);
    sincronizarHash({ a: na, b: nb });
  };

  const comparacion = React.useMemo(() => (va && vb ? compararSnapshots(va, vb) : null), [va, vb]);
  const nCambios = comparacion?.reduce((s, c) => s + c.diferencias.length, 0) ?? 0;

  return (
    <div className="space-y-5">
      <section className="space-y-2" aria-label="Selección de versiones a comparar">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-sm font-semibold flex items-center gap-2"><GitCompareArrows className="size-4" /> Comparar dos versiones</h2>
          <EnlaceAyuda articulo="guia-versiones-comparar" etiqueta="Cómo comparar" />
        </div>
        <p className="text-xs text-muted-foreground">
          Las diferencias se calculan campo a campo sobre las instantáneas guardadas en el servidor
          (datos generales, supuestos, inversiones, financiación, proyecciones y contenido documental).
          No es una comparación decorativa de fechas.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1 min-w-52 flex-1">
            <label className="text-[11px] text-muted-foreground" htmlFor="version-a">Versión base (A)</label>
            <Select value={idA} onValueChange={(v) => alElegir('a', v)}>
              <SelectTrigger id="version-a" className="h-8 text-xs"><SelectValue placeholder="Versión base" /></SelectTrigger>
              <SelectContent>
                {versiones?.map((v) => (
                  <SelectItem key={v.id} value={v.id} className="text-xs">
                    v{v.version_number} · {new Date(v.created_at).toLocaleDateString('es-ES')} · {v.created_by_name ?? '—'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="icon" className="size-8 shrink-0" onClick={intercambiar} aria-label="Intercambiar versiones" title="Intercambiar A y B">
            <ArrowLeftRight className="size-3.5" />
          </Button>
          <div className="space-y-1 min-w-52 flex-1">
            <label className="text-[11px] text-muted-foreground" htmlFor="version-b">Versión nueva (B)</label>
            <Select value={idB} onValueChange={(v) => alElegir('b', v)}>
              <SelectTrigger id="version-b" className="h-8 text-xs"><SelectValue placeholder="Versión nueva" /></SelectTrigger>
              <SelectContent>
                {versiones?.map((v) => (
                  <SelectItem key={v.id} value={v.id} className="text-xs">
                    v{v.version_number} · {new Date(v.created_at).toLocaleDateString('es-ES')} · {v.created_by_name ?? '—'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {versiones && versiones.length < 2 && (
          <Vacio titulo="Se necesitan al menos dos versiones" detalle="Guarde otra versión desde la pestaña «Historial de versiones» para poder comparar los cambios." />
        )}
      </section>

      {comparacion && (
        <section className="space-y-3" aria-label="Diferencias encontradas">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant={nCambios > 0 ? 'destructive' : 'outline'} className="text-[10px]">
              {nCambios > 0 ? `${nCambios} campo(s) con diferencia` : 'sin cambios'}
            </Badge>
            entre v{va?.version_number} ({new Date(va!.created_at).toLocaleDateString('es-ES')}) y v{vb?.version_number} ({new Date(vb!.created_at).toLocaleDateString('es-ES')}).
          </div>
          {nCambios === 0 && (
            <Vacio titulo="Las dos versiones son idénticas" detalle="Ningún campo de datos cambió entre estas instantáneas. Si esperaba cambios, verifique que comparó las versiones correctas." />
          )}
          {comparacion.map((c) => (
            <div key={c.clave} className="rounded-xl border overflow-hidden">
              <div className="px-3 py-2 bg-muted/50 text-xs font-medium flex items-center justify-between gap-2">
                <span>{c.titulo}</span>
                <Badge variant="outline" className="text-[10px] font-normal shrink-0">
                  {c.diferencias.length > 0 ? `${c.diferencias.length} cambio(s)` : 'sin cambios'}
                </Badge>
              </div>
              {c.diferencias.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/30 text-muted-foreground">
                      <tr>
                        <th className="text-left font-medium px-2.5 py-1.5 w-[28%]">Campo</th>
                        <th className="text-left font-medium px-2.5 py-1.5 w-[36%]">Versión A (v{va?.version_number})</th>
                        <th className="text-left font-medium px-2.5 py-1.5 w-[36%]">Versión B (v{vb?.version_number})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.diferencias.map((d, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-2.5 py-1.5 font-mono text-[11px] align-top break-all">{d.ruta}</td>
                          <td className="px-2.5 py-1.5 align-top font-mono text-[11px] break-all">{d.antes}</td>
                          <td className="px-2.5 py-1.5 align-top font-mono text-[11px] break-all">{d.despues}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

export interface ComparacionSeccion {
  clave: string;
  titulo: string;
  diferencias: { ruta: string; antes: string; despues: string }[];
}

// La comparación real de instantáneas vive en el módulo puro
// src/lib/supabase/comparar-versiones.ts (reexportada para las pruebas y
// el resto de la interfaz).
export { compararSnapshots };

// ----------------------------------------------------------------------------
// Pestaña: Comentarios
// ----------------------------------------------------------------------------

function PestannaComentarios() {
  const planId = useSync((s) => s.planId);
  const usuario = useAuth((s) => s.usuario);
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
    void traer();
  }, [traer]);

  const publicar = async () => {
    if (!texto.trim() || !planId) return;
    setEnviando(true);
    try {
      await agregarComentario(planId, (seccion === 'general' ? null : seccion) as never, texto.trim());
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2"><MessageSquare className="size-4" /> Comentarios del plan</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Observaciones para los colaboradores. Los comentarios no modifican datos financieros ni disparan recálculos.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={seccion} onValueChange={setSeccion}>
          <SelectTrigger className="h-8 text-xs w-56" aria-label="Sección del comentario">
            <SelectValue placeholder="Sección" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="general" className="text-xs">Plan general</SelectItem>
            {CLAVES_SECCION.map((c) => (
              <SelectItem key={c} value={c} className="text-xs">{nombreSeccion(c)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escriba una observación…"
          className="text-sm min-h-[38px] h-[38px] resize-none flex-1 min-w-56"
          rows={2}
          disabled={enviando}
        />
        <Button size="sm" className="gap-1.5 shrink-0 self-end" onClick={() => void publicar()} disabled={enviando || !texto.trim()}>
          {enviando ? <Loader2 className="size-3.5 animate-spin" /> : <MessageSquare className="size-3.5" />} Publicar
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
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        ))}
        {filas?.length === 0 && (
          <Vacio titulo="Sin comentarios todavía" detalle="Use los comentarios para coordinar la revisión sin alterar las cifras del plan." />
        )}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Pestaña: Colaboradores y permisos
// ----------------------------------------------------------------------------

function PestannaColaboradores() {
  const usuario = useAuth((s) => s.usuario);
  const planMeta = useSync((s) => s.plan);
  const [miembros, setMiembros] = React.useState<MiembroWorkspace[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const workspaceId = planMeta?.workspace_id ?? usuario?.membresia?.workspace_id;
    if (!workspaceId) return;
    void listarMiembrosWorkspace(workspaceId)
      .then(setMiembros)
      .catch((e) => {
        setError((e as Error).message);
        setMiembros([]);
      });
  }, [planMeta?.workspace_id, usuario?.membresia?.workspace_id]);

  const nombre = (m: MiembroWorkspace) => {
    const propio = usuario?.id === m.user_id;
    if (propio) return `${m.perfil?.display_name ?? usuario?.perfil?.display_name ?? 'Usted'} (usted)`;
    return m.perfil?.display_name ?? 'Colaborador del espacio';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-2"><Users className="size-4" /> Colaboradores y permisos</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Participantes del espacio compartido «{usuario?.membresia?.workspaces?.name ?? 'PLANEX'}» y su rol real.
          </p>
        </div>
        <EnlaceAyuda articulo="guia-compartir-plan" etiqueta="Cómo funcionan los permisos" />
      </div>

      <div className="rounded-xl border overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-3 py-2">Participante</th>
              <th className="text-left font-medium px-3 py-2">Rol</th>
              <th className="text-left font-medium px-3 py-2">Miembro desde</th>
            </tr>
          </thead>
          <tbody>
            {miembros === null && !error && (
              <tr><td colSpan={3} className="px-3 py-3 text-muted-foreground">Cargando…</td></tr>
            )}
            {miembros?.map((m) => (
              <tr key={`${m.workspace_id}-${m.user_id}`} className="border-t">
                <td className="px-3 py-2">{nombre(m)}</td>
                <td className="px-3 py-2">
                  <Badge variant="outline" className="text-[10px]">{ETIQUETA_ROL[m.role]}</Badge>
                </td>
                <td className="px-3 py-2">{new Date(m.created_at).toLocaleDateString('es-ES')}</td>
              </tr>
            ))}
            {miembros?.length === 0 && (
              <tr><td colSpan={3} className="px-3 py-3 text-muted-foreground">Sin miembros visibles.</td></tr>
            )}
            {error && (
              <tr><td colSpan={3} className="px-3 py-3 text-muted-foreground">No se pudo leer la lista de miembros: {error}</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="rounded-xl border p-3 text-xs space-y-1.5 text-muted-foreground">
        <p><b className="text-foreground">Qué puede hacer cada rol:</b></p>
        <ul className="list-disc pl-4 space-y-1">
          <li><b className="text-foreground">Editor</b>: editar todas las secciones del plan, guardar versiones, restaurar con confirmación, comentar y exportar. La autoría de cada cambio queda registrada en la actividad.</li>
          <li>El aislamiento entre proyectos y usuarios lo aplican las políticas RLS del servidor: un usuario sin membresía del espacio no puede leer ni escribir sus planes, ni siquiera construyendo peticiones a mano.</li>
          <li>Las secciones usan control de concurrencia optimista: si dos editores modifican la misma sección, el sistema lo detecta y exige una resolución explícita (pestaña Conflictos). Nunca fusiona cifras automáticamente.</li>
          <li>Los comentarios y el registro de actividad no alteran los datos financieros del plan.</li>
        </ul>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Pestaña: Conflictos de edición
// ----------------------------------------------------------------------------

function PestannaConflictos() {
  const conflictos = useSync((s) => s.conflictos);
  const proyecto = usePlanex((s) => s.proyecto);
  const [detallando, setDetallando] = React.useState<string | null>(null);

  const lista = Object.values(conflictos).filter((c): c is NonNullable<typeof c> => !!c);
  const contenidoLocal = (clave: string) => extraerContenidoLocal(proyecto, clave as never);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-xs space-y-1.5">
        <div className="flex items-center gap-2 font-medium text-destructive">
          <AlertTriangle className="size-4" /> Conflictos de edición ({lista.length})
        </div>
        <p className="text-muted-foreground leading-relaxed">
          Otro colaborador guardó estas secciones mientras usted las editaba. Su trabajo local se ha
          conservado íntegro: compare los cambios y decida explícitamente. No se efectúa ninguna fusión
          automática de datos financieros.
        </p>
      </div>

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
                <ArrowUpRight className="size-3.5" /> Sobrescribir con la mía
              </Button>
            </div>

            {detallando === c.clave && (
              <div className="rounded-lg border overflow-hidden text-xs">
                <div className="overflow-x-auto">
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
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
