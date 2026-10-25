'use client';

// ============================================================================
// PLANEX Cuba — shell de la aplicación (página única).
// Barra superior, navegación por apartados, panel de alertas, selector de
// plantillas, previsualización, exportaciones (PDF/XLSX/JSON), persistencia
// automática local y selector de tema Dark/Light.
// ============================================================================

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTheme } from 'next-themes';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import {
  AlertTriangle, ArrowDownToLine, Bell, Calculator, ChevronLeft, ChevronRight, Copy, Eye, FileDown, FileSpreadsheet,
  FolderOpen, HardDriveDownload, LayoutTemplate, ListChecks, LogOut, Moon, Save, Stethoscope, Sun, TriangleAlert, Undo2,
} from 'lucide-react';
import { usePlanex } from '@/lib/planex/store';
import { computeProject } from '@/lib/planex/engine/engine';
import { calcularCumplimiento } from '@/lib/planex/model/cumplimiento';
import { cargarActual, guardarActual } from '@/lib/planex/io/persistence';
import { parsearProyectoJSON, proyectoAJSON, descargarArchivo, nombreArchivoSeguro } from '@/lib/planex/io/jsonio';
import { cerrarSesion } from '@/lib/planex/auth';
import { navegar } from './navegacion';
import { ComputedModel, PlanexProject } from '@/lib/planex/types';
import { EtiquetaIssue } from './comunes';
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

