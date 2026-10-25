'use client';

// ============================================================================
// PLANEX Cuba — shell del editor (vista #/editor?plan=<uuid>).
//
// El plan abierto vive en el espacio compartido de Supabase: cada cambio
// dispara el autoguardado con control de concurrencia (motor de
// sincronización); la barra muestra el estado REAL frente al servidor
// (pendiente/guardando/guardado/error/conflicto/sin conexión). Las
// exportaciones se hacen desde una versión consistente: antes de exportar
// se confirma lo pendiente y se advierte de conflictos sin resolver.
//
// Barra superior, navegación por apartados, panel de alertas, historial de
// versiones, actividad y comentarios. Tema Dark/Light persistente.
// ============================================================================

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTheme } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import {
  Activity, AlertTriangle, ArrowDownToLine, Bell, ChevronLeft, ChevronRight, CircleHelp, CloudOff, Eye, FileDown, FileSpreadsheet, FileText,
  FolderOpen, HardDriveDownload, LayoutTemplate, ListChecks, LogOut, Moon,
  Save, Stethoscope, Sun, TriangleAlert, Upload, Users, X,
} from 'lucide-react';
import { usePlanex } from '@/lib/planex/store';
import { computeProject } from '@/lib/planex/engine/engine';
import { calcularCumplimiento } from '@/lib/planex/model/cumplimiento';
import { diagnosticar } from '@/lib/planex/model/controles';
import { proyectoAJSON, descargarArchivo, nombreArchivoSeguro } from '@/lib/planex/io/jsonio';
import { useAuth } from '@/lib/supabase/auth';
import {
  actualizarEstadoPlan,
  cargarPlan,
  descargarPlan,
  recuperarCambiosLocales,
  resumenConflictos,
  seccionesPendientes,
  sincronizarAhora,
  useSync,
} from '@/lib/supabase/sync';
import type { PlanRow } from '@/lib/supabase/tipos';
import { navegar, parametrosDesdeHash, abrirAyuda } from './navegacion';
import { nombreSeccion } from '@/lib/planex/secciones-sync';
// import { EtiquetaIssue } from './comunes'; // sustituido por el panel de diagnóstico (misión §15)
import { EstadoSincronizacion } from './Colaboracion';
import { SeccionGeneral, SeccionResumen, SeccionNegocio } from './secciones/secciones1';
import { SeccionTecnico, SeccionFinanciero } from './secciones/secciones2';
import { SeccionMercado, SeccionFuerza, SeccionInversiones, SeccionBeneficios, SeccionConclusiones } from './secciones/secciones3';
import { SeccionConfig } from './config';

const NAV: { id: string; num: string; titulo: string }[] = [
  { id: 'general', num: '4.1–4.3', titulo: 'Información general e índice' },
  { id: 'resumen', num: '4.4', titulo: 'Resumen ejecutivo' },
  { id: 'negocio', num: '4.5', titulo: 'Descripción del negocio' },
  { id: 'tecnico', num: '4.6', titulo: 'Aspectos técnicos' },
  { id: 'financiero', num: '4.7', titulo: 'Análisis financiero' },
  { id: 'mercado', num: '4.8', titulo: 'Mercado' },
  { id: 'fuerza', num: '4.9', titulo: 'Fuerza de trabajo' },
  { id: 'inversiones', num: '4.10', titulo: 'Inversiones' },
  { id: 'beneficios', num: '4.11', titulo: 'Beneficios al país' },
  { id: 'conclusiones', num: '4.12', titulo: 'Conclusiones' },
  { id: 'config', num: '⚙', titulo: 'Configuración de cálculos' },
];

const ETIQUETA_ESTADO: Record<PlanRow['status'], string> = {
  borrador: 'Borrador',
  en_revision: 'En revisión',
  finalizado: 'Finalizado',
};

