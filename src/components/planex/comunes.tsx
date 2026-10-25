'use client';

// ============================================================================
// Componentes comunes de la interfaz PLANEX: campos, tablas editables,
// celdas calculadas con acceso a su regla/parámetro, ayudas y advertencias.
// ============================================================================

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertCircle, ChevronDown, ChevronUp, FileWarning, HelpCircle, Info, PenLine, Plus, RefreshCw, Sigma, Trash2, TriangleAlert } from 'lucide-react';
import { ADVERTENCIA_DATOS_FICTICIOS } from '@/lib/planex/types';
import { usePlanex } from '@/lib/planex/store';
import { generarAnalisis, estadoAnalisis, ClaveAnalisis } from '@/lib/planex/engine/analisis';
import type { ComputedModel } from '@/lib/planex/types';
import { abrirAyuda } from './navegacion';
import { capaDeArticulo } from '@/lib/planex/ayuda/contenido';

export function Seccion({ num, titulo, descripcion, children, acciones }: { num: string; titulo: string; descripcion?: string; children: React.ReactNode; acciones?: React.ReactNode }) {
  return (
    <div className="space-y-4" data-seccion={num}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold tracking-tight flex items-baseline gap-2">
            <span className="text-primary/70 font-mono text-sm">{num}</span>
            {titulo}
          </h2>
          {descripcion && <p className="text-sm text-muted-foreground mt-1 max-w-3xl">{descripcion}</p>}
        </div>
        {acciones}
      </div>
      {children}
    </div>
  );
}

export function Ayuda({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <Collapsible className="rounded-lg border border-dashed bg-muted/30">
      <CollapsibleTrigger className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-muted/50">
        <HelpCircle className="size-4 shrink-0 text-muted-foreground" />
        <span className="font-medium">{titulo}</span>
        <ChevronDown className="size-4 ml-auto text-muted-foreground" />
      </CollapsibleTrigger>
      <CollapsibleContent className="px-3 pb-3 text-sm text-muted-foreground leading-relaxed">{texto}</CollapsibleContent>
    </Collapsible>
  );
}

export function AdvertenciaDemo({ compacto = false }: { compacto?: boolean }) {
  return (
    <div className="rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-amber-900 dark:text-amber-200 flex gap-3 items-start">
      <TriangleAlert className="size-5 shrink-0 mt-0.5" />
      <div className="text-xs leading-relaxed">
        {compacto ? 'EJEMPLO ILUSTRATIVO CON DATOS FICTICIOS — validar antes de un uso oficial.' : ADVERTENCIA_DATOS_FICTICIOS}
      </div>
    </div>
  );
}

export function Campo({ etiqueta, valor, onChange, placeholder, filas = 3 }: { etiqueta: string; valor: string; onChange: (v: string) => void; placeholder?: string; filas?: number }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium leading-none">{etiqueta}</label>
      <Textarea value={valor} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={filas} className="resize-y min-h-[2.5rem] text-sm" />
    </div>
  );
}

export function CampoTexto({ etiqueta, valor, onChange, placeholder, tipo = 'text' }: { etiqueta: string; valor: string; onChange: (v: string) => void; placeholder?: string; tipo?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium leading-none">{etiqueta}</label>
      <Input type={tipo} value={valor} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="text-sm" />
    </div>
  );
}

export function NumInput({ valor, onChange, className, decimales = 2, min }: { valor: number; onChange: (n: number) => void; className?: string; decimales?: number; min?: number }) {
  const [texto, setTexto] = React.useState<string | null>(null);
  const mostrar = texto ?? (Number.isFinite(valor) ? String(valor) : '');
  return (
    <Input
      inputMode="decimal"
      value={mostrar}
      onChange={(e) => {
        const t = e.target.value.replace(',', '.');
        setTexto(e.target.value);
        if (t === '' || t === '-' || t === '.') return;
        const n = Number(t);
        if (Number.isFinite(n)) onChange(min !== undefined ? Math.max(min, n) : n);
      }}
      onBlur={() => setTexto(null)}
      className={`text-right tabular-nums ${className ?? ''}`}
      aria-label="valor numérico"
    />
  );
}

