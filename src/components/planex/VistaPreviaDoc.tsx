'use client';

// ============================================================================
// PLANEX — vista dedicada de previsualización del plan (ruta #/preview?plan=).
// Vista de página completa: no es un modal, diálogo ni ventana flotante.
// Barra de acciones separada del documento; este mantiene fondo neutro claro
// aunque la interfaz esté en tema Dark. El modelo se recalcula con los datos
// vigentes del almacén en cada render: nunca muestra cifras antiguas.
//
// Con la sincronización compartida:
//   * el documento refleja en vivo los cambios del otro colaborador;
//   * «Guardar» confirma los cambios pendientes en Supabase;
//   * antes de exportar se confirma lo pendiente y se advierte de conflictos
//     sin resolver (la exportación parte de una versión consistente);
//   * los cambios pendientes o conflictos se indican de forma explícita.
// ============================================================================

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { AlertTriangle, ArrowDownToLine, ArrowLeft, FileSpreadsheet, Printer, Save } from 'lucide-react';
import { usePlanex } from '@/lib/planex/store';
import { computeProject } from '@/lib/planex/engine/engine';
import { descargarArchivo } from '@/lib/planex/io/jsonio';
import {
  cargarPlan,
  resumenConflictos,
  seccionesPendientes,
  sincronizarAhora,
  useSync,
} from '@/lib/supabase/sync';
import { EstadoSincronizacion } from './Colaboracion';
import { DocumentoPlan } from './preview';
import { navegar, parametrosDesdeHash } from './navegacion';

export default function VistaPreviaDoc() {
  const proyecto = usePlanex((s) => s.proyecto);
  const planId = useSync((s) => s.planId);
  const cargandoSync = useSync((s) => s.cargando);
  const errorCarga = useSync((s) => s.errorCarga);
  const [montado, setMontado] = React.useState(false);
  const [planRuta, setPlanRuta] = React.useState<string | null>(() => parametrosDesdeHash().plan ?? null);
  const [exportando, setExportando] = React.useState(false);

  // Entradas directas por URL, recargas y Atrás/Adelante: el plan se
  // identifica por la URL; si ya está vivo en la sesión no se recarga.
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
      if (!r.ok && r.error) toast.error('No se pudo abrir el plan', { description: r.error, duration: 9000 });
    });
  }, [planRuta, montado]);

  React.useEffect(() => setMontado(true), []);

  const modelo = React.useMemo(() => computeProject(proyecto), [proyecto]);
  const errores = modelo.issues.filter((i) => i.tipo === 'error');
  const listaConflictos = resumenConflictos();
  const pendientes = seccionesPendientes().length;

  const limpiarNombre = (n: string) => n.replace(/[^\w.\- áéíóúÁÉÍÓÚñÑ]/g, '');

  const volverAEditar = () => navegar(planId ? `/editor?plan=${planId}` : '/proyectos');

  const guardar = async () => {
    const r = await sincronizarAhora();
    if (r.conflictos > 0) {
      toast.error('Hay conflictos de edición sin resolver', { description: 'Revíselos en el editor antes de guardar.' });
      return;
    }
    if (r.errores > 0) {
      toast.error('No se pudieron confirmar todos los cambios', { description: 'Se conservan localmente y se reintentarán.' });
      return;
    }
    toast.success('Cambios guardados en Supabase');
  };

  const preparadoParaExportar = async (): Promise<boolean> => {
    const r = await sincronizarAhora();
    if (r.conflictos > 0) {
      return confirm(
        'Hay conflictos de edición sin resolver: el documento y la exportación usarían sus datos locales vigentes, que pueden no coincidir con la última versión confirmada en el servidor. ¿Continuar?',
      );
    }
    if (r.errores > 0) {
      return confirm('No se pudieron confirmar todos los cambios en el servidor. La exportación usará los datos locales. ¿Continuar?');
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
      descargarArchivo(limpiarNombre(nombre), datos, 'application/pdf');
      toast.success('PDF generado con la versión vigente de datos y reglas');
    } catch (e) {
      toast.error('No se pudo generar el PDF', { description: (e as Error).message });
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
      descargarArchivo(limpiarNombre(nombre), datos, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
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

  if (!montado || cargandoSync || (planRuta && planId !== planRuta)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground animate-pulse">Cargando el plan…</div>
      </div>
    );
  }

  if (errorCarga && !planId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md rounded-xl border bg-card p-6 text-sm space-y-3">
          <div className="flex items-center gap-2 font-semibold"><AlertTriangle className="size-4 text-destructive" /> No se pudo abrir el plan</div>
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
    <div className="min-h-screen flex flex-col bg-[#e9e4da] dark:bg-[#14161c]">
      {/* ---------------------------------------------- barra de acciones */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 print:hidden">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={volverAEditar}>
            <ArrowLeft className="size-3.5" /> <span className="hidden sm:inline">Volver a editar</span>
            <span className="sm:hidden">Editar</span>
          </Button>

          <div className="flex items-center gap-2 flex-1 min-w-40">
            <span className="text-sm font-medium truncate" title={proyecto.nombre}>
              {proyecto.titulo.nombreProyecto || proyecto.nombre}
            </span>
            <Badge variant="outline" className="text-[10px] shrink-0">Vista documental</Badge>
            <EstadoSincronizacion />
          </div>

          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => void guardar()}>
              <Save className="size-3.5" /> <span className="hidden md:inline">Guardar proyecto</span>
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => window.print()} aria-label="Imprimir el documento">
              <Printer className="size-3.5" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => void exportarPdf()} disabled={exportando}>
              <ArrowDownToLine className="size-3.5" /> <span className="hidden sm:inline">Exportar PDF</span>
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => void exportarExcel()} disabled={exportando}>
              <FileSpreadsheet className="size-3.5" /> <span className="hidden sm:inline">Exportar Excel</span>
            </Button>
          </div>
        </div>

        {(listaConflictos.length > 0 || errores.length > 0) && (
          <div className="px-3 pb-2 space-y-1.5">
            {listaConflictos.length > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
                <b>{listaConflictos.length} conflicto(s) de edición sin resolver:</b> el documento muestra sus
                datos locales vigentes, que pueden no coincidir con la última versión confirmada en el servidor.
                Resuélvalos en «Volver a editar».
              </div>
            )}
            {errores.length > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
                El modelo tiene {errores.length} error(es) de cálculo: las partidas afectadas aparecen marcadas en el
                documento y en las exportaciones. Revíselos en «Volver a editar».
              </div>
            )}
          </div>
        )}
        {pendientes > 0 && listaConflictos.length === 0 && (
          <div className="px-3 pb-2">
            <div className="rounded-md border border-amber-400/50 bg-amber-50 dark:bg-amber-950/40 px-3 py-1.5 text-xs text-amber-900 dark:text-amber-200">
              Hay {pendientes} sección(es) con cambios pendientes de confirmar en el servidor; el documento refleja
              sus datos locales vigentes.
            </div>
          </div>
        )}
      </header>

      {/* ---------------------------------------------- documento */}
      <main className="flex-1 overflow-x-hidden px-4 py-8 print:p-0 print:bg-white">
        <div className="max-w-[900px] mx-auto">
          <DocumentoPlan modelo={modelo} />
        </div>
      </main>

      <Toaster richColors position="bottom-right" />
    </div>
  );
}