export function PlanexApp() {
  const proyecto = usePlanex((s) => s.proyecto);
  const sucio = usePlanex((s) => s.sucio);
  const guardadoEn = usePlanex((s) => s.guardadoEn);
  const seccion = usePlanex((s) => s.seccion);
  const store = usePlanex();
  const { theme, setTheme } = useTheme();
  const [montado, setMontado] = React.useState(false);
  const [verAlertas, setVerAlertas] = React.useState(false);
  const [verPlantillas, setVerPlantillas] = React.useState(false);
  const [exportando, setExportando] = React.useState(false);
  const inputJson = React.useRef<HTMLInputElement>(null);
  const proyectoRef = React.useRef(proyecto);

  React.useEffect(() => setMontado(true), []);

  // Referencia viva del proyecto para el volcado síncrono al desmontar la
  // vista de edición (p. ej. al pasar a la previsualización): ningún cambio
  // queda sin persistir aunque esté pendiente el autoguardado por debounce.
  React.useEffect(() => {
    proyectoRef.current = proyecto;
  });
  React.useEffect(
    () => () => {
      try {
        guardarActual(proyectoRef.current);
      } catch {
        /* almacenamiento no disponible */
      }
    },
    [],
  );

  // Persistencia automática local (debounce 700 ms)
  React.useEffect(() => {
    const t = setTimeout(() => {
      import('@/lib/planex/io/persistence').then(({ guardarActual }) => guardarActual(proyecto));
    }, 700);
    return () => clearTimeout(t);
  }, [proyecto]);

  // Primera visita: mostrar plantillas; si hay proyecto guardado, restaurarlo.
  React.useEffect(() => {
    if (!montado) return;
    try {
      const guardado = cargarActual();
      if (guardado) {
        if (guardado.id !== proyecto.id || guardado.actualizado !== proyecto.actualizado) {
          store.reemplazarProyecto(guardado);
        }
      } else {
        setVerPlantillas(true);
      }
    } catch {
      /* almacenamiento no disponible: la app funciona en memoria */
    }
  }, [montado]);

  // Aviso antes de salir si quedan cambios sin sincronizar
  React.useEffect(() => {
    const h = (e: BeforeUnloadEvent) => {
      if (sucio) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [sucio]);

  const modelo = React.useMemo(() => computeProject(proyecto), [proyecto]);
  const cumplimiento = React.useMemo(() => calcularCumplimiento(proyecto, modelo), [proyecto, modelo]);
  const errores = modelo.issues.filter((i) => i.tipo === 'error');
  const pendientes = modelo.issues.filter((i) => i.tipo === 'pendiente');
  const incidencias = modelo.issues.filter((i) => i.tipo === 'inconsistencia');
  const idxNav = NAV.findIndex((n) => n.id === seccion);

  // ------------------------------------------------------------------ acciones
  const confirmarPerderCambios = (accion: () => void, mensaje: string) => {
    if (sucio && !confirm(`${mensaje}\n\nEl proyecto actual se guarda automáticamente en este navegador; para conservar una copia independiente use «Guardar copia» o exporte JSON antes de continuar. ¿Desea continuar?`)) return;
    accion();
  };

  const guardar = () => {
    store.guardar();
    toast.success('Proyecto guardado en este navegador');
  };

  const exportarJson = () => {
    descargarArchivo(`${nombreArchivoSeguro(proyecto.titulo.nombreProyecto || proyecto.nombre)}.planex.json`, proyectoAJSON(proyecto));
    toast.success('Proyecto exportado como JSON (esquema versionado)');
  };

  const importarJson = async (archivo: File) => {
    const texto = await archivo.text();
    const res = parsearProyectoJSON(texto);
    if (!res.ok) {
      toast.error('JSON rechazado', { description: res.errores.join(' · ') });
      return;
    }
    confirmarPerderCambios(() => {
      store.reemplazarProyecto(res.proyecto!);
      toast.success('Proyecto importado y recalculado', {
        description: res.avisos.join(' ') || 'Las reglas y parámetros del archivo se conservaron.',
      });
    }, 'Va a sustituir el proyecto abierto por el archivo JSON.');
  };

  const exportarPdf = async () => {
    if (errores.length > 0 && !confirm(`Hay ${errores.length} error(es) de cálculo. El PDF se generará con las partidas afectadas marcadas. ¿Continuar?`)) return;
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

  const exportarExcel = async () => {
    if (errores.length > 0 && !confirm(`Hay ${errores.length} error(es) de cálculo: las partidas afectadas se exportarán marcadas como #ERROR y documentadas en la hoja «Reglas». ¿Continuar?`)) return;
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

  const irAAlerta = (issue: (typeof modelo.issues)[number]) => {
    if (issue.seccion) store.setSeccion(issue.seccion);
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
              ) : proyecto.planex.plantillaOrigen === 'default' ? (
                <>
                  <LayoutTemplate className="size-2.5 mr-1" /> Default
                </>
              ) : (
                'Nuevo'
              )}
            </Badge>
            <span className="text-[11px] text-muted-foreground hidden lg:inline">
              {sucio ? (
                <span className="text-amber-600 dark:text-amber-400">Cambios sin guardar…</span>
              ) : guardadoEn ? (
                `Guardado ${new Date(guardadoEn).toLocaleTimeString('es-ES')}`
              ) : (
                'Autoguardado local activo'
              )}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1.5 rounded-lg border px-2 py-1" title="Cumplimentación del plan">
              <ListChecks className="size-3.5 text-muted-foreground" />
              <Progress value={cumplimiento.total} className="h-1.5 w-16" />
              <span className="text-[11px] tabular-nums text-muted-foreground">{cumplimiento.total}%</span>
            </div>
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setVerAlertas(true)} aria-label="Alertas de consistencia">
              <Bell className="size-3.5" />
              {errores.length > 0 && <span className="size-1.5 rounded-full bg-destructive animate-pulse" />}
              <span className="text-[11px] tabular-nums">{errores.length + incidencias.length + pendientes.length}</span>
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => setVerPlantillas(true)}>
              <LayoutTemplate className="size-3.5" /> <span className="hidden md:inline">Plantillas</span>
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={guardar}>
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
                <DropdownMenuItem onClick={() => navegar('/preview')} className="gap-2">
                  <Eye className="size-4" /> Previsualizar plan (vista dedicada)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportarPdf} disabled={exportando} className="gap-2">
                  <ArrowDownToLine className="size-4" /> Exportar PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportarExcel} disabled={exportando} className="gap-2">
                  <FileSpreadsheet className="size-4" /> Exportar libro Excel (.xlsx)
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={exportarJson} className="gap-2">
                  <HardDriveDownload className="size-4" /> Exportar JSON del proyecto
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => inputJson.current?.click()} className="gap-2">
                  <FolderOpen className="size-4" /> Abrir proyecto JSON…
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => confirmarPerderCambios(() => store.duplicarProyecto(), 'Se creará una copia independiente del proyecto actual.')} className="gap-2">
                  <Copy className="size-4" /> Guardar copia independiente
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() =>
                    confirmarPerderCambios(() => store.abrirPlantilla(proyecto.planex.plantillaOrigen === 'clinica' ? 'clinica' : 'default'), 'Se restaurará la plantilla de origen y se perderán los cambios del proyecto actual.')
                  }
                  className="gap-2"
                >
                  <Undo2 className="size-4" /> Restaurar plantilla de origen
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
              onClick={() => {
                cerrarSesion();
                navegar('/');
              }}
              aria-label="Cerrar sesión"
              title="Cerrar sesión y volver a la presentación (los proyectos guardados se conservan)"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
        <input ref={inputJson} type="file" accept=".json,application/json" className="hidden" onChange={(e) => e.target.files?.[0] && importarJson(e.target.files[0])} />
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
            {seccion === 'negocio' && <SeccionNegocio />}
            {seccion === 'tecnico' && <SeccionTecnico modelo={modelo} />}
            {seccion === 'financiero' && <SeccionFinanciero modelo={modelo} />}
            {seccion === 'mercado' && <SeccionMercado />}
            {seccion === 'fuerza' && <SeccionFuerza modelo={modelo} />}
            {seccion === 'inversiones' && <SeccionInversiones />}
            {seccion === 'beneficios' && <SeccionBeneficios modelo={modelo} />}
            {seccion === 'conclusiones' && <SeccionConclusiones modelo={modelo} />}
            {seccion === 'config' && <SeccionConfig modelo={modelo} />}
            {seccion === 'inicio' && <PantallaInicio modelo={modelo} />}
          </div>
        </main>
      </div>

      {/* -------------------------------------------------- diálogos */}
      <Dialog open={verPlantillas} onOpenChange={setVerPlantillas}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Plantillas y proyectos</DialogTitle>
            <DialogDescription>Las plantillas se mantienen separadas de los proyectos modificados: crear un plan nunca altera las originales.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              className="rounded-xl border p-4 text-left hover:border-primary transition-colors"
              onClick={() => confirmarPerderCambios(() => { store.abrirPlantilla('clinica'); setVerPlantillas(false); }, 'Se abrirá la plantilla de la clínica como un plan nuevo.')}
            >
              <div className="flex items-center gap-2 font-semibold text-sm">
                <Stethoscope className="size-4 text-primary" /> Clínica Estomatológica
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Ejemplo completo con datos ficticios coherentes: servicios, aportaciones, inversión, fuerza de trabajo, cronograma, beneficios al país y proyección de 10 años con recuperación ≈ año 4. Ideal para explorar el motor de cálculo.
              </p>
              <Badge variant="secondary" className="mt-2 text-[10px]">Ejemplo ilustrativo</Badge>
            </button>
            <button
              className="rounded-xl border p-4 text-left hover:border-primary transition-colors"
              onClick={() => confirmarPerderCambios(() => { store.abrirPlantilla('default'); setVerPlantillas(false); }, 'Se abrirá la plantilla general como un plan nuevo.')}
            >
              <div className="flex items-center gap-2 font-semibold text-sm">
                <LayoutTemplate className="size-4 text-primary" /> Default (general)
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                Estructura metodológica completa con formularios, ayudas por apartado y reglas de cálculo activas. Los cálculos con datos no completados indican qué falta: no se presentan resultados definitivos con datos inexistentes.
              </p>
              <Badge variant="secondary" className="mt-2 text-[10px]">Vacía · con ayudas</Badge>
            </button>
            <button className="rounded-xl border p-4 text-left hover:border-primary transition-colors" onClick={() => inputJson.current?.click()}>
              <div className="flex items-center gap-2 font-semibold text-sm">
                <FolderOpen className="size-4 text-primary" /> Abrir proyecto JSON
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">Importa un proyecto exportado previamente. Se valida el esquema, se recalcula y se conservan sus reglas y parámetros.</p>
            </button>
            <button
              className="rounded-xl border p-4 text-left hover:border-primary transition-colors"
              onClick={() => confirmarPerderCambios(() => { store.proyectoNuevo(); setVerPlantillas(false); }, 'Se creará un plan nuevo desde cero (estructura Default sin textos).')}
            >
              <div className="flex items-center gap-2 font-semibold text-sm">
                <Calculator className="size-4 text-primary" /> Crear plan nuevo
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">Estructura metodológica y motor activos, sin datos precargados ni textos de ejemplo.</p>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={verAlertas} onOpenChange={setVerAlertas}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bell className="size-4" /> Alertas de consistencia y cumplimentación
            </DialogTitle>
            <DialogDescription>
              Se distingue entre error que impide calcular, inconsistencia que requiere revisión, campo pendiente, supuesto no verificado, advertencia documental y requisito legal a validar. Pulse una alerta para ir a su sección.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {modelo.issues.length === 0 && <p className="text-sm text-muted-foreground">Sin alertas activas.</p>}
            {modelo.issues.map((i, k) => (
              <button key={k} className="w-full text-left rounded-lg border p-2.5 hover:bg-muted/60 flex items-start gap-2.5" onClick={() => irAAlerta(i)}>
                <EtiquetaIssue tipo={i.tipo} />
                <span className="text-xs leading-relaxed">{i.mensaje}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Toaster richColors position="bottom-right" />
    </div>
  );
}

function PantallaInicio({ modelo }: { modelo: ComputedModel }) {
  const store = usePlanex();
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-gradient-to-br from-primary/10 via-transparent to-transparent p-6">
        <h1 className="text-2xl font-bold">PLANEX Cuba</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          Aplicación local para elaborar planes de negocios de propuestas con inversión extranjera conforme a las Bases Metodológicas de la GOC-2026-O57. Motor de cálculo configurable (parámetros y fórmulas), previsualización documental, exportación PDF y Excel con fórmulas reales, e intercambio de proyectos por JSON. Funciona sin cuentas en línea y sin enviar información a servicios externos.
        </p>
        <div className="flex gap-2 mt-4 flex-wrap">
          <Button onClick={() => store.abrirPlantilla('clinica')} className="gap-1.5">
            <Stethoscope className="size-4" /> Abrir ejemplo «Clínica Estomatológica»
          </Button>
          <Button variant="outline" onClick={() => store.abrirPlantilla('default')} className="gap-1.5">
            <LayoutTemplate className="size-4" /> Plantilla general (Default)
          </Button>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3 text-sm">
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">Estado del modelo</div>
          <div className="font-semibold mt-1 flex items-center gap-1.5">
            {modelo.ok ? 'Sin errores de cálculo' : `${modelo.issues.filter((i) => i.tipo === 'error').length} error(es)`}
            {modelo.ok && <span className="size-1.5 rounded-full bg-emerald-500" />}
          </div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">Período de recuperación</div>
          <div className="font-semibold mt-1">{modelo.indicadores.recuperacionAnios === null ? 'No recuperado en el horizonte' : `${modelo.indicadores.recuperacionAnios.toFixed(1)} años`}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">Beneficios al país (acum.)</div>
          <div className="font-semibold mt-1 tabular-nums">{new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(modelo.indicadores.beneficiosPaisAcumulados)} kUSD</div>
        </div>
      </div>
      <div className="rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-200 flex gap-2">
        <AlertTriangle className="size-4 shrink-0 mt-0.5" />
        La plantilla de clínica contiene datos ficticios de demostración. La tasa del impuesto sobre utilidades (35 %) es un supuesto editable, no la tasa legal aplicable.
      </div>
    </div>
  );
}

export type { PlanexProject };
