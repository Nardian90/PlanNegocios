'use client';

// ============================================================================
// PLANEX — vista dedicada de PREVISUALIZACIÓN DEL DOCUMENTO (ruta
// #/preview?plan=). Página completa: no es un modal ni diálogo.
//
// Misión PLANEX-DOC-001 §4: muestra el PDF REAL generado por el exportador
// (mismos bytes que la descarga) dentro de la navegación normal, con la
// barra de controles del visor integrada en la propia sección.
//
//   · Regeneración por huella: el documento se recalcula cuando cambia el
//     proyecto o la moneda de presentación (con retardo corto para no
     //     regenerar con cada pulsación de tecla) y se muestra un indicador
//     claro de «documento actualizado / pendiente de regenerar»: nunca
//     queda un PDF antiguo presentado silenciosamente como vigente.
//   · Moneda de presentación CUP/USD (misión §5): afecta al documento
//     completo (visor, PDF y Word) y se guarda en el plan (ajustes), de modo
//     que es consistente entre colaboradores.
//   · Descargar PDF usa EXACTAMENTE los bytes mostrados; Exportar Word usa
//     el mismo modelo documental.
//   · Con la sincronización compartida: el documento refleja en vivo los
//     cambios del otro colaborador; «Guardar» confirma en Supabase; antes
//     de exportar se confirma lo pendiente y se advierte de conflictos.
// ============================================================================

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeft,
  FileSpreadsheet,
  FileText,
  RefreshCw,
  Save,
} from 'lucide-react';
import { usePlanex } from '@/lib/planex/store';
import { computeProject } from '@/lib/planex/engine/engine';
import { descargarArchivo } from '@/lib/planex/io/jsonio';
import { monedaPresentacionDe } from '@/lib/planex/doc/moneda';
import {
  cargarPlan,
  resumenConflictos,
  seccionesPendientes,
  sincronizarAhora,
  useSync,
} from '@/lib/supabase/sync';
import { EstadoSincronizacion } from './Colaboracion';
import { navegar, parametrosDesdeHash } from './navegacion';
import VisorPdf from './VisorPdf';
import { cn } from '@/lib/utils';

/** Huella corta y determinista del estado que afecta al documento. */
function huellaDocumento(obj: unknown): string {
  const texto = JSON.stringify(obj);
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}