/** Celda calculada: se distingue visualmente y enlaza con su regla/parámetro. */
export function CeldaCalculada({ valor, formula, alPulsar }: { valor: string; formula?: string; alPulsar?: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={alPulsar}
          className="w-full text-right tabular-nums font-medium text-right px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70 dark:border-emerald-900 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors text-[13px] font-mono"
        >
          {valor}
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-md">
        <div className="flex items-start gap-2 text-xs">
          <Sigma className="size-3.5 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold">Valor calculado por el motor</div>
            {formula && <div className="mt-1 font-mono text-[11px] opacity-90">{formula}</div>}
            {alPulsar && <div className="mt-1 opacity-75">Clic para inspeccionar la regla</div>}
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

export interface Columna<T> {
  titulo: string;
  ancho?: string;
  tipo?: 'texto' | 'numero' | 'select';
  opciones?: { valor: string; etiqueta: string }[];
  /** true → celda calculada no editable. */
  calculada?: boolean;
  valor: (fila: T) => string;
  onEdit?: (fila: T, valor: string | number) => void;
  render?: (fila: T) => React.ReactNode;
  celda?: string; // clases extra
}

export function TablaEditor<T extends { id: string }>({
  titulo,
  columnas,
  filas,
  onAdd,
  onDel,
  onMove,
  addLabel = 'Añadir fila',
  vacio = 'Sin filas. Utilice «Añadir fila» para comenzar.',
  resaltar,
}: {
  titulo?: string;
  columnas: Columna<T>[];
  filas: T[];
  onAdd?: () => void;
  onDel?: (id: string) => void;
  onMove?: (id: string, dir: -1 | 1) => void;
  addLabel?: string;
  vacio?: string;
  resaltar?: Set<string>;
}) {
  return (
    <Card>
      {titulo && (
        <CardHeader className="py-3">
          <CardTitle className="text-sm font-medium">{titulo}</CardTitle>
        </CardHeader>
      )}
      <CardContent className="py-2 px-2">
        {filas.length === 0 ? (
          <p className="text-sm text-muted-foreground px-3 py-6 text-center">{vacio}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-full">
              <TableHeader>
                <TableRow>
                  {columnas.map((c, i) => (
                    <TableHead key={i} style={{ width: c.ancho }} className={c.tipo === 'numero' ? 'text-right' : ''}>
                      {c.titulo}
                    </TableHead>
                  ))}
                  {(onDel || onMove) && <TableHead className="w-20 text-right">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filas.map((fila) => (
                  <TableRow key={fila.id} className={resaltar?.has(fila.id) ? 'bg-amber-50 dark:bg-amber-950/30' : ''}>
                    {columnas.map((c, i) => (
                      <TableCell key={i} className={c.celda ?? 'px-2'}>
                        {c.render ? (
                          c.render(fila)
                        ) : c.tipo === 'numero' ? (
                          <NumInput valor={Number(c.valor(fila))} onChange={(n) => c.onEdit?.(fila, n)} className="h-8" />
                        ) : c.tipo === 'select' ? (
                          <Select value={c.valor(fila)} onValueChange={(v) => c.onEdit?.(fila, v)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {c.opciones?.map((o) => (
                                <SelectItem key={o.valor} value={o.valor} className="text-xs">
                                  {o.etiqueta}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input value={c.valor(fila)} onChange={(e) => c.onEdit?.(fila, e.target.value)} className="h-8 text-sm" />
                        )}
                      </TableCell>
                    ))}
                    {(onDel || onMove) && (
                      <TableCell className="px-2 text-right whitespace-nowrap">
                        {onMove && (
                          <>
                            <Button variant="ghost" size="icon" className="size-7" onClick={() => onMove(fila.id, -1)} aria-label="Subir fila">
                              <ChevronUp className="size-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="size-7" onClick={() => onMove(fila.id, 1)} aria-label="Bajar fila">
                              <ChevronDown className="size-3.5" />
                            </Button>
                          </>
                        )}
                        {onDel && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (confirm('¿Eliminar esta fila? Esta operación no se puede deshacer desde la interfaz (puede restaurar la plantilla o importar un JSON).')) onDel(fila.id);
                            }}
                            aria-label="Eliminar fila"
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {onAdd && (
          <div className="px-2 py-2">
            <Button variant="outline" size="sm" onClick={onAdd} className="gap-1.5">
              <Plus className="size-3.5" /> {addLabel}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function EtiquetaIssue({ tipo }: { tipo: string }) {
  const mapa: Record<string, { clase: string; texto: string; Icono: React.ElementType }> = {
    error: { clase: 'bg-destructive/15 text-destructive border-destructive/40', texto: 'Error de cálculo', Icono: AlertCircle },
    inconsistencia: { clase: 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40', texto: 'Inconsistencia', Icono: TriangleAlert },
    pendiente: { clase: 'bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/40', texto: 'Pendiente', Icono: Info },
    supuesto: { clase: 'bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/40', texto: 'Supuesto a validar', Icono: HelpCircle },
    documental: { clase: 'bg-muted text-muted-foreground border-border', texto: 'Advertencia documental', Icono: Info },
    legal: { clase: 'bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/40', texto: 'Requisito legal', Icono: TriangleAlert },
  };
  const m = mapa[tipo] ?? mapa.documental;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${m.clase}`}>
      <m.Icono className="size-3" />
      {m.texto}
    </span>
  );
}

/** Gráfico sencillo de flujo acumulado (SVG puro). Ejes con etiquetas
 *  numéricas y marcas de años (coherente con las figuras del documento). */
export function GraficoFlujo({ years, acumulado, umbral, fmtEje }: { years: number[]; acumulado: Record<number, number>; umbral: number; fmtEje: (v: number) => string }) {
  const vals = years.map((t) => acumulado[t] ?? 0);
  const min = Math.min(0, ...vals);
  const max = Math.max(umbral, ...vals, 1);
  const W = 560;
  const H = 160;
  const PAD_IZQ = 52;
  const pasoX = (W - PAD_IZQ) / Math.max(1, years.length - 1);
  const py = (v: number) => H - ((v - min) / (max - min)) * (H - 20) - 10;
  const puntos = vals.map((v, i) => `${PAD_IZQ + i * pasoX},${py(v)}`).join(' ');
  const y0 = py(0);
  // Rejilla con valores «bonitos» (DOC-002-R1 §7, misma convención que las figuras)
  const paso = (() => {
    const rango = (max - min) / 5;
    const mag = Math.pow(10, Math.floor(Math.log10(Math.abs(rango) || 1)));
    const norm = rango / mag;
    const n = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
    return n * mag;
  })();
  const lineas: number[] = [];
  for (let v = Math.ceil(min / paso - 1e-9) * paso; v <= Math.floor(max / paso + 1e-9) * paso + paso * 1e-6; v += paso) lineas.push(Math.round(v * 1e6) / 1e6);
  return (
    <svg viewBox={`0 0 ${W} ${H + 16}`} className="w-full max-w-2xl" role="img" aria-label="Flujo de caja acumulado por año">
      {lineas.map((v) => (
        <g key={v}>
          <line x1={PAD_IZQ} y1={py(v)} x2={W} y2={py(v)} stroke="currentColor" strokeOpacity="0.12" strokeWidth="1" />
          <text x={PAD_IZQ - 6} y={py(v) + 3} textAnchor="end" className="fill-muted-foreground" fontSize="9">
            {fmtEje(v)}
          </text>
        </g>
      ))}
      <line x1={PAD_IZQ} y1={y0} x2={W} y2={y0} stroke="currentColor" strokeOpacity="0.35" strokeDasharray="4 3" />
      <polyline points={puntos} fill="none" stroke="currentColor" strokeWidth="2" className="text-primary" />
      {vals.map((v, i) => (
        <g key={i}>
          <circle cx={PAD_IZQ + i * pasoX} cy={py(v)} r="3" className="fill-primary" />
          <text x={PAD_IZQ + i * pasoX} y={H + 12} textAnchor="middle" className="fill-muted-foreground" fontSize="9">
            {years[i] === 0 ? 'Inv.' : `A${years[i]}`}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ============================================================================
// Panel de análisis dinámico con trazabilidad (misión §12.13).
// Muestra el texto GENERADO por el modelo, permite editarlo (guardando la
// huella de origen y el autor) y regenerarlo; si los datos cambian tras una
// edición manual, marca el texto como DESACTUALIZADO sin sobrescribirlo.
// ============================================================================

export function PanelAnalisis({
  titulo,
  clave,
  modelo,
  autorActual,
}: {
  titulo: string;
  clave: ClaveAnalisis;
  modelo: ComputedModel;
  autorActual?: string;
}) {
  const p = usePlanex((s) => s.proyecto);
  const guardarAnalisis = usePlanex((s) => s.guardarAnalisis);
  const regenerarAnalisis = usePlanex((s) => s.regenerarAnalisis);
  const [editando, setEditando] = React.useState(false);
  const [borrador, setBorrador] = React.useState('');
  const [verDiff, setVerDiff] = React.useState(false);

  const generados = generarAnalisis(p, modelo);
  const actual = generados[clave];
  const { estado, texto } = estadoAnalisis(p, clave, actual);
  const guardado = p.analisis?.[clave];

  const badge =
    estado === 'generado' ? (
      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/40 gap-1">
        <Sigma className="size-3" /> Generado por el modelo
      </Badge>
    ) : estado === 'manual' ? (
      <Badge className="bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/40 gap-1">
        <PenLine className="size-3" /> Editado (al día)
      </Badge>
    ) : (
      <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/40 gap-1">
        <FileWarning className="size-3" /> Editado — DESACTUALIZADO
      </Badge>
    );

  return (
    <Card className="border-dashed">
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-medium flex flex-wrap items-center gap-2 justify-between">
          <span className="flex items-center gap-2">{titulo} {badge}</span>
          <span className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => {
                setBorrador(texto);
                setEditando((e) => !e);
                setVerDiff(false);
              }}
            >
              <PenLine className="size-3" /> {editando ? 'Cerrar' : estado === 'generado' ? 'Editar' : 'Revisar'}
            </Button>
            {estado !== 'generado' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => setVerDiff((v) => !v)}
                >
                  <RefreshCw className="size-3" /> {verDiff ? 'Ocultar propuesta' : 'Comparar con el modelo'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => regenerarAnalisis(clave)}
                  title="Sustituye la edición manual por la versión actual del modelo"
                >
                  Regenerar
                </Button>
              </>
            )}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {(estado === 'generado' || !editando) && (
          <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">{texto}</p>
        )}
        {verDiff && (
          <div className="rounded-lg border p-3 text-xs leading-relaxed bg-muted/40">
            <div className="font-medium mb-1">Versión actual del modelo (propuesta):</div>
            <p className="whitespace-pre-wrap">{actual.texto}</p>
          </div>
        )}
        {editando && (
          <div className="space-y-2">
            <Textarea
              value={borrador}
              onChange={(e) => setBorrador(e.target.value)}
              rows={8}
              className="text-sm"
              aria-label="Edición del análisis"
            />
            <div className="flex flex-wrap gap-2 items-center">
              <Button
                size="sm"
                onClick={() => {
                  guardarAnalisis(clave, borrador, actual.huella, autorActual);
                  setEditando(false);
                  setVerDiff(false);
                }}
              >
                Guardar edición
              </Button>
              <Button size="sm" variant="outline" onClick={() => setEditando(false)}>
                Cancelar
              </Button>
              <p className="text-[11px] text-muted-foreground flex-1 min-w-48">
                Al guardar se registra la huella de los datos de origen{autorActual ? ` y el autor («${autorActual}»)` : ''}; si el modelo cambia, el texto se marcará como desactualizado en lugar de sobrescribirse.
              </p>
            </div>
          </div>
        )}
        {guardado?.actualizadoEn && estado !== 'generado' && (
          <p className="text-[11px] text-muted-foreground">
            Última edición manual: {guardado.actualizadoPor ? `por ${guardado.actualizadoPor} — ` : ''}
            {new Date(guardado.actualizadoEn).toLocaleString('es-ES')}.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ----------------------------------------------------------------------------
// Enlace contextual al Centro de ayuda (misión UX-002 §2.3)
// ----------------------------------------------------------------------------

/**
 * Chip de ayuda contextual: abre el artículo indicado del Centro de ayuda
 * EN OTRA PESTAÑA, directo al contenido (no a la portada). El formulario y los
 * cambios sin guardar de la pestaña de trabajo permanecen intactos.
 */
export function EnlaceAyuda({ articulo, etiqueta, compacto = false }: { articulo: string; etiqueta?: string; compacto?: boolean }) {
  const existe = capaDeArticulo(articulo) !== undefined;
  if (!existe) {
    // No se muestran iconos de interrogación sin contenido real (misión §2.3).
    return null;
  }
  const alPulsar = () => {
    const capa = capaDeArticulo(articulo);
    abrirAyuda(capa, articulo);
  };
  return (
    <button
      type="button"
      onClick={alPulsar}
      title={etiqueta ? `Ayuda: ${etiqueta}` : 'Ayuda y guía de trabajo (se abre en otra pestaña)'}
      aria-label={etiqueta ? `Ayuda: ${etiqueta} (abre en otra pestaña)` : 'Ayuda y guía de trabajo (abre en otra pestaña)'}
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
    >
      <HelpCircle className="size-3" />
      {!compacto && (etiqueta ?? 'Ayuda')}
    </button>
  );
}
