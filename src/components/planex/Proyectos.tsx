'use client';

// ============================================================================
// PLANEX — Panel de proyectos compartidos (pantalla inicial de la app).
//
// Sustituye la dependencia exclusiva de plantillas locales: muestra los
// planes del espacio de trabajo compartido en Supabase con su plantilla de
// origen, autor de creación, última actualización y autor de la última
// modificación, y estado de elaboración. Desde aquí se crean planes desde
// las plantillas (Clínica Estomatológica con datos ficticios / Default con
// ayudas), se importan proyectos JSON como planes compartidos, se duplican
// y se abren para editar.
//
// La lista se refresca por Realtime: un plan creado por el otro
// colaborador aparece sin recargar. Todos los accesos pasan por RLS.
// ============================================================================

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Toaster } from '@/components/ui/sonner';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import {
  ArrowDownToLine, Copy, FileJson, FolderOpen, LayoutTemplate, LogOut, Moon, Plus, RefreshCw, Stethoscope, Sun, Users,
} from 'lucide-react';
import { useAuth } from '@/lib/supabase/auth';
import { supabase } from '@/lib/supabase/cliente';
import type { PlanRow, PerfilRow } from '@/lib/supabase/tipos';
import {
  actualizarEstadoPlan,
  crearPlanCompartido,
  duplicarPlanCompartido,
  listarProyectos,
} from '@/lib/supabase/datos';
import { usePlanex } from '@/lib/planex/store';
import { crearProyectoClinica } from '@/lib/planex/templates/clinica';
import { crearProyectoDefault } from '@/lib/planex/templates/default';
import { parsearProyectoJSON } from '@/lib/planex/io/jsonio';
import { descargarPlan } from '@/lib/supabase/sync';
import { navegar } from './navegacion';

const ETIQUETA_ESTADO: Record<PlanRow['status'], string> = {
  borrador: 'Borrador',
  en_revision: 'En revisión',
  finalizado: 'Finalizado',
};

const CLASE_ESTADO: Record<PlanRow['status'], string> = {
  borrador: 'bg-muted text-muted-foreground',
  en_revision: 'bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200',
  finalizado: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200',
};

