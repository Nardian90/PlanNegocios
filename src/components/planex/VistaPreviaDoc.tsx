'use client';

// ============================================================================
// PLANEX — vista dedicada de previsualización del plan (ruta #/preview).
// Vista de página completa: no es un modal, diálogo ni ventana flotante.
// Barra de acciones separada del documento; este mantiene fondo neutro claro
// aunque la interfaz esté en tema Dark. El modelo se recalcula con los datos
// vigentes del almacén en cada render: nunca muestra cifras antiguas.
// ============================================================================

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { ArrowDownToLine, ArrowLeft, FileSpreadsheet, Printer, Save } from 'lucide-react';
import { usePlanex } from '@/lib/planex/store';
import { computeProject } from '@/lib/planex/engine/engine';
import { cargarActual } from '@/lib/planex/io/persistence';
import { descargarArchivo } from '@/lib/planex/io/jsonio';
import { DocumentoPlan } from './preview';
import { navegar } from './navegacion';

export default function VistaPreviaDoc() {
  const proyecto = usePlanex((s) => s.proyecto);
  const sucio = usePlanex((s) => s.sucio);
  const guardadoEn = usePlanex((s) => s.guardadoEn);
  const store = usePlanex();
  const [montado, setMontado] = React.useState(false);
  const [exportando, setExportando] = React.useState(false);

  // Al entrar (incluida una recarga directa de #/preview) se restaura el
  // proyecto guardado en este navegador si difiere del estado en memoria.
  // En la navegación interna no hay recarga: el estado vivo ya es el vigente.
  React.useEffect(() => {
    try {
      const guardado = cargarActual();
      if (guardado && (guardado.id !== proyecto.id || guardado.actualizado !== proyecto.actualizado)) {
        store.reemplazarProyecto(guardado);
      }
    } catch {
      /* almacenamiento no disponible: se usa el estado en memoria */
    }
    setMontado(true);
  }, []);

  const modelo = React.useMemo(() => computeProject(proyecto), [proyecto]);
  const errores = modelo.issues.filter((i) => i.tipo === 'error');

  const limpiarNombre = (n: string) => n.replace(/[^\w.\- áéíóúÁÉÍÓÚñÑ]/g, '');

  const volverAEditar = () => navegar('/app');

  const guardar = () => {
    store.guardar();
    toast.success('Proyecto guardado en este navegador');
  };

  const exportarPdf = async () => {
    if (errores.length > 0 && !confirm(`Hay ${errores.length} error(es) de cálculo. El PDF se generará con las partidas afectadas marcadas. ¿Continuar?`)) return;
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

  if (!montado) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Cargando el plan…</div>
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
            <span className="text-[11px] text-muted-foreground hidden md:inline">
              {sucio ? (
                <span className="text-amber-600 dark:text-amber-400">Cambios pendientes de guardar</span>
              ) : guardadoEn ? (
                `Guardado ${new Date(guardadoEn).toLocaleTimeString('es-ES')}`
              ) : (
                'Sincronizado'
              )}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={guardar}>
              <Save className="size-3.5" /> <span className="hidden md:inline">Guardar proyecto</span>
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => window.print()} aria-label="Imprimir el documento">
              <Printer className="size-3.5" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={exportarPdf} disabled={exportando}>
              <ArrowDownToLine className="size-3.5" /> <span className="hidden sm:inline">Exportar PDF</span>
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={exportarExcel} disabled={exportando}>
              <FileSpreadsheet className="size-3.5" /> <span className="hidden sm:inline">Exportar Excel</span>
            </Button>
          </div>
        </div>
        {errores.length > 0 && (
          <div className="px-3 pb-2">
            <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
              El modelo tiene {errores.length} error(es) de cálculo: las partidas afectadas aparecen marcadas en el
              documento y en las exportaciones. Revíselos en «Volver a editar».
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