export function PlanexApp() {
  const proyecto = usePlanex((s) => s.proyecto);
  const seccion = usePlanex((s) => s.seccion);
  const store = usePlanex();
  const { theme, setTheme } = useTheme();
  const usuario = useAuth((s) => s.usuario);
  const salir = useAuth((s) => s.salir);
  const planId = useSync((s) => s.planId);
  const planMeta = useSync((s) => s.plan);
  const cargandoSync = useSync((s) => s.cargando);
  const errorCarga = useSync((s) => s.errorCarga);
  const conectado = useSync((s) => s.conectado);
  const tienePendientesLocal = useSync((s) => s.tienePendientesLocal);
  const conflictos = useSync((s) => s.conflictos);

  const [montado, setMontado] = React.useState(false);
  const [planRuta, setPlanRuta] = React.useState<string | null>(() => parametrosDesdeHash().plan ?? null);
  const [verAlertas, setVerAlertas] = React.useState(false);
  const [exportando, setExportando] = React.useState(false);

  React.useEffect(() => setMontado(true), []);

  // Plan solicitado por la URL (#/editor?plan=<uuid>): entradas directas,
  // recargas y navegación con Atrás/Adelante funcionan; sin parámetro se
  // vuelve al panel de proyectos.
  React.useEffect(() => {
    const leer = () => setPlanRuta(parametrosDesdeHash().plan ?? null);
    window.addEventListener('hashchange', leer);
    return () => window.removeEventListener('hashchange', leer);
  }, []);

  React.useEffect(() => {
    if (!montado) return;
    if (!planRuta) {
      navegar('/proyectos');
      return;
    }
    void cargarPlan(planRuta).then((r) => {
      if (!r.ok && r.error) {
        toast.error('No se pudo abrir el plan', { description: r.error, duration: 9000 });
      }
    });
  }, [planRuta, montado]);

  // Aviso antes de salir si quedan cambios sin confirmar en el servidor.
  React.useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (seccionesPendientes().length > 0) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, []);

  const modelo = React.useMemo(() => computeProject(proyecto), [proyecto]);
  const cumplimiento = React.useMemo(() => calcularCumplimiento(proyecto, modelo), [proyecto, modelo]);
  const diagnostico = React.useMemo(() => diagnosticar(proyecto, modelo), [proyecto, modelo]);
  const errores = modelo.issues.filter((i) => i.tipo === 'error');
  const pendientes = modelo.issues.filter((i) => i.tipo === 'pendiente');
  const incidencias = modelo.issues.filter((i) => i.tipo === 'inconsistencia');
  const idxNav = NAV.findIndex((n) => n.id === seccion);
  const listaConflictos = resumenConflictos();

  // ------------------------------------------------------------------ acciones
  const irAConflictos = () => {
    if (planId) navegar(`/colaboracion?plan=${planId}&tab=conflictos`);
  };

  const guardar = async () => {
    const r = await sincronizarAhora();
    if (r.conflictos > 0) {
      irAConflictos();
      return;
    }
    if (r.errores > 0) {
      toast.error('No se pudieron confirmar todos los cambios', {
        description: 'Su trabajo se conserva en este navegador y se reintentará automáticamente.',
      });
      return;
    }
    toast.success('Cambios guardados en Supabase', { description: 'Ambos colaboradores verán esta versión.' });
  };

  const exportarJson = () => {
    descargarArchivo(`${nombreArchivoSeguro(proyecto.titulo.nombreProyecto || proyecto.nombre)}.planex.json`, proyectoAJSON(proyecto));
    toast.success('Proyecto exportado como JSON (esquema versionado)', {
      description: 'Incluye secciones, datos narrativos, tablas, parámetros y reglas de cálculo.',
    });
  };

  /** Exporta solo tras confirmar lo pendiente y advertir de conflictos. */
  const preparadoParaExportar = async (): Promise<boolean> => {
    const r = await sincronizarAhora();
    if (r.conflictos > 0) {
      irAConflictos();
      return confirm(
        'Hay conflictos de edición sin resolver. La exportación usaría sus datos locales vigentes, que pueden no coincidir con la última versión confirmada en el servidor. ¿Exportar de todos modos?',
      );
    }
    if (r.errores > 0) {
      return confirm(
        'No se pudieron confirmar todos los cambios en el servidor (¿ conexión ?). La exportación usará los datos locales pendientes. ¿Continuar?',
      );
    }
    return true;
  };

  const exportarPdf = async () => {
    if (errores.length > 0 && !confirm(`Hay ${errores.length} error(es) de cálculo. El PDF se generará con las partidas afectadas marcadas. ¿Continuar?`)) return;
    if (!(await preparadoParaExportar())) return;
    setExportando(true);
    try {
      const { exportarPDF } = await import('@/lib/planex/io/pdf');
      const { datos, nombre } = exportarPDF(proyecto, modelo);
      descargarArchivo(nombre.replace(/[^\w.\- áéíóúÁÉÍÓÚñÑ]/g, ''), datos, 'application/pdf');
      toast.success('PDF generado con la versión vigente de datos y reglas');
    } catch (e) {
      toast.error('No se pudo generar el PDF', { description: (e as Error).message });
    } finally {
      setExportando(false);
    }
  };

  const exportarWord = async () => {
    if (errores.length > 0 && !confirm(`Hay ${errores.length} error(es) de cálculo. El Word se generará con las partidas afectadas marcadas. ¿Continuar?`)) return;
    if (!(await preparadoParaExportar())) return;
    setExportando(true);
    try {
      const { exportarDOCX } = await import('@/lib/planex/io/docx');
      const { datos, nombre } = await exportarDOCX(proyecto, modelo);
      descargarArchivo(nombre.replace(/[^\w.\- áéíóúÁÉÍÓÚñÑ]/g, ''), datos, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      toast.success('Documento Word generado con el mismo modelo documental que el PDF');
    } catch (e) {
      toast.error('No se pudo generar el documento Word', { description: (e as Error).message });
    } finally {
      setExportando(false);
    }
  };

  const exportarExcel = async () => {
    if (errores.length > 0 && !confirm(`Hay ${errores.length} error(es) de cálculo: las partidas afectadas se exportarán marcadas como #ERROR y documentadas en la hoja «Reglas». ¿Continuar?`)) return;
    if (!(await preparadoParaExportar())) return;
    setExportando(true);
    try {
      const { exportarXLSX } = await import('@/lib/planex/io/xlsx');
      const { datos, nombre, noTraducibles } = await exportarXLSX(proyecto, modelo);
      descargarArchivo(nombre.replace(/[^\w.\- áéíóúÁÉÍÓÚñÑ]/g, ''), datos, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      if (noTraducibles.length) {
        toast.warning(`Excel generado con ${noTraducibles.length} regla(s) no traducible(s)`, {
          description: 'Se exportaron como valor estático, documentadas en la hoja «Reglas»: ' + noTraducibles.map((x) => x.nombre).join(', '),
        });
      } else {
        toast.success('Libro Excel generado con fórmulas reales y recálculo automático al abrir');
      }
    } catch (e) {
      toast.error('No se pudo generar el Excel', { description: (e as Error).message });
    } finally {
      setExportando(false);
    }
  };

  const cambiarEstadoPlan = async (estado: PlanRow['status']) => {
    if (!planId) return;
    const ok = await actualizarEstadoPlan(planId, estado);
    if (ok) toast.success(`Estado del plan: ${ETIQUETA_ESTADO[estado]}`);
    else toast.error('No se pudo actualizar el estado');
  };

  const salirAplicacion = async () => {
    descargarPlan();
    await salir();
    navegar('/');
  };

  /** Lleva al editor de la sección asociada a un hallazgo del diagnóstico. */
  const irAHallazgo = (partida?: string) => {
    const mapa: Record<string, string> = {
      '4.1': 'general',
      '4.5': 'negocio',
      '4.8': 'mercado',
      general: 'general',
      negocio: 'negocio',
      tecnico: 'tecnico',
      financiero: 'financiero',
      inversiones: 'inversiones',
      mercado: 'mercado',
      fuerza: 'fuerza',
      config: 'config',
    };
    const destino = partida ? mapa[partida] ?? partida.split(':')[0] : undefined;
    if (destino) store.setSeccion(destino);
    setVerAlertas(false);
  };

  // ------------------------------------------------------------------ render
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
        <div className="text-sm text-muted-foreground animate-pulse">Cargando el plan compartido…</div>
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
            <Button size="sm" variant="outline" onClick={() => planRuta && void cargarPlan(planRuta)}>Reintentar</Button>
            <Button size="sm" variant="outline" onClick={() => navegar('/proyectos')}>Volver a proyectos</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* -------------------------------------------------- barra superior */}
      <header className="border-b sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          <div className="flex items-center gap-2 mr-1">
            <div className="size-8 rounded-lg bg-primary text-primary-foreground grid place-items-center font-bold text-sm">PX</div>
            <div className="leading-tight hidden sm:block">
              <div className="font-semibold text-sm">PLANEX Cuba</div>
              <div className="text-[10px] text-muted-foreground">Plan de Negocios · GOC-2026-O57</div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-52">
            <Input
              value={proyecto.nombre}
              onChange={(e) => store.actualizar((x) => void (x.nombre = e.target.value))}
              className="h-8 text-sm font-medium max-w-md"
              aria-label="Nombre del proyecto"
            />
            <Badge variant="outline" className="text-[10px] shrink-0">
              {proyecto.planex.plantillaOrigen === 'clinica' ? (
                <>
                  <Stethoscope className="size-2.5 mr-1" /> Clínica (demo)
                </>
              ) : proyecto.planex.plantillaOrigen === 'centro' ? (
                <>
                  <Activity className="size-2.5 mr-1" /> Centro diagnóstico (demo)
                </>
              ) : (
                <>
                  <LayoutTemplate className="size-2.5 mr-1" /> Default
                </>
              )}
            </Badge>
            <EstadoSincronizacion />
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1.5 rounded-lg border px-2 py-1" title="Cumplimentación del plan">
              <ListChecks className="size-3.5 text-muted-foreground" />
              <Progress value={cumplimiento.total} className="h-1.5 w-16" />
              <span className="text-[11px] tabular-nums text-muted-foreground">{cumplimiento.total}%</span>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" aria-label="Estado de elaboración">
                  {planMeta ? ETIQUETA_ESTADO[planMeta.status] : '—'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => void cambiarEstadoPlan('borrador')} disabled={planMeta?.status === 'borrador'}>Marcar como borrador</DropdownMenuItem>
                <DropdownMenuItem onClick={() => void cambiarEstadoPlan('en_revision')} disabled={planMeta?.status === 'en_revision'}>Marcar en revisión</DropdownMenuItem>
                <DropdownMenuItem onClick={() => void cambiarEstadoPlan('finalizado')} disabled={planMeta?.status === 'finalizado'}>Marcar finalizado</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setVerAlertas(true)} aria-label="Alertas de consistencia">
              <Bell className="size-3.5" />
              {errores.length > 0 && <span className="size-1.5 rounded-full bg-destructive animate-pulse" />}
              <span className="text-[11px] tabular-nums">{errores.length + incidencias.length + pendientes.length}</span>
            </Button>

            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => navegar('/proyectos')}>
              <FolderOpen className="size-3.5" /> <span className="hidden md:inline">Proyectos</span>
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => void guardar()}>
              <Save className="size-3.5" /> <span className="hidden md:inline">Guardar</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5">
                  <FileDown className="size-3.5" /> <span className="hidden md:inline">Exportar</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Intercambio y documentos</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => navegar(planId ? `/preview?plan=${planId}` : '/proyectos')} className="gap-2">
                  <Eye className="size-4" /> Previsualizar documento (PDF real)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void exportarPdf()} disabled={exportando} className="gap-2">
                  <ArrowDownToLine className="size-4" /> Exportar PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void exportarWord()} disabled={exportando} className="gap-2">
                  <FileText className="size-4" /> Exportar Word (.docx)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void exportarExcel()} disabled={exportando} className="gap-2">
                  <FileSpreadsheet className="size-4" /> Exportar libro Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={exportarJson} className="gap-2">
                  <HardDriveDownload className="size-4" /> Exportar JSON del proyecto
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => navegar(planId ? `/colaboracion?plan=${planId}` : '/proyectos')}
              aria-label="Colaboración, historial de versiones y permisos del plan"
              title="Colaboración, historial de versiones, comparación y permisos (vista integrada)"
            >
              <Users className="size-3.5" /> <span className="hidden lg:inline">Colaboración</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => abrirAyuda()}
              aria-label="Ayuda y guía de trabajo (se abre en otra pestaña)"
              title="Ayuda y guía de trabajo: tutoriales, guías, referencia y conceptos (otra pestaña)"
            >
              <CircleHelp className="size-3.5" /> <span className="hidden lg:inline">Ayuda</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Cambiar tema"
              title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
            >
              {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-8"
              onClick={() => void salirAplicacion()}
              aria-label="Cerrar sesión"
              title="Cerrar sesión y volver a la presentación (los proyectos guardados se conservan)"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>

        {/* -------------------------------------------------- avisos de sincronización */}
        {listaConflictos.length > 0 && (
          <div className="px-3 pb-2">
            <button
              className="w-full rounded-md border border-destructive/50 bg-destructive/10 px-3 py-1.5 text-xs text-destructive text-left flex items-center gap-2 hover:bg-destructive/15"
              onClick={irAConflictos}
            >
              <AlertTriangle className="size-3.5 shrink-0" />
              <b>{listaConflictos.length} sección(es) con conflicto de edición</b>
              <span className="truncate">
                — {listaConflictos.map((c) => nombreSeccion(c.clave)).join(', ')}
              </span>
              <span className="ml-auto shrink-0 underline">Revisar ahora</span>
            </button>
          </div>
        )}
        {!conectado && (
          <div className="px-3 pb-2">
            <div className="rounded-md border border-amber-400/50 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
              <CloudOff className="size-3.5 shrink-0" />
              Sin conexión con el servidor: los cambios se conservan localmente y se reintentarán; no se marcan
              como guardados en Supabase.
            </div>
          </div>
        )}
        {tienePendientesLocal && (
          <div className="px-3 pb-2">
            <div className="rounded-md border border-amber-400/50 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
              <Upload className="size-3.5 shrink-0" />
              Se detectaron cambios locales no confirmados de una sesión anterior.
              <button className="underline ml-1 shrink-0" onClick={() => recuperarCambiosLocales()}>Recuperarlos</button>
              <button className="ml-2 text-muted-foreground shrink-0" onClick={() => useSync.getState().fijar({ tienePendientesLocal: false })} aria-label="Descartar aviso">Ignorar</button>
            </div>
          </div>
        )}
      </header>

      {/* -------------------------------------------------- cuerpo */}
      <div className="flex-1 flex min-h-0">
        <aside className="hidden lg:block w-60 shrink-0 border-r bg-muted/30">
          <nav className="sticky top-[53px] p-2 space-y-0.5 max-h-[calc(100vh-53px)] overflow-y-auto">
            {NAV.map((n) => {
              const activo = seccion === n.id;
              const issuesSeccion = modelo.issues.filter((i) => i.seccion === n.id);
              const err = issuesSeccion.some((i) => i.tipo === 'error');
              const pend = issuesSeccion.filter((i) => i.tipo === 'pendiente').length;
              const cum = cumplimiento.porSeccion[n.id];
              return (
                <button
                  key={n.id}
                  onClick={() => store.setSeccion(n.id)}
                  className={`w-full text-left rounded-md px-2.5 py-2 text-sm flex items-center gap-2 transition-colors ${activo ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                >
                  <span className={`font-mono text-[10px] shrink-0 ${activo ? 'opacity-80' : 'text-muted-foreground'}`}>{n.num}</span>
                  <span className="flex-1 truncate">{n.titulo}</span>
                  {err && <TriangleAlert className="size-3.5 text-destructive" />}
                  {!err && pend > 0 && <span className="text-[10px] tabular-nums opacity-70">{pend}</span>}
                  {n.id !== 'config' && <span className={`text-[10px] tabular-nums ${activo ? 'opacity-90' : 'text-muted-foreground'}`}>{cum}%</span>}
                </button>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 min-w-0 overflow-x-hidden">
          <div className="flex lg:hidden overflow-x-auto border-b px-2 py-1.5 gap-1">
            {NAV.map((n) => (
              <Button key={n.id} size="sm" variant={seccion === n.id ? 'default' : 'ghost'} className="shrink-0 h-7 text-xs" onClick={() => store.setSeccion(n.id)}>
                {n.num}
              </Button>
            ))}
          </div>
          <div className="p-4 md:p-6 max-w-6xl mx-auto">
            <div className="flex items-center justify-between gap-2 mb-4 lg:hidden">
              <Button variant="outline" size="icon" className="size-8" disabled={idxNav <= 0} onClick={() => idxNav > 0 && store.setSeccion(NAV[idxNav - 1].id)} aria-label="Sección anterior">
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-xs text-muted-foreground">{NAV[idxNav]?.titulo}</span>
              <Button variant="outline" size="icon" className="size-8" disabled={idxNav >= NAV.length - 1} onClick={() => idxNav < NAV.length - 1 && store.setSeccion(NAV[idxNav + 1].id)} aria-label="Sección siguiente">
                <ChevronRight className="size-4" />
              </Button>
            </div>

            {seccion === 'general' && <SeccionGeneral modelo={modelo} />}
            {seccion === 'resumen' && <SeccionResumen modelo={modelo} />}
            {seccion === 'negocio' && <SeccionNegocio modelo={modelo} />}
            {seccion === 'tecnico' && <SeccionTecnico modelo={modelo} />}
            {seccion === 'financiero' && <SeccionFinanciero modelo={modelo} />}
            {seccion === 'mercado' && <SeccionMercado modelo={modelo} />}
            {seccion === 'fuerza' && <SeccionFuerza modelo={modelo} />}
            {seccion === 'inversiones' && <SeccionInversiones modelo={modelo} />}
            {seccion === 'beneficios' && <SeccionBeneficios modelo={modelo} />}
            {seccion === 'conclusiones' && <SeccionConclusiones modelo={modelo} />}
            {seccion === 'config' && <SeccionConfig modelo={modelo} />}
          </div>
        </main>
      </div>

      {/* -------------------------------------------------- panel lateral de diagnóstico (no modal: misión UX-002 §4.4) */}
      {verAlertas && (
        <PanelDiagnostico
          diagnostico={diagnostico}
          onCerrar={() => setVerAlertas(false)}
          onIrAHallazgo={irAHallazgo}
        />
      )}

      <Toaster richColors position="bottom-right" />
    </div>
  );
}

// ----------------------------------------------------------------------------
// Panel lateral de diagnóstico: análisis sustancial en una vista integrada
// que no oculta el editor (misión UX-002 §4.4: fuera de la política de
// modales). Cierra con Esc, con el fondo o con el botón; el foco vuelve al
// botón de alertas.
// ----------------------------------------------------------------------------

function PanelDiagnostico({
  diagnostico,
  onCerrar,
  onIrAHallazgo,
}: {
  diagnostico: ReturnType<typeof diagnosticar>;
  onCerrar: () => void;
  onIrAHallazgo: (partida?: string) => void;
}) {
  React.useEffect(() => {
    const alTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    window.addEventListener('keydown', alTecla);
    return () => window.removeEventListener('keydown', alTecla);
  }, [onCerrar]);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="false" aria-label="Diagnóstico del plan">
      <div className="absolute inset-0 bg-black/30 dark:bg-black/50" onClick={onCerrar} aria-hidden />
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-background border-l shadow-xl flex flex-col">
        <div className="border-b px-4 py-3 flex items-start justify-between gap-2">
          <div>
            <div className="text-sm font-semibold flex items-center gap-2">
              <Bell className="size-4" /> Diagnóstico del plan
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed max-w-lg">
              Cuatro niveles: error bloqueante, advertencia importante, información pendiente y observación de calidad.
              La completitud formal NO se usa como prueba de calidad: un apartado completo de supuestos sin respaldo no
              es un apartado validado. Pulse un hallazgo para ir a su sección.
            </p>
          </div>
          <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={onCerrar} aria-label="Cerrar el panel de diagnóstico">
            <X className="size-4" />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {/* Estado general del plan (misión DOC-002 §5) */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Estado general del plan</span>
              <Badge variant="outline" className="border-primary/40 text-primary">{diagnostico.resumen.estadoGeneral.etiqueta}</Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{diagnostico.resumen.estadoGeneral.detalle}</p>
          </div>
          {/* Resumen de control por las seis dimensiones independientes */}
          <div className="grid gap-2 sm:grid-cols-2">
            {diagnostico.resumen.dimensiones.map((d) => (
              <div key={d.id} className="rounded-lg border p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium">{d.nombre}</span>
                  <Badge
                    variant="outline"
                    className={
                      d.estado === 'ok'
                        ? 'border-emerald-500/40 text-emerald-700 dark:text-emerald-400'
                        : d.estado === 'aceptable'
                          ? 'border-amber-500/40 text-amber-700 dark:text-amber-400'
                          : 'border-destructive/40 text-destructive'
                    }
                  >
                    {d.estado === 'ok' ? 'Correcto' : d.estado === 'aceptable' ? 'Aceptable' : 'Deficiente'}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{d.detalle}</p>
              </div>
            ))}
          </div>
          <div className="text-[11px] text-muted-foreground">
            Conteo: {diagnostico.resumen.conteo.error_bloqueante} error(es) bloqueante(s) ·{' '}
            {diagnostico.resumen.conteo.advertencia_importante} advertencia(s) importante(s) ·{' '}
            {diagnostico.resumen.conteo.informacion_pendiente} pendiente(s) ·{' '}
            {diagnostico.resumen.conteo.observacion_calidad} observación(es) de calidad.
            {diagnostico.resumen.conclusionesAfectadas
              ? ' Hay hallazgos que condicionan las conclusiones del plan.'
              : ' Ningún hallazgo invalida por sí mismo las conclusiones bajo los supuestos vigentes.'}
          </div>
          <div className="space-y-2">
            {diagnostico.hallazgos.length === 0 && <p className="text-sm text-muted-foreground">Sin hallazgos activos.</p>}
            {diagnostico.hallazgos.map((h, k) => (
              <button key={k} className="w-full text-left rounded-lg border p-2.5 hover:bg-muted/60 flex items-start gap-2.5" onClick={() => onIrAHallazgo(h.partida)}>
                <Badge
                  variant="outline"
                  className={
                    h.nivel === 'error_bloqueante'
                      ? 'border-destructive/50 text-destructive'
                      : h.nivel === 'advertencia_importante'
                        ? 'border-amber-500/50 text-amber-700 dark:text-amber-400'
                        : h.nivel === 'informacion_pendiente'
                          ? 'border-sky-500/50 text-sky-700 dark:text-sky-400'
                          : 'text-muted-foreground'
                  }
                >
                  {h.nivel === 'error_bloqueante' ? 'Error' : h.nivel === 'advertencia_importante' ? 'Advertencia' : h.nivel === 'informacion_pendiente' ? 'Pendiente' : 'Calidad'}
                </Badge>
                <span className="text-xs leading-relaxed">
                  <b className="font-medium">{h.codigo}:</b> {h.mensaje}
                  {h.consecuencia ? <> — <span className="text-muted-foreground">{h.consecuencia}</span></> : null}
                  {h.correccion ? <> — <span className="text-muted-foreground">Corrección: {h.correccion}</span></> : null}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export type { PlanexProject } from '@/lib/planex/types';
