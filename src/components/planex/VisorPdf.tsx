'use client';

// ============================================================================
// PLANEX — Visor PDF real integrado (misión PLANEX-DOC-001 §4).
//
// Muestra EL MISMO PDF que genera el exportador (mismos bytes): la
// previsualización no es una aproximación visual independiente, de modo que
// lo que se ve es exactamente lo que se descarga.
//
// Biblioteca: pdfjs-dist (estándar de facto, mantenimiento activo, tamaño
// razonable, compatible con despliegue estático mediante worker propio).
// No se instala ningún segundo visor: los controles se implementan sobre la
// API pública de pdf.js.
//
// Controles (misión §4):
//   · Página anterior / siguiente y campo «ir a la página» con total.
//   · Zoom +/− , ajuste al ancho, ajuste a página y porcentaje visible.
//   · Búsqueda de texto con coincidencia actual, anterior/siguiente y total.
//   · Pantalla completa.
//   · Descarga delegada a la vista (usa ESTOS mismos bytes).
//
// El worker se sirve desde /pdfjs/pdf.worker.min.mjs (copiado en prebuild) y
// se resuelve con el basePath real del despliegue (GitHub Pages: subruta).
// ============================================================================

import * as React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ScanLine,
  Expand,
  Search,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Tipos reales de pdf.js (importados en posición de tipo: sin costo en el bundle).
type DocumentoPdf = import('pdfjs-dist').PDFDocumentProxy;
type TareaRender = import('pdfjs-dist').RenderTask;
type PaginaPdf = import('pdfjs-dist').PDFPageProxy;
type TareaCarga = import('pdfjs-dist').PDFDocumentLoadingTask;

interface Coincidencia {
  pagina: number;
  rect: number[]; // coordenadas de página (PDF units, sin escala)
}

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.5;

export interface VisorPdfProps {
  /** Bytes del PDF vigente (los mismos que descarga el usuario). */
  bytes: ArrayBuffer;
  className?: string;
}