function formatearFecha(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

export default function Proyectos() {
  const usuario = useAuth((s) => s.usuario);
  const salir = useAuth((s) => s.salir);
  const { theme, setTheme } = useTheme();
  const [proyectos, setProyectos] = React.useState<PlanRow[] | null>(null);
  const [autores, setAutores] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);
  const [creando, setCreando] = React.useState(false);
  const [verCrear, setVerCrear] = React.useState(false);
  const [refrescando, setRefrescando] = React.useState(false);
  const inputJson = React.useRef<HTMLInputElement>(null);

  const workspaceId = usuario?.membresia?.workspace_id ?? null;
  const rolTexto = usuario?.membresia?.role === 'owner' ? 'propietario' : usuario?.membresia?.role === 'viewer' ? 'lectura' : 'editor';

  const refrescar = React.useCallback(async () => {
    if (!workspaceId) return;
    setRefrescando(true);
    try {
      const lista = await listarProyectos(workspaceId);
      setProyectos(lista);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setRefrescando(false);
    }
  }, [workspaceId]);

  // Carga inicial + autores visibles del espacio (para nombrar creadores).
  React.useEffect(() => {
    void refrescar();
    if (!workspaceId) return;
    void (async () => {
      try {
        const { data: miembros } = await supabase()
          .from('workspace_members')
          .select('user_id')
          .eq('workspace_id', workspaceId);
        const ids = (miembros ?? []).map((m) => m.user_id as string);
        if (ids.length === 0) return;
        const { data: perfiles } = await supabase()
          .from('profiles')
          .select('id,display_name,username')
          .in('id', ids);
        const mapa: Record<string, string> = {};
        for (const p of (perfiles ?? []) as PerfilRow[]) {
          mapa[p.id] = p.display_name || p.username;
        }
        setAutores(mapa);
      } catch {
        /* sin nombres de autores: se muestran genéricos */
      }
    })();
  }, [refrescar, workspaceId]);

  // Realtime: refrescar cuando cualquier colaborador cree/modifique planes.
  React.useEffect(() => {
    if (!workspaceId) return;
    const sb = supabase();
    const canal = sb
      .channel(`planex-ws-${workspaceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'plans', filter: `workspace_id=eq.${workspaceId}` },
        () => {
          void refrescar();
        },
      )
      .subscribe();
    return () => {
      try {
        void sb.removeChannel(canal);
      } catch {
        /* canal ya cerrado */
      }
    };
  }, [workspaceId, refrescar]);

  const crearDesdePlantilla = async (plantilla: 'clinica' | 'default') => {
    if (!workspaceId) return;
    setCreando(true);
    try {
      const proyecto = plantilla === 'clinica' ? crearProyectoClinica() : crearProyectoDefault();
      const plan = await crearPlanCompartido(
        workspaceId,
        plantilla === 'clinica' ? 'Clínica Estomatológica (ejemplo ilustrativo)' : 'Plan de negocios nuevo',
        plantilla,
        proyecto,
      );
      toast.success('Plan creado en el espacio compartido', {
        description: 'Las secciones, parámetros y reglas iniciales se guardaron en Supabase.',
      });
      setVerCrear(false);
      navegar(`/editor?plan=${plan.id}`);
    } catch (e) {
      toast.error('No se pudo crear el plan', { description: (e as Error).message });
    } finally {
      setCreando(false);
    }
  };

  const importarJSON = async (archivo: File) => {
    if (!workspaceId) return;
    setCreando(true);
    try {
      const texto = await archivo.text();
      const res = parsearProyectoJSON(texto);
      if (!res.ok || !res.proyecto) {
        toast.error('JSON rechazado', { description: res.errores.join(' · ') });
        return;
      }
      const proyecto = res.proyecto;
      const plantilla = proyecto.planex.plantillaOrigen === 'clinica' ? 'clinica' : 'default';
      const plan = await crearPlanCompartido(workspaceId, proyecto.nombre || 'Proyecto importado', plantilla, proyecto);
      toast.success('Proyecto importado como plan compartido', {
        description: res.avisos.join(' ') || 'Reglas y parámetros del archivo conservados.',
      });
      setVerCrear(false);
      navegar(`/editor?plan=${plan.id}`);
    } catch (e) {
      toast.error('No se pudo importar el JSON', { description: (e as Error).message });
    } finally {
      setCreando(false);
      if (inputJson.current) inputJson.current.value = '';
    }
  };

  const duplicar = async (plan: PlanRow) => {
    setCreando(true);
    try {
      const copia = await duplicarPlanCompartido(plan, `${plan.title} — copia`);
      toast.success('Copia creada', { description: `«${copia.title}» queda disponible en el espacio compartido.` });
      void refrescar();
    } catch (e) {
      toast.error('No se pudo duplicar', { description: (e as Error).message });
    } finally {
      setCreando(false);
    }
  };

  const cambiarEstado = async (plan: PlanRow, estado: PlanRow['status']) => {
    setProyectos((prev) => prev?.map((p) => (p.id === plan.id ? { ...p, status: estado } : p)) ?? null);
    const ok = await actualizarEstadoPlan(plan.id, estado);
    if (!ok) {
      toast.error('No se pudo actualizar el estado');
      void refrescar();
    } else {
      toast.success(`Estado: ${ETIQUETA_ESTADO[estado]}`);
    }
  };

  const cerrarSesion = async () => {
    descargarPlan();
    await salir();
    navegar('/');
  };

  if (!usuario) return null;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          <div className="flex items-center gap-2 mr-1">
            <div className="size-8 rounded-lg bg-primary text-primary-foreground grid place-items-center font-bold text-sm">PX</div>
            <div className="leading-tight">
              <div className="font-semibold text-sm">PLANEX Cuba</div>
              <div className="text-[10px] text-muted-foreground">Proyectos compartidos</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-1 min-w-40">
            <Users className="size-3.5" />
            <span className="truncate">
              {usuario.membresia?.workspaces?.name ?? 'Espacio compartido'} · <b className="text-foreground font-medium">{usuario.perfil?.display_name ?? usuario.alias}</b> ({rolTexto})
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => void refrescar()} disabled={refrescando} aria-label="Refrescar la lista">
              <RefreshCw className={`size-3.5 ${refrescando ? 'animate-spin' : ''}`} />
            </Button>
            <Button size="sm" className="h-8 gap-1.5" onClick={() => setVerCrear(true)}>
              <Plus className="size-3.5" /> <span className="hidden sm:inline">Nuevo plan</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Cambiar tema"
            >
              {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => void cerrarSesion()}
              aria-label="Cerrar sesión"
              title="Cerrar sesión (los proyectos guardados se conservan)"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 p-4 md:p-6 max-w-6xl w-full mx-auto">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-lg font-semibold">Proyectos del espacio compartido</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Los planes viven en Supabase: ambos colaboradores ven, editan y exportan las mismas versiones. El
              acceso está protegido por autenticación y políticas RLS del servidor.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 text-destructive text-sm p-3 mb-4" role="alert">
            {error}
          </div>
        )}

        {proyectos === null ? (
          <div className="text-sm text-muted-foreground py-10 text-center">Cargando los proyectos compartidos…</div>
        ) : proyectos.length === 0 ? (
          <div className="rounded-xl border border-dashed p-8 text-center">
            <FolderOpen className="size-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">Todavía no hay proyectos compartidos</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">
              Cree el primero desde una plantilla: el contenido inicial (secciones, parámetros y reglas) se
              guardará en Supabase sin modificar la plantilla original.
            </p>
            <Button size="sm" className="gap-1.5" onClick={() => setVerCrear(true)}>
              <Plus className="size-4" /> Crear el primer plan
            </Button>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-3 py-2.5">Proyecto</th>
                  <th className="text-left font-medium px-3 py-2.5 hidden md:table-cell">Plantilla</th>
                  <th className="text-left font-medium px-3 py-2.5 hidden lg:table-cell">Creado por</th>
                  <th className="text-left font-medium px-3 py-2.5">Última actualización</th>
                  <th className="text-left font-medium px-3 py-2.5 hidden sm:table-cell">Estado</th>
                  <th className="text-right font-medium px-3 py-2.5">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {proyectos.map((p) => (
                  <tr key={p.id} className="border-t hover:bg-muted/30">
                    <td className="px-3 py-2.5 max-w-60">
                      <button
                        className="text-left font-medium text-foreground hover:underline truncate block max-w-full"
                        onClick={() => navegar(`/editor?plan=${p.id}`)}
                        title={p.title}
                      >
                        {p.title}
                      </button>
                    </td>
                    <td className="px-3 py-2.5 hidden md:table-cell">
                      <Badge variant="outline" className="text-[10px] gap-1">
                        {p.template_key === 'clinica' ? (
                          <>
                            <Stethoscope className="size-2.5" /> Clínica
                          </>
                        ) : (
                          <>
                            <LayoutTemplate className="size-2.5" /> Default
                          </>
                        )}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground hidden lg:table-cell">
                      {autores[p.created_by] ?? '—'}
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      <div className="text-foreground">{formatearFecha(p.updated_at)}</div>
                      <div className="text-muted-foreground">por {p.updated_by_name ?? autores[p.updated_by ?? ''] ?? '—'}</div>
                    </td>
                    <td className="px-3 py-2.5 hidden sm:table-cell">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${CLASE_ESTADO[p.status]}`} title="Cambiar estado de elaboración">
                            {ETIQUETA_ESTADO[p.status]}
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          {(Object.keys(ETIQUETA_ESTADO) as PlanRow['status'][]).map((s) => (
                            <DropdownMenuItem key={s} onClick={() => void cambiarEstado(p, s)} disabled={s === p.status}>
                              {ETIQUETA_ESTADO[s]}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => navegar(`/editor?plan=${p.id}`)}>
                        Abrir
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 ml-1"
                        onClick={() => void duplicar(p)}
                        title="Duplicar el plan"
                        aria-label={`Duplicar ${p.title}`}
                      >
                        <Copy className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[11px] text-muted-foreground mt-4">
          Nota: la plantilla «Clínica Estomatológica» contiene datos ficticios de demostración; la tasa del
          impuesto sobre utilidades (35 %) es un supuesto editable, no la tasa legal aplicable.
        </p>
      </main>

      <input
        ref={inputJson}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && void importarJSON(e.target.files[0])}
      />

      <Dialog open={verCrear} onOpenChange={setVerCrear}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Crear un plan compartido</DialogTitle>
            <DialogDescription>
              Las plantillas se mantienen separadas de los proyectos: crear un plan guarda su contenido inicial
              en Supabase (secciones, parámetros y reglas) sin modificar la plantilla original ni otros planes.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              className="rounded-xl border p-4 text-left hover:border-primary transition-colors disabled:opacity-50"
              onClick={() => void crearDesdePlantilla('clinica')}
              disabled={creando}
            >
              <div className="flex items-center gap-2 font-semibold text-sm">
                <Stethoscope className="size-4 text-primary" /> Clínica Estomatológica
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Ejemplo completo con datos ficticios coherentes: 9 servicios, inversión 1 480 kUSD, horizonte
                de 10 años, recuperación ≈ 4 años. Ideal para explorar el motor de cálculo.
              </p>
              <Badge variant="secondary" className="mt-2 text-[10px]">Ejemplo ilustrativo</Badge>
            </button>
            <button
              className="rounded-xl border p-4 text-left hover:border-primary transition-colors disabled:opacity-50"
              onClick={() => void crearDesdePlantilla('default')}
              disabled={creando}
            >
              <div className="flex items-center gap-2 font-semibold text-sm">
                <LayoutTemplate className="size-4 text-primary" /> Default (general)
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Estructura metodológica completa con formularios, ayudas por apartado y reglas activas. Los
                cálculos con datos no completados indican qué falta.
              </p>
              <Badge variant="secondary" className="mt-2 text-[10px]">Vacía · con ayudas</Badge>
            </button>
            <button
              className="rounded-xl border p-4 text-left hover:border-primary transition-colors disabled:opacity-50 sm:col-span-2"
              onClick={() => inputJson.current?.click()}
              disabled={creando}
            >
              <div className="flex items-center gap-2 font-semibold text-sm">
                <FileJson className="size-4 text-primary" /> Importar proyecto JSON como plan compartido
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Importa un proyecto exportado previamente. Se valida el esquema, se recalcula y queda
                disponible para ambos colaboradores. Las reglas y parámetros del archivo se conservan.
              </p>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Toaster richColors position="bottom-right" />
    </div>
  );
}
