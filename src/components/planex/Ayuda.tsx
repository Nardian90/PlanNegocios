'use client';

// ============================================================================
// PLANEX — Centro de ayuda y guía de trabajo (#/ayuda, misión UX-002 §2).
//
// Vista pública y permanente, organizada con el marco Diátaxis:
//   Tutoriales · Guías prácticas · Referencia · Conceptos
//
// * Navegable por pestañas sincronizadas con la URL (?capa=…&articulo=…):
//   los enlaces contextuales de los módulos abren DIRECTO el artículo.
// * Búsqueda útil con fragmentos, resultados por relevancia y estados vacíos.
// * La vista es pública (no requiere sesión): puede consultarse siempre y
//   no interrumpe la edición (los enlaces contextuales abren otra pestaña).
// ============================================================================

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, BookOpen, CircleHelp, GraduationCap, ListTree, Lightbulb, Search, Wrench, X } from 'lucide-react';
import {
  ARTICULOS_AYUDA,
  AVISO_DIDACTICO,
  CAPAS,
  type ArticuloAyuda,
  type BloqueAyuda,
  type CapaDiataxis,
  articuloPorId,
  articulosPorCapa,
  buscarAyuda,
  capaDeArticulo,
} from '@/lib/planex/ayuda/contenido';
import { useAuth } from '@/lib/supabase/auth';
import { navegar, parametrosDesdeHash } from './navegacion';

const ICONOS_CAPA: Record<CapaDiataxis, React.ReactNode> = {
  tutoriales: <GraduationCap className="size-3.5" />,
  guias: <Wrench className="size-3.5" />,
  referencia: <ListTree className="size-3.5" />,
  conceptos: <Lightbulb className="size-3.5" />,
};