export default function VistaPreviaDoc() {
  const proyecto = usePlanex((s) => s.proyecto);
  const setMonedaPresentacion = usePlanex((s) => s.setMonedaPresentacion);
  const planId = useSync((s) => s.planId);
  const cargandoSync = useSync((s) => s.cargando);
  const errorCarga = useSync((s) => s.errorCarga);
  const [montado, setMontado] = React.useState(false);
  const [planRuta, setPlanRuta] = React.useState<string | null>(() => parametrosDesdeHash().plan ?? null);
  const [exportando, setExportando] = React.useState(false);

  // Estado del documento generado (bytes = lo MISMO que se descarga).
  const [docBytes, setDocBytes] = React.useState<ArrayBuffer | null>(null);
  const [docNombre, setDocNombre] = React.useState('');
  const [docFecha, setDocFecha] = React.useState<Date | null>(null);
  const [generando, setGenerando] = React.useState(false);
  const [errorGeneracion, setErrorGeneracion] = React.useState<string | null>(null);
  const [huellaGenerada, setHuellaGenerada] = React.useState('');
  const generacionNRef = React.useRef(0);

  // Entradas directas por URL, recargas y Atrás/Adelante.
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
  const moneda = monedaPresentacionDe(proyecto);

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
        'Hay conflictos de edición sin resolver: el documento y la exportación usarían sus datos locales vigentes, que pueden no coincidir con la última versión confirmada en el servidor. ¿Continuar?'
      );
    }
    if (r.errores > 0) {
      return confirm('No se pudieron confirmar todos los cambios en el servidor. La exportación usará los datos locales. ¿Continuar?');
    }
    return true;
  };

  // --------------------------------------------------------- generación
  const huellaVigente = React.useMemo(
    () => huellaDocumento({ p: proyecto, moneda, versiones: seccionesPendientes().length }),
    [proyecto, moneda, pendientes]
  );
  const desactualizado = !!docFecha && huellaVigente !== huellaGenerada;

  const generarDocumento = React.useCallback(async () => {
    if (!planId) return;
    const n = ++generacionNRef.current;
    setGenerando(true);
    setErrorGeneracion(null);
    try {
      const { exportarPDF } = await import('@/lib/planex/io/pdf');
      const { datos, nombre } = exportarPDF(proyecto, computeProject(proyecto), { moneda });
      const bytes = await datos.arrayBuffer();
      if (generacionNRef.current !== n) return; // llegó una generación más nueva
      setDocBytes(bytes);
      setDocNombre(nombre);
      setDocFecha(new Date());
      setHuellaGenerada(huellaDocumento({ p: proyecto, moneda, versiones: seccionesPendientes().length }));
    } catch (e) {
      if (generacionNRef.current === n) setErrorGeneracion((e as Error).message);
    } finally {
      if (generacionNRef.current === n) setGenerando(false);
    }
  }, [proyecto, moneda, planId]);

  // Regeneración automática con retardo (sin regenerar con cada tecla).
  React.useEffect(() => {
    if (!montado || !planId || cargandoSync || (planRuta && planId !== planRuta)) return;
    if (docFecha && huellaVigente === huellaGenerada) return;
    const t = setTimeout(() => void generarDocumento(), 700);
    return () => clearTimeout(t);
  }, [montado, planId, cargandoSync, planRuta, huellaVigente, huellaGenerada, docFecha, generarDocumento]);

  // --------------------------------------------------------- exportaciones
  const descargarPdfMostrado = async () => {
    if (!docBytes) {
      toast.error('El documento aún no está generado', { description: 'Espere a que termine la generación.' });
      return;
    }
    if (!(await preparadoParaExportar())) return;
    setExportando(true);
    try {
      // Los MISMOS bytes que muestra el visor: descarga idéntica garantizada.
      descargarArchivo(limpiarNombre(docNombre), docBytes, 'application/pdf');
      toast.success('PDF descargado (idéntico al mostrado en pantalla)');
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
      const { datos, nombre } = await exportarDOCX(proyecto, computeProject(proyecto), { moneda });
      descargarArchivo(
        limpiarNombre(nombre),
        datos,
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      );
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
      const { datos, nombre, noTraducibles } = await exportarXLSX(proyecto, computeProject(proyecto));
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

  // --------------------------------------------------------- render
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
    <div className="flex h-screen flex-col bg-background">
      {/* ---------------------------------------------- barra de la vista */}
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex flex-wrap items-center gap-2 px-3 py-2">
          <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={volverAEditar}>
            <ArrowLeft className="size-3.5" /> <span className="hidden sm:inline">Volver a editar</span>
            <span className="sm:hidden">Editar</span>
          </Button>

          <div className="flex min-w-40 flex-1 items-center gap-2">
            <span className="truncate text-sm font-medium" title={proyecto.nombre}>
              {proyecto.titulo.nombreProyecto || proyecto.nombre}
            </span>
            <Badge variant="outline" className="shrink-0 text-[10px]">Documento</Badge>
            <EstadoSincronizacion />
          </div>

          {/* Selector de moneda de presentación (misión §5) */}
          <div className="flex items-center overflow-hidden rounded-md border" role="group" aria-label="Moneda de presentación del documento">
            {(['USD', 'CUP'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={moneda === m}
                title={m === 'USD' ? 'Dólares estadounestenses' : 'Pesos cubanos'}
                onClick={() => setMonedaPresentacion(m)}
                className={cn(
                  'h-8 px-2.5 text-xs font-medium transition-colors',
                  moneda === m ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                )}
              >
                {m}
              </button>
            ))}
          </div>

          {/* Estado del documento: actualizado / pendiente / regenerando */}
          <div className="flex items-center gap-1.5 text-xs">
            {generando ? (
              <span className="flex items-center gap-1.5 rounded-md border bg-muted px-2 py-1 text-muted-foreground">
                <RefreshCw className="size-3 animate-spin" /> Generando…
              </span>
            ) : desactualizado ? (
              <span className="flex items-center gap-1.5 rounded-md border border-amber-500/60 bg-amber-50 px-2 py-1 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                <AlertTriangle className="size-3" /> Cambios sin regenerar
                <button type="button" className="underline underline-offset-2" onClick={() => void generarDocumento()}>Regenerar ahora</button>
              </span>
            ) : docFecha ? (
              <span className="rounded-md border bg-muted px-2 py-1 text-muted-foreground" title={docFecha.toLocaleString('es-ES')}>
                Actualizado {docFecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} · {moneda}
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => void guardar()}>
              <Save className="size-3.5" /> <span className="hidden md:inline">Guardar</span>
            </Button>
            <Button size="sm" className="h-8 gap-1.5" onClick={() => void descargarPdfMostrado()} disabled={exportando || !docBytes}>
              <ArrowDownToLine className="size-3.5" /> <span className="hidden sm:inline">Descargar PDF</span>
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => void exportarWord()} disabled={exportando}>
              <FileText className="size-3.5" /> <span className="hidden sm:inline">Word</span>
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => void exportarExcel()} disabled={exportando}>
              <FileSpreadsheet className="size-3.5" /> <span className="hidden lg:inline">Excel</span>
            </Button>
          </div>
        </div>

        {(listaConflictos.length > 0 || errores.length > 0 || errorGeneracion) && (
          <div className="space-y-1.5 px-3 pb-2">
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
            {errorGeneracion && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
                No se pudo generar el documento: {errorGeneracion}
              </div>
            )}
          </div>
        )}
        {pendientes > 0 && listaConflictos.length === 0 && (
          <div className="px-3 pb-2">
            <div className="rounded-md border border-amber-400/50 bg-amber-50 px-3 py-1.5 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              Hay {pendientes} sección(es) con cambios pendientes de confirmar en el servidor; el documento refleja
              sus datos locales vigentes.
            </div>
          </div>
        )}
      </header>

      {/* ---------------------------------------------- visor del documento */}
      <main className="flex min-h-0 flex-1 flex-col">
        {docBytes ? (
          <VisorPdf bytes={docBytes} className="min-h-0" />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <div className="text-sm text-muted-foreground animate-pulse">
              {generando ? 'Generando el documento…' : 'El documento se generará en un instante…'}
            </div>
          </div>
        )}
      </main>

      <Toaster richColors position="bottom-right" />
    </div>
  );
}
