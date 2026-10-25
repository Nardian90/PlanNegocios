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
import { AlertCircle, ChevronDown, ChevronUp, HelpCircle, Info, Plus, Sigma, Trash2, TriangleAlert } from 'lucide-react';
import { ADVERTENCIA_DATOS_FICTICIOS } from '@/lib/planex/types';

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

/** Gráfico sencillo de flujo acumulado (SVG puro). */
export function GraficoFlujo({ years, acumulado, umbral }: { years: number[]; acumulado: Record<number, number>; umbral: number }) {
  const vals = years.map((t) => acumulado[t] ?? 0);
  const min = Math.min(0, ...vals);
  const max = Math.max(umbral, ...vals, 1);
  const W = 560;
  const H = 160;
  const pasoX = W / Math.max(1, years.length - 1);
  const py = (v: number) => H - ((v - min) / (max - min)) * (H - 20) - 10;
  const puntos = vals.map((v, i) => `${i * pasoX},${py(v)}`).join(' ');
  const y0 = py(0);
  return (
    <svg viewBox={`0 0 ${W} ${H + 16}`} className="w-full max-w-2xl" role="img" aria-label="Flujo de caja acumulado por año">
      <line x1="0" y1={y0} x2={W} y2={y0} stroke="currentColor" strokeOpacity="0.35" strokeDasharray="4 3" />
      <polyline points={puntos} fill="none" stroke="currentColor" strokeWidth="2" className="text-primary" />
      {vals.map((v, i) => (
        <g key={i}>
          <circle cx={i * pasoX} cy={py(v)} r="3" className="fill-primary" />
          <text x={i * pasoX} y={H + 12} textAnchor="middle" className="fill-muted-foreground" fontSize="9">
            {years[i] === 0 ? 'Inv.' : `A${years[i]}`}
          </text>
        </g>
      ))}
    </svg>
  );
}