/** Cambia capa/artículo SIN ensuciar el historial (pestañas internas). */
function sincronizarHash(capa: string, articulo?: string): void {
  const p = new URLSearchParams();
  if (capa && capa !== 'tutoriales') p.set('capa', capa);
  if (articulo) p.set('articulo', articulo);
  const destino = `#/ayuda${p.toString() ? `?${p.toString()}` : ''}`;
  if (window.location.hash === destino) return;
  window.history.replaceState(null, '', destino);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function Ayuda() {
  const estado = useAuth((s) => s.estado);
  const [capa, setCapa] = React.useState<CapaDiataxis>('tutoriales');
  const [articuloId, setArticuloId] = React.useState<string | null>(null);
  const [consulta, setConsulta] = React.useState('');

  // URL → estado (entradas directas, recargas, enlaces contextuales).
  React.useEffect(() => {
    const leer = () => {
      const p = parametrosDesdeHash();
      const c = (p.capa as CapaDiataxis | undefined) ?? (p.articulo ? capaDeArticulo(p.articulo) : undefined);
      if (c && CAPAS.some((x) => x.id === c)) setCapa(c);
      if (p.articulo && articuloPorId(p.articulo)) setArticuloId(p.articulo);
      else if (!p.articulo) setArticuloId(null);
    };
    leer();
    window.addEventListener('hashchange', leer);
    return () => window.removeEventListener('hashchange', leer);
  }, []);

  const articulo = articuloId ? articuloPorId(articuloId) ?? null : null;
  const resultados = React.useMemo(() => (consulta.trim() ? buscarAyuda(consulta) : []), [consulta]);
  void ARTICULOS_AYUDA; // (referencia estable para pruebas de integridad del contenido)

  const alCambiarCapa = (c: string) => {
    setCapa(c as CapaDiataxis);
    setArticuloId(null);
    // Cambiar de sección deja de mostrar los resultados de la búsqueda
    // anterior: lo que se ve corresponde a la capa activa.
    setConsulta('');
    sincronizarHash(c);
  };

  const alAbrirArticulo = (a: ArticuloAyuda) => {
    setCapa(a.capa);
    setArticuloId(a.id);
    setConsulta('');
    sincronizarHash(a.capa, a.id);
  };

  const volver = () => {
    if (estado === 'autenticado') navegar('/proyectos');
    else navegar('/');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ------------------------------------------------ cabecera */}
      <header className="border-b sticky top-0 z-30 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75">
        <div className="max-w-6xl mx-auto px-4 py-3 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={volver} aria-label="Volver a la aplicación">
              <ArrowLeft className="size-3.5" /> <span className="hidden sm:inline">Volver a PLANEX</span>
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-sm font-semibold flex items-center gap-2">
                <BookOpen className="size-4 text-primary" /> Ayuda y guía de trabajo
              </h1>
              <p className="text-[11px] text-muted-foreground">
                Organizada con el marco Diátaxis: tutoriales para aprender, guías para hacer, referencia para consultar y conceptos para comprender.
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input
                value={consulta}
                onChange={(e) => setConsulta(e.target.value)}
                placeholder="Buscar en la ayuda (p. ej. «tasa», «versiones», «exportar»)"
                className="h-8 pl-8 text-sm pr-8"
                aria-label="Buscar en la ayuda"
              />
              {consulta && (
                <button
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setConsulta('')}
                  aria-label="Limpiar la búsqueda"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>
          </div>
          <Tabs value={capa} onValueChange={alCambiarCapa}>
            <TabsList className="w-full h-auto p-1 overflow-x-auto grid grid-cols-2 sm:grid-cols-4">
              {CAPAS.map((c) => (
                <TabsTrigger key={c.id} value={c.id} className="gap-1.5 text-xs px-3 py-1.5 shrink-0">
                  {ICONOS_CAPA[c.id]} {c.titulo}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </header>

      {/* ------------------------------------------------ cuerpo */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {consulta.trim() ? (
          <ResultadosBusqueda consulta={consulta} resultados={resultados} alAbrir={alAbrirArticulo} />
        ) : articulo ? (
          <ArticuloVista articulo={articulo} onVolverALista={() => { setArticuloId(null); sincronizarHash(articulo.capa); }} alAbrirArticulo={alAbrirArticulo} />
        ) : (
          <ListaCapa capa={capa} alAbrir={alAbrirArticulo} />
        )}
      </main>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Listado de una capa Diátaxis
// ----------------------------------------------------------------------------

function ListaCapa({ capa, alAbrir }: { capa: CapaDiataxis; alAbrir: (a: ArticuloAyuda) => void }) {
  const info = CAPAS.find((c) => c.id === capa)!;
  const items = articulosPorCapa(capa);
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">{info.titulo}</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">{info.descripcion}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {items.map((a) => (
          <button
            key={a.id}
            onClick={() => alAbrir(a)}
            className="text-left rounded-xl border p-4 space-y-1.5 hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="text-sm font-medium leading-snug">{a.titulo}</div>
            <p className="text-xs text-muted-foreground leading-relaxed">{a.resumen}</p>
            <div className="flex flex-wrap gap-1 pt-1">
              {a.etiquetas.slice(0, 4).map((e) => (
                <Badge key={e} variant="outline" className="text-[10px] font-normal">{e}</Badge>
              ))}
            </div>
          </button>
        ))}
      </div>
      {items.length === 0 && (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          Todavía no hay artículos en esta sección.
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Vista de un artículo
// ----------------------------------------------------------------------------

function ArticuloVista({
  articulo,
  onVolverALista,
  alAbrirArticulo,
}: {
  articulo: ArticuloAyuda;
  onVolverALista: () => void;
  alAbrirArticulo: (a: ArticuloAyuda) => void;
}) {
  return (
    <article className="max-w-3xl mx-auto space-y-5">
      <div>
        <button onClick={onVolverALista} className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 mb-3">
          <ArrowLeft className="size-3" /> Volver al listado de {CAPAS.find((c) => c.id === articulo.capa)?.titulo}
        </button>
        <h2 className="text-xl font-semibold tracking-tight">{articulo.titulo}</h2>
        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{articulo.resumen}</p>
        <div className="flex flex-wrap gap-1 pt-2">
          {articulo.etiquetas.map((e) => (
            <Badge key={e} variant="outline" className="text-[10px] font-normal">{e}</Badge>
          ))}
        </div>
      </div>

      {articulo.objetivo && (
        <div className="rounded-xl border bg-muted/30 p-3.5 text-sm space-y-1">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Objetivo</div>
          <p>{articulo.objetivo}</p>
        </div>
      )}
      {articulo.requisitos && (
        <div className="text-sm space-y-1.5">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Requisitos previos</div>
          <ul className="list-disc pl-5 space-y-1">
            {articulo.requisitos.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}

      {articulo.bloques.map((b, i) => (
        <Bloque key={i} bloque={b} />
      ))}

      {articulo.resultado && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5 text-sm space-y-1">
          <div className="text-[11px] font-medium uppercase tracking-wide">Resultado esperado</div>
          <p>{articulo.resultado}</p>
        </div>
      )}
      {articulo.errores && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-50/50 dark:bg-amber-950/20 p-3.5 text-sm space-y-1.5">
          <div className="text-[11px] font-medium uppercase tracking-wide">Errores frecuentes</div>
          <ul className="list-disc pl-5 space-y-1">
            {articulo.errores.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}
      {articulo.relacionados && articulo.relacionados.length > 0 && (
        <div className="text-sm space-y-1.5 border-t pt-4">
          <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Relacionado</div>
          <div className="flex flex-wrap gap-1.5">
            {articulo.relacionados
              .map((id) => articuloPorId(id))
              .filter((a): a is ArticuloAyuda => !!a)
              .map((a) => (
                <button
                  key={a.id}
                  onClick={() => alAbrirArticulo(a)}
                  className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs hover:bg-muted/60 transition-colors"
                >
                  {ICONOS_CAPA[a.capa]} {a.titulo}
                </button>
              ))}
          </div>
        </div>
      )}
    </article>
  );
}

function Bloque({ bloque }: { bloque: BloqueAyuda }) {
  switch (bloque.tipo) {
    case 'p':
      return <p className="text-sm leading-relaxed">{bloque.texto}</p>;
    case 'lista':
      return (
        <ul className="text-sm list-disc pl-5 space-y-1.5 leading-relaxed">
          {bloque.elementos.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      );
    case 'pasos':
      return (
        <ol className="space-y-3">
          {bloque.pasos.map((p, i) => (
            <li key={i} className="rounded-xl border p-3.5 space-y-1.5">
              <div className="text-sm font-medium">{p.titulo}</div>
              <dl className="text-xs space-y-1.5">
                <div className="flex gap-2"><dt className="text-muted-foreground w-24 shrink-0">Dónde</dt><dd>{p.donde}</dd></div>
                <div className="flex gap-2"><dt className="text-muted-foreground w-24 shrink-0">Qué hacer</dt><dd>{p.accion}</dd></div>
                <div className="flex gap-2"><dt className="text-muted-foreground w-24 shrink-0">Resultado</dt><dd>{p.resultado}</dd></div>
                {p.evitar && <div className="flex gap-2"><dt className="text-amber-600 dark:text-amber-400 w-24 shrink-0">Evite</dt><dd className="text-amber-700 dark:text-amber-300">{p.evitar}</dd></div>}
              </dl>
            </li>
          ))}
        </ol>
      );
    case 'nota':
      return (
        <p className="text-sm rounded-xl border bg-muted/40 px-3.5 py-2.5 leading-relaxed">
          <b>Nota:</b> {bloque.texto}
        </p>
      );
    case 'aviso':
      return (
        <p className="text-sm rounded-xl border border-amber-500/40 bg-amber-50/60 dark:bg-amber-950/30 px-3.5 py-2.5 leading-relaxed" role="note">
          <b className="text-amber-800 dark:text-amber-200">Aviso:</b> <span className="text-amber-900 dark:text-amber-100">{bloque.texto}</span>
        </p>
      );
    case 'formula':
      return (
        <div className="rounded-xl border p-3.5 space-y-2.5">
          <code className="block text-sm font-mono bg-muted/60 rounded-lg px-3 py-2.5 break-words">{bloque.expresion}</code>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="text-left font-medium py-1 pr-3">Variable</th>
                  <th className="text-left font-medium py-1 pr-3">Significado</th>
                  <th className="text-left font-medium py-1">Unidad</th>
                </tr>
              </thead>
              <tbody>
                {bloque.variables.map((v, i) => (
                  <tr key={i} className="border-t">
                    <td className="py-1.5 pr-3 font-mono">{v.nombre}</td>
                    <td className="py-1.5 pr-3">{v.significado}</td>
                    <td className="py-1.5">{v.unidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed"><b>Ejemplo:</b> {bloque.ejemplo}</p>
        </div>
      );
    case 'tabla':
      return (
        <div className="rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  {bloque.encabezados.map((h, i) => <th key={i} className="text-left font-medium px-3 py-2">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {bloque.filas.map((f, i) => (
                  <tr key={i} className="border-t">
                    {f.map((c, j) => <td key={j} className="px-3 py-2 align-top leading-relaxed">{c}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
  }
}

// ----------------------------------------------------------------------------
// Resultados de búsqueda
// ----------------------------------------------------------------------------

function ResultadosBusqueda({
  consulta,
  resultados,
  alAbrir,
}: {
  consulta: string;
  resultados: ReturnType<typeof buscarAyuda>;
  alAbrir: (a: ArticuloAyuda) => void;
}) {
  if (resultados.length === 0) {
    return (
      <div className="max-w-2xl mx-auto rounded-xl border border-dashed p-8 text-center space-y-3">
        <CircleHelp className="size-8 mx-auto text-muted-foreground" />
        <div className="text-sm font-medium">Sin resultados para «{consulta}»</div>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
          Pruebe con otras palabras (p. ej. «tasa», «moneda», «versión», «exportar», «conflicto») o explore
          las cuatro secciones: Tutoriales, Guías, Referencia y Conceptos.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-3 max-w-3xl mx-auto">
      <p className="text-xs text-muted-foreground">
        {resultados.length} resultado(s) para «{consulta}»
      </p>
      {resultados.map(({ articulo, fragmento }) => (
        <button
          key={articulo.id}
          onClick={() => alAbrir(articulo)}
          className="w-full text-left rounded-xl border p-3.5 space-y-1.5 hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="flex items-center gap-2 flex-wrap">
            {ICONOS_CAPA[articulo.capa]}
            <span className="text-sm font-medium">{articulo.titulo}</span>
            <Badge variant="outline" className="text-[10px] font-normal">
              {CAPAS.find((c) => c.id === articulo.capa)?.titulo}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{fragmento}</p>
        </button>
      ))}
    </div>
  );
}