export default function VisorPdf({ bytes, className }: VisorPdfProps) {
  const contenedorRef = React.useRef<HTMLDivElement>(null);
  const lienzoRef = React.useRef<HTMLCanvasElement>(null);
  const overlayRef = React.useRef<HTMLDivElement>(null);
  const docRef = React.useRef<DocumentoPdf | null>(null);
  const cargaRef = React.useRef<TareaCarga | null>(null);
  const renderTaskRef = React.useRef<TareaRender | null>(null);
  const textCacheRef = React.useRef<Map<number, { str: string; transform: number[]; width: number; height: number }[]>>(new Map());
  const [lib, setLib] = React.useState<typeof import('pdfjs-dist') | null>(null);
  const [numPaginas, setNumPaginas] = React.useState(0);
  const [pagina, setPagina] = React.useState(1);
  const [zoomModo, setZoomModo] = React.useState<'ancho' | 'pagina'>('ancho');
  const [escala, setEscala] = React.useState(1);
  const [cargando, setCargando] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busqueda, setBusqueda] = React.useState('');
  const [coincidencias, setCoincidencias] = React.useState<Coincidencia[]>([]);
  const [coincidenciaActiva, setCoincidenciaActiva] = React.useState(0);

  // ------------------------------------------------------------- pdf.js
  React.useEffect(() => {
    let vivo = true;
    import('pdfjs-dist').then((mod) => {
      if (!vivo) return;
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
      mod.GlobalWorkerOptions.workerSrc = `${basePath}/pdfjs/pdf.worker.min.mjs`;
      setLib(mod);
    }).catch((e) => vivo && setError(`No se pudo cargar el visor: ${(e as Error).message}`));
    return () => {
      vivo = false;
    };
  }, []);

  // Carga del documento cuando cambian los bytes.
  React.useEffect(() => {
    if (!lib) return;
    let vivo = true;
    setCargando(true);
    setError(null);
    setCoincidencias([]);
    setCoincidenciaActiva(0);
    textCacheRef.current.clear();
    const anterior = cargaRef.current;
    docRef.current = null;
    cargaRef.current = null;
    void anterior?.destroy().catch(() => undefined);
    const tarea = lib.getDocument({ data: new Uint8Array(bytes.slice(0)) });
    cargaRef.current = tarea;
    tarea.promise
      .then((doc: DocumentoPdf) => {
        if (!vivo) {
          void tarea.destroy().catch(() => undefined);
          return;
        }
        docRef.current = doc;
        setNumPaginas(doc.numPages);
        setPagina(1);
        setCargando(false);
      })
      .catch((e: Error) => {
        if (!vivo) return;
        setError(`No se pudo abrir el documento: ${e.message}`);
        setCargando(false);
      });
    return () => {
      vivo = false;
      // Limpieza REAL: destruye la tarea de carga (y el documento asociado)
      // al desmontar o al cambiar los bytes. Las operaciones en curso se
      // protegen con comprobaciones de obsolescencia (buscar/pintar/render).
      const carga = cargaRef.current;
      cargaRef.current = null;
      docRef.current = null;
      void carga?.destroy().catch(() => undefined);
    };
  }, [lib, bytes]);

  // Escala según modo de ajuste y ancho disponible.
  React.useEffect(() => {
    const contenedor = contenedorRef.current;
    const doc = docRef.current;
    if (!contenedor || !doc || !numPaginas) return;
    let cancelado = false;
    const recalcular = async () => {
      try {
        const actual = docRef.current;
        if (!actual || actual !== doc) return;
        const page = await actual.getPage(Math.min(pagina, numPaginas));
        if (cancelado || !contenedorRef.current || docRef.current !== actual) return;
        const base = page.getViewport({ scale: 1 });
        const disponible = contenedorRef.current.clientWidth - 32;
        const disponibleAlto = (contenedorRef.current.closest('[data-zona-visor]')?.clientHeight ?? 640) - 32;
        if (zoomModo === 'ancho') {
          setEscala(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, disponible / base.width)));
        } else {
          const s = Math.min(disponible / base.width, Math.max(120, disponibleAlto) / base.height);
          setEscala(Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, s)));
        }
      } catch {
        // El documento pudo ser destruido mientras el ResizeObserver tenía
        // un recálculo en cola: no es un error del visor.
      }
    };
    void recalcular();
    const ro = new ResizeObserver(() => void recalcular());
    ro.observe(contenedor);
    return () => {
      cancelado = true;
      ro.disconnect();
    };
  }, [zoomModo, numPaginas, pagina]);

  // Render de la página visible.
  React.useEffect(() => {
    const doc = docRef.current;
    const lienzo = lienzoRef.current;
    if (!doc || !lienzo || !escala || cargando) return;
    let cancelado = false;
    let task: TareaRender | null = null;
    const render = async () => {
      try {
        const page = await doc.getPage(pagina);
        if (cancelado) return;
        const viewport = page.getViewport({ scale: escala });
        const dpr = window.devicePixelRatio || 1;
        lienzo.width = Math.floor(viewport.width * dpr);
        lienzo.height = Math.floor(viewport.height * dpr);
        lienzo.style.width = `${viewport.width}px`;
        lienzo.style.height = `${viewport.height}px`;
        const ctx = lienzo.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, lienzo.width, lienzo.height);
        task = page.render({
          canvas: lienzo,
          canvasContext: ctx,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined,
        });
        renderTaskRef.current = task;
        await task.promise;
      } catch (e) {
        const err = e as { name?: string; message?: string };
        // Las carreras de destrucción (cambio de bytes/desmontaje) no son
        // errores reales: se ignoran si el documento ya no es el vigente.
        const obsoleto = docRef.current !== doc;
        if (!obsoleto && err?.name !== 'RenderingCancelledException' && !cancelado) {
          setError(`No se pudo renderizar la página ${pagina}: ${err?.message ?? e}`);
        }
      }
    };
    void render();
    return () => {
      cancelado = true;
      try {
        task?.cancel();
      } catch {
        /* cancelación */
      }
      renderTaskRef.current = null;
    };
  }, [docRef, pagina, escala, cargando]);

  // ------------------------------------------------------------- búsqueda
  const itemsDePagina = React.useCallback(async (n: number) => {
    const doc = docRef.current;
    if (!doc) return [];
    const cache = textCacheRef.current.get(n);
    if (cache) return cache;
    try {
      const page: PaginaPdf = await doc.getPage(n);
      if (docRef.current !== doc) return [];
      const tc = await page.getTextContent();
      const items = tc.items.map((i) => ({ str: (i as { str: string }).str, transform: (i as { transform: number[] }).transform, width: (i as { width: number }).width, height: (i as { height: number }).height }));
      if (docRef.current !== doc) return [];
      textCacheRef.current.set(n, items);
      return items;
    } catch {
      return []; // documento destruido mientras se pedía el texto
    }
  }, []);

  const buscar = React.useCallback(
    async (texto: string) => {
      const doc = docRef.current;
      const q = texto.trim().toLowerCase();
      if (!doc || !q || q.length < 2 || !numPaginas) {
        setCoincidencias([]);
        setCoincidenciaActiva(0);
        return;
      }
      const salida: Coincidencia[] = [];
      for (let n = 1; n <= numPaginas; n++) {
        if (docRef.current !== doc) return; // obsoleto: aborta en silencio
        const items = await itemsDePagina(n);
        for (const item of items) {
          const textoItem = item.str.toLowerCase();
          let pos = textoItem.indexOf(q);
          while (pos !== -1 && salida.length < 500) {
            const largo = item.str.length || 1;
            const x0 = item.transform[4] + (pos / largo) * item.width;
            const x1 = item.transform[4] + ((pos + q.length) / largo) * item.width;
            const y = item.transform[5];
            const h = item.height || 8;
            salida.push({ pagina: n, rect: [x0, y, x1, y + h] });
            pos = textoItem.indexOf(q, pos + q.length);
          }
        }
      }
      if (docRef.current !== doc) return;
      setCoincidencias(salida);
      setCoincidenciaActiva(salida.length ? 0 : -1);
      if (salida.length) setPagina(salida[0].pagina);
    },
    [itemsDePagina, numPaginas]
  );

  // Resaltados de la página actual (rectángulos escalados al viewport).
  React.useEffect(() => {
    if (!docRef.current || !overlayRef.current) return;
    let vivo = true;
    const pintar = async () => {
      const doc = docRef.current;
      if (!doc || !overlayRef.current) return;
      try {
        const page = await doc.getPage(pagina);
        if (!vivo || !overlayRef.current || docRef.current !== doc) return;
        const viewport = page.getViewport({ scale: escala });
        overlayRef.current.innerHTML = '';
        const dePagina = coincidencias.filter((c) => c.pagina === pagina);
        const idxGlobalInicio = coincidencias.findIndex((c) => c.pagina === pagina);
        dePagina.forEach((c, i) => {
          // v6: dos puntos de viewport (esquinas del rectángulo) y mínimos por eje.
          const [ax, ay] = viewport.convertToViewportPoint(c.rect[0], c.rect[1]);
          const [bx, by] = viewport.convertToViewportPoint(c.rect[2], c.rect[3]);
          const div = document.createElement('div');
          div.style.position = 'absolute';
          const esActiva = coincidencias.length && idxGlobalInicio + i === coincidenciaActiva;
          div.style.background = esActiva ? 'rgba(217, 119, 6, 0.45)' : 'rgba(250, 204, 21, 0.28)';
          div.style.borderRadius = '2px';
          div.style.left = `${Math.min(ax, bx)}px`;
          div.style.top = `${Math.min(ay, by)}px`;
          div.style.width = `${Math.abs(bx - ax)}px`;
          div.style.height = `${Math.abs(by - ay)}px`;
          overlayRef.current!.appendChild(div);
        });
      } catch {
        // documento destruido mientras se pintaban los resaltados
      }
    };
    void pintar();
    return () => {
      vivo = false;
    };
  }, [coincidencias, coincidenciaActiva, pagina, escala]);

  // ------------------------------------------------------------- acciones
  const irPagina = (n: number) => {
    const destino = Math.max(1, Math.min(numPaginas || 1, n));
    setPagina(destino);
  };

  const pantallaCompleta = () => {
    const cont = contenedorRef.current?.closest('[data-zona-visor]') as HTMLElement | null;
    if (!cont) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void cont.requestFullscreen().catch(() => undefined);
  };

  const zoomManual = (delta: number) => {
    setZoomModo('ancho'); // modo manual a partir del ajuste actual
    setEscala((s) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, s + delta)));
  };

  const coincidenciaSiguiente = (dir: 1 | -1) => {
    if (!coincidencias.length) return;
    const n = (coincidenciaActiva + dir + coincidencias.length) % coincidencias.length;
    setCoincidenciaActiva(n);
    setPagina(coincidencias[n].pagina);
  };

  // ------------------------------------------------------------- render
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)} data-zona-visor>
      {/* Barra de controles del visor — parte de la sección, no un modal */}
      <div className="flex flex-wrap items-center gap-1.5 border-b bg-background/95 px-2 py-1.5">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="Página anterior" disabled={pagina <= 1 || cargando} onClick={() => irPagina(pagina - 1)}>
            <ChevronLeft className="size-4" />
          </Button>
          <input
            aria-label="Ir a la página"
            className="h-7 w-14 rounded-md border bg-transparent px-2 text-center text-xs tabular-nums"
            value={pagina}
            inputMode="numeric"
            onChange={(e) => {
              const n = Number(e.target.value.replace(/\D/g, ''));
              if (Number.isFinite(n)) irPagina(n);
            }}
          />
          <span className="text-xs text-muted-foreground">de {numPaginas || '—'}</span>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="Página siguiente" disabled={!numPaginas || pagina >= numPaginas || cargando} onClick={() => irPagina(pagina + 1)}>
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="mx-1 h-5 w-px bg-border" />

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="Reducir zoom" disabled={cargando || escala <= MIN_ZOOM} onClick={() => zoomManual(-0.1)}>
            <ZoomOut className="size-4" />
          </Button>
          <span className="w-11 text-center text-xs tabular-nums text-muted-foreground">{Math.round(escala * 100)}%</span>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="Ampliar zoom" disabled={cargando || escala >= MAX_ZOOM} onClick={() => zoomManual(0.1)}>
            <ZoomIn className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" className={cn('h-7 w-7 p-0', zoomModo === 'ancho' && 'bg-accent')} aria-label="Ajustar al ancho" title="Ajustar al ancho" disabled={cargando} onClick={() => setZoomModo('ancho')}>
            <Expand className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" className={cn('h-7 w-7 p-0', zoomModo === 'pagina' && 'bg-accent')} aria-label="Ajustar a página" title="Ajustar a página" disabled={cargando} onClick={() => setZoomModo('pagina')}>
            <ScanLine className="size-4" />
          </Button>
        </div>

        <div className="mx-1 h-5 w-px bg-border" />

        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            void buscar(busqueda);
          }}
        >
          <div className="flex items-center gap-1 rounded-md border px-1.5 h-7">
            <Search className="size-3.5 text-muted-foreground" />
            <input
              aria-label="Buscar en el documento"
              placeholder="Buscar…"
              className="h-6 w-28 bg-transparent text-xs outline-none sm:w-36"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (coincidencias.length) coincidenciaSiguiente(1);
                  else void buscar(busqueda);
                }
              }}
            />
            {coincidencias.length > 0 && (
              <span className="whitespace-nowrap text-[10px] tabular-nums text-muted-foreground">
                {coincidenciaActiva + 1}/{coincidencias.length}
              </span>
            )}
          </div>
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="Coincidencia anterior" disabled={!coincidencias.length} onClick={() => coincidenciaSiguiente(-1)}>
            <ChevronLeft className="size-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="Coincidencia siguiente" disabled={!coincidencias.length} onClick={() => coincidenciaSiguiente(1)}>
            <ChevronRight className="size-3.5" />
          </Button>
        </form>

        <div className="ml-auto flex items-center">
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" aria-label="Pantalla completa" title="Pantalla completa" onClick={pantallaCompleta}>
            <Maximize2 className="size-4" />
          </Button>
        </div>
      </div>

      {/* Zona del documento */}
      <div ref={contenedorRef} className="relative min-h-0 flex-1 overflow-auto bg-[#55606d] dark:bg-[#1c2027] p-4">
        {(cargando || error) && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
            <div className="pointer-events-auto flex items-center gap-2 rounded-lg border bg-background px-4 py-2.5 text-sm shadow-lg">
              {error ? (
                <>
                  <span className="text-destructive">{error}</span>
                  <Button size="sm" variant="outline" className="h-7" onClick={() => setPagina(1)}>Reintentar</Button>
                </>
              ) : (
                <>
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  <span className="text-muted-foreground">Generando el documento…</span>
                </>
              )}
            </div>
          </div>
        )}
        <div className="relative mx-auto" style={{ width: 'fit-content' }}>
          <canvas ref={lienzoRef} className="block rounded-sm bg-white shadow-xl" />
          <div ref={overlayRef} className="pointer-events-none absolute inset-0" />
        </div>
      </div>
    </div>
  );
}
