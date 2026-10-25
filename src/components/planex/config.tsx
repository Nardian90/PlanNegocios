'use client';

// ============================================================================
// Configuración de cálculos — Nivel A (parámetros) y Nivel B (reglas con
// fórmulas editables), con constructor visual, validación en vivo, prueba con
// datos actuales e historial. Es el panel de auditoría del motor.
// ============================================================================

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertCircle, BookOpen, Check, History, Pencil, RotateCcw, Search, Sigma, Wand2, X } from 'lucide-react';
import { usePlanex } from '@/lib/planex/store';
import { ComputedModel, Parametro, Regla, PlanexProject } from '@/lib/planex/types';
import { computeProject } from '@/lib/planex/engine/engine';
import { parsear, extraerVariables } from '@/lib/planex/engine/parser';
import { FormulaError } from '@/lib/planex/engine/tokenizer';
import { fmtK, fmtPct } from '@/lib/planex/format';

// ---------------------------------------------------------------------------

export function SeccionConfig({ modelo }: { modelo: ComputedModel }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight flex items-baseline gap-2">
          <Sigma className="size-5 translate-y-0.5 text-primary/70" />
          Configuración de cálculos
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          Dos niveles complementarios: <b>parámetros</b> (variables utilizadas por las fórmulas) y <b>reglas</b> (expresiones que determinan cada resultado). Todo se guarda por proyecto y no afecta a otras plantillas ni proyectos.
        </p>
      </div>
      <PanelParametros modelo={modelo} />
      <PanelReglas modelo={modelo} />
      <AyudaSintaxis />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nivel A: parámetros
// ---------------------------------------------------------------------------

function PanelParametros({ modelo }: { modelo: ComputedModel }) {
  const p = usePlanex((s) => s.proyecto);
  const setParam = usePlanex((s) => s.setParam);
  const restaurar = usePlanex((s) => s.restaurarParametros);
  const [filtro, setFiltro] = React.useState('');

  /** Reglas que dependen de cada parámetro (grafo del motor). */
  const dependientes = React.useMemo(() => {
    const mapa: Record<string, string[]> = {};
    for (const r of p.reglas) {
      try {
        const ast = parsear(r.expresion);
        for (const v of extraerVariables(ast)) {
          mapa[v] = mapa[v] ?? [];
          mapa[v].push(r.id);
        }
      } catch {
        /* regla con error de sintaxis: no aporta dependencias */
      }
    }
    return mapa;
  }, [p.reglas]);

  const visibles = p.parametros.filter(
    (x) => !filtro || x.nombre.toLowerCase().includes(filtro.toLowerCase()) || x.id.toLowerCase().includes(filtro.toLowerCase())
  );

  return (
    <Card>
      <CardHeader className="py-3 flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="text-sm font-medium">Nivel A — Parámetros de cálculo ({p.parametros.length})</CardTitle>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="size-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar parámetro…" className="h-8 w-56 pl-7 text-sm" />
          </div>
          <Button variant="outline" size="sm" onClick={() => confirm('¿Restaurar TODOS los parámetros a sus valores de fábrica? Las personalizaciones de este proyecto se perderán.') && restaurar()} className="gap-1.5">
            <RotateCcw className="size-3.5" /> Restaurar valores de fábrica
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-2">
        <div className="overflow-x-auto">
          <Table className="min-w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-56">Parámetro</TableHead>
                <TableHead className="text-right min-w-28">Valor</TableHead>
                <TableHead className="min-w-20">Unidad</TableHead>
                <TableHead className="min-w-64">Descripción / fuente</TableHead>
                <TableHead className="min-w-40">Reglas que lo usan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibles.map((x) => (
                <TableRow key={x.id}>
                  <TableCell>
                    <div className="font-medium text-sm flex items-center gap-1.5 flex-wrap">
                      {x.nombre}
                      {x.demo && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="outline" className="text-[10px] border-violet-400/50 text-violet-600 dark:text-violet-300">
                              demo
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-72 text-xs">Supuesto de demostración editable: no constituye la tasa legal aplicable.</TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <div className="font-mono text-[10px] text-muted-foreground">{x.id}</div>
                  </TableCell>
                  <TableCell>
                    <ValorParametro param={x} onChange={(v) => setParam(x.id, v)} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{x.unidad}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    <div>{x.descripcion}</div>
                    <div className="mt-0.5 opacity-80">
                      Fuente: {x.fuente}
                      {x.fechaRef ? ` · Ref.: ${x.fechaRef}` : ''}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(dependientes[x.id] ?? []).slice(0, 4).map((rid) => (
                        <Badge key={rid} variant="secondary" className="font-mono text-[10px]">
                          {rid}
                        </Badge>
                      ))}
                      {(dependientes[x.id] ?? []).length > 4 && <Badge variant="secondary" className="text-[10px]">+{(dependientes[x.id] ?? []).length - 4}</Badge>}
                      {!(dependientes[x.id] ?? []).length && <span className="text-xs text-muted-foreground">—</span>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function ValorParametro({ param, onChange }: { param: Parametro; onChange: (v: number) => void }) {
  const [texto, setTexto] = React.useState<string | null>(null);
  const esPct = param.tipo === 'porcentaje';
  const mostrar = texto ?? (esPct ? String(Math.round(param.valor * 10000) / 100) : String(param.valor));
  return (
    <div className="flex items-center gap-1 justify-end">
      <Input
        inputMode="decimal"
        value={mostrar}
        onChange={(e) => {
          setTexto(e.target.value);
          const t = e.target.value.replace(',', '.');
          if (t === '' || t === '-') return;
          const n = Number(t);
          if (Number.isFinite(n)) onChange(esPct ? n / 100 : n);
        }}
        onBlur={() => setTexto(null)}
        className="h-8 w-24 text-right tabular-nums"
        aria-label={`valor de ${param.nombre}`}
      />
      {esPct && <span className="text-xs text-muted-foreground">%</span>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nivel B: reglas
// ---------------------------------------------------------------------------

function PanelReglas({ modelo }: { modelo: ComputedModel }) {
  const p = usePlanex((s) => s.proyecto);
  const { setRegla, restaurarRegla, restaurarReglas } = usePlanex();
  const [editando, setEditando] = React.useState<string | null>(null);
  const [categoria, setCategoria] = React.useState('todas');

  const categorias = ['todas', ...Array.from(new Set(p.reglas.map((r) => r.categoria)))];
  const visibles = p.reglas.filter((r) => categoria === 'todas' || r.categoria === categoria);

  return (
    <Card>
      <CardHeader className="py-3 flex flex-row items-center justify-between flex-wrap gap-2">
        <CardTitle className="text-sm font-medium">Nivel B — Reglas y fórmulas ({p.reglas.length})</CardTitle>
        <div className="flex items-center gap-2">
          <Select value={categoria} onValueChange={setCategoria}>
            <SelectTrigger className="h-8 w-52 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {categorias.map((c) => (
                <SelectItem key={c} value={c}>
                  {c === 'todas' ? 'Todas las categorías' : c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => confirm('¿Restaurar TODAS las reglas a su expresión de fábrica? Se perderán las personalizaciones de este proyecto.') && restaurarReglas()} className="gap-1.5">
            <RotateCcw className="size-3.5" /> Restaurar fórmulas de fábrica
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {visibles.map((r) => {
          const estado = modelo.estados[r.id];
          return (
            <div key={r.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{r.nombre}</span>
                    <Badge variant="secondary" className="font-mono text-[10px]">{r.id}</Badge>
                    <Badge variant="outline" className="text-[10px]">{r.ambito}</Badge>
                    <Badge variant="outline" className="text-[10px]">{r.unidad}</Badge>
                    {r.modificada && (
                      <Badge className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/40 hover:bg-amber-500/25">
                        <History className="size-2.5 mr-1" /> modificada
                      </Badge>
                    )}
                    {!r.habilitada && <Badge variant="destructive" className="text-[10px]">deshabilitada</Badge>}
                    {estado && !estado.ok && (
                      <Badge variant="destructive" className="text-[10px] gap-1">
                        <AlertCircle className="size-2.5" /> error
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{r.descripcion}</p>
                  <div className="font-mono text-[11px] mt-1.5 rounded bg-muted px-2 py-1 overflow-x-auto">{r.expresion}</div>
                  {estado && !estado.ok && <p className="text-xs text-destructive mt-1">Error: {estado.error}</p>}
                  {estado && estado.ok && estado.valores && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Valores actuales (año 0–3): {[0, 1, 2, 3].filter((t) => estado.valores![t] !== undefined).map((t) => `A${t}=${fmtK(estado.valores![t])}`).join(' · ')}
                    </p>
                  )}
                  {r.expresionAnterior && <p className="text-[10px] text-muted-foreground mt-1 font-mono">Anterior: {r.expresionAnterior}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Switch checked={r.habilitada} onCheckedChange={(v) => setRegla(r.id, { habilitada: v })} aria-label={`habilitar ${r.nombre}`} />
                      </div>
                    </TooltipTrigger>
                    <TooltipContent className="text-xs">Habilitar / deshabilitar la regla</TooltipContent>
                  </Tooltip>
                  <Button variant="outline" size="sm" onClick={() => setEditando(r.id)} className="gap-1.5">
                    <Pencil className="size-3.5" /> Editar fórmula
                  </Button>
                  {r.modificada && (
                    <Button variant="ghost" size="sm" onClick={() => restaurarRegla(r.id)} className="gap-1.5" title="Restaurar la expresión de fábrica de esta regla">
                      <RotateCcw className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
      {editando && <EditorFormulas reglaId={editando} proyecto={p} cerrar={() => setEditando(null)} />}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Editor de fórmulas (constructor visual + expresión + prueba + historial)
// ---------------------------------------------------------------------------

function EditorFormulas({ reglaId, proyecto, cerrar }: { reglaId: string; proyecto: PlanexProject; cerrar: () => void }) {
  const setRegla = usePlanex((s) => s.setRegla);
  const regla = proyecto.reglas.find((r) => r.id === reglaId)!;
  const [borrador, setBorrador] = React.useState(regla.expresion);
  const [pestana, setPestana] = React.useState('expresion');

  const erroresSintaxis = React.useMemo(() => {
    try {
      parsear(borrador);
      return null;
    } catch (e) {
      return (e as FormulaError).message;
    }
  }, [borrador]);

  /** Prueba con los datos actuales: clona el proyecto con la fórmula borrador. */
  const prueba = React.useMemo(() => {
    if (erroresSintaxis) return null;
    try {
      const clon: PlanexProject = JSON.parse(JSON.stringify(proyecto));
      const r = clon.reglas.find((x) => x.id === reglaId)!;
      r.expresion = borrador;
      const m = computeProject(clon);
      const vals = m.valores[reglaId] ?? m.estados[reglaId]?.valores ?? null;
      const errs = m.issues.filter((i) => i.tipo === 'error');
      return { modelo: m, valores: vals, errores: errs };
    } catch (e) {
      return { modelo: null, valores: null, errores: [{ mensaje: (e as Error).message }] };
    }
  }, [borrador, proyecto, reglaId, erroresSintaxis]);

  const variablesDisponibles = React.useMemo(() => {
    const mismas = proyecto.reglas.filter((r) => r.ambito === regla.ambito && r.id !== regla.id).map((r) => r.id);
    const globales = proyecto.parametros.map((x) => x.id);
    const fila = regla.ambito === 'servicio' ? ['precio_base', 'cantidad_base_mensual', 'capacidad_max_mensual', 'costo_variable_unitario'] : regla.ambito === 'personal' ? ['cantidad', 'salario_promedio_anual'] : regla.ambito === 'anio' ? ['otros_ingresos_serie'] : [];
    const constantes = ['PERIODO', 'PERIODOS', 'MESES_ANIO'];
    const funciones = ['MAX', 'MIN', 'ABS', 'ROUND', 'IF', 'AND', 'OR', 'NOT', 'SUM', 'POW', 'LAG'];
    const sumatorias = regla.ambito === 'anio' || regla.ambito === 'proyecto' ? ['SUMA_SERVICIOS', 'SUMA_PERSONAL', 'SUMA_APORTACIONES', 'SUMA_INVERSIONES'] : [];
    return { mismas, globales, fila, constantes, funciones, sumatorias };
  }, [proyecto, regla]);

  const insertar = (token: string) => setBorrador((b) => (b ? `${b} ${token}` : token));

  const aplicar = () => {
    if (erroresSintaxis) return;
    setRegla(reglaId, { expresion: borrador });
    cerrar();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && cerrar()}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            <Wand2 className="size-4 text-primary" /> {regla.nombre}
            <Badge variant="secondary" className="font-mono text-[10px]">{regla.id}</Badge>
            <Badge variant="outline" className="text-[10px]">ámbito: {regla.ambito}</Badge>
            <Badge variant="outline" className="text-[10px]">{regla.unidad}</Badge>
          </DialogTitle>
          <DialogDescription>{regla.descripcion}</DialogDescription>
        </DialogHeader>

        <Tabs value={pestana} onValueChange={setPestana}>
          <TabsList>
            <TabsTrigger value="expresion">Expresión</TabsTrigger>
            <TabsTrigger value="constructor">Constructor visual</TabsTrigger>
            <TabsTrigger value="prueba">Prueba con datos actuales</TabsTrigger>
          </TabsList>

          <TabsContent value="expresion" className="space-y-3">
            <Textarea value={borrador} onChange={(e) => setBorrador(e.target.value)} className="font-mono text-[13px] min-h-24" spellCheck={false} />
            {erroresSintaxis ? (
              <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-2.5 text-xs text-destructive flex gap-2">
                <AlertCircle className="size-4 shrink-0 mt-0.5" /> {erroresSintaxis}
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-300/60 bg-emerald-50 dark:bg-emerald-950/40 p-2.5 text-xs text-emerald-700 dark:text-emerald-300 flex gap-2">
                <Check className="size-4 shrink-0 mt-0.5" /> Sintaxis válida. Al guardar se verificarán variables, dependencias circulares y divisiones por cero.
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {variablesDisponibles.globales.slice(0, 10).map((g) => (
                <Button key={g} variant="secondary" size="sm" className="h-6 font-mono text-[10px]" onClick={() => insertar(g)}>
                  {g}
                </Button>
              ))}
              {variablesDisponibles.mismas.slice(0, 10).map((g) => (
                <Button key={g} variant="outline" size="sm" className="h-6 font-mono text-[10px]" onClick={() => insertar(g)}>
                  {g}
                </Button>
              ))}
              {variablesDisponibles.fila.map((g) => (
                <Button key={g} variant="outline" size="sm" className="h-6 font-mono text-[10px]" onClick={() => insertar(g)}>
                  {g}
                </Button>
              ))}
              {variablesDisponibles.constantes.map((g) => (
                <Button key={g} variant="outline" size="sm" className="h-6 font-mono text-[10px]" onClick={() => insertar(g)}>
                  {g}
                </Button>
              ))}
              {variablesDisponibles.funciones.map((g) => (
                <Button key={g} variant="outline" size="sm" className="h-6 font-mono text-[10px]" onClick={() => insertar(`${g}(`)}>
                  {g}(
                </Button>
              ))}
              {variablesDisponibles.sumatorias.map((g) => (
                <Button key={g} variant="outline" size="sm" className="h-6 font-mono text-[10px]" onClick={() => insertar(`${g}(`)}>
                  {g}(
                </Button>
              ))}
            </div>
            {regla.expresionAnterior && (
              <div className="text-[11px] text-muted-foreground font-mono border-l-2 pl-2">Anterior: {regla.expresionAnterior}</div>
            )}
          </TabsContent>

          <TabsContent value="constructor" className="space-y-3">
            <ConstructorVisual regla={regla} proyecto={proyecto} alGenerar={(expr) => { setBorrador(expr); setPestana('expresion'); }} />
          </TabsContent>

          <TabsContent value="prueba" className="space-y-3">
            {erroresSintaxis && <p className="text-sm text-muted-foreground">Corrija la sintaxis para poder probar la fórmula.</p>}
            {prueba && (
              <>
                {prueba.valores ? (
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {Object.keys(prueba.valores).slice(0, 8).map((t) => (
                            <TableHead key={t} className="text-right">Año {t}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          {Object.entries(prueba.valores).slice(0, 8).map(([t, v]) => (
                            <TableCell key={t} className="text-right tabular-nums font-medium">{fmtK(Number(v))}</TableCell>
                          ))}
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/40 p-2.5 text-xs text-amber-900 dark:text-amber-200">
                    La regla no produjo valores (puede depender de datos aún no completados o estar deshabilitada por un error).
                  </div>
                )}
                {prueba.errores.length > 0 ? (
                  <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-2.5 text-xs text-destructive space-y-1">
                    {prueba.errores.map((e, i) => (
                      <div key={i} className="flex gap-2">
                        <AlertCircle className="size-3.5 shrink-0 mt-0.5" /> {e.mensaje}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-emerald-300/60 bg-emerald-50 dark:bg-emerald-950/40 p-2.5 text-xs text-emerald-700 dark:text-emerald-300">
                    El modelo completo recalcula sin errores con esta fórmula: {prueba.modelo?.issues.filter((i) => i.tipo === 'pendiente').length ?? 0} datos pendientes y ninguna inconsistencia nueva.
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={cerrar} className="gap-1.5">
            <X className="size-4" /> Cancelar
          </Button>
          <Button variant="outline" onClick={() => setBorrador(regla.expresionDefault)} className="gap-1.5">
            <RotateCcw className="size-4" /> Predeterminada
          </Button>
          <Button onClick={aplicar} disabled={!!erroresSintaxis} className="gap-1.5">
            <Check className="size-4" /> Guardar fórmula
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Constructor visual: patrones comunes con selección de variables ------
function ConstructorVisual({ regla, proyecto, alGenerar }: { regla: Regla; proyecto: PlanexProject; alGenerar: (expr: string) => void }) {
  const candidatas = proyecto.reglas.filter((r) => r.ambito === regla.ambito && r.id !== regla.id).map((r) => r.id);
  const pctParams = proyecto.parametros.filter((x) => x.tipo === 'porcentaje').map((x) => x.id);
  const [base, setBase] = React.useState(candidatas[0] ?? '');
  const [tasa, setTasa] = React.useState(pctParams[0] ?? '');
  const [partes, setPartes] = React.useState<string[]>(candidatas.slice(0, 2));
  const [minCero, setMinCero] = React.useState(true);

  return (
    <div className="space-y-4 text-sm">
      <p className="text-muted-foreground">Componga la fórmula a partir de patrones habituales; el resultado puede editarse después como expresión libre.</p>

      <div className="rounded-lg border p-3 space-y-3">
        <div className="font-medium">1) Porcentaje de una base (base × tasa)</div>
        <div className="grid gap-2 md:grid-cols-2">
          <Select value={base} onValueChange={setBase}>
            <SelectTrigger className="text-sm"><SelectValue placeholder="Base de cálculo" /></SelectTrigger>
            <SelectContent>
              {candidatas.map((c) => (
                <SelectItem key={c} value={c} className="font-mono text-xs">{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tasa} onValueChange={setTasa}>
            <SelectTrigger className="text-sm"><SelectValue placeholder="Tasa (parámetro %)" /></SelectTrigger>
            <SelectContent>
              {pctParams.map((c) => (
                <SelectItem key={c} value={c} className="font-mono text-xs">{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={minCero} onCheckedChange={setMinCero} />
          <span className="text-xs text-muted-foreground">Aplicar mínimo cero a resultados negativos (MAX(0, …))</span>
        </div>
        <code className="block text-xs bg-muted rounded px-2 py-1.5 font-mono">{minCero ? `MAX(0, ${base} * ${tasa})` : `${base} * ${tasa}`}</code>
        <Button size="sm" disabled={!base || !tasa} onClick={() => alGenerar(minCero ? `MAX(0, ${base} * ${tasa})` : `${base} * ${tasa}`)}>
          Usar este patrón
        </Button>
      </div>

      <div className="rounded-lg border p-3 space-y-3">
        <div className="font-medium">2) Suma de partidas</div>
        <div className="flex flex-wrap gap-1.5">
          {candidatas.map((c) => (
            <Button key={c} variant={partes.includes(c) ? 'default' : 'outline'} size="sm" className="h-6 font-mono text-[10px]" onClick={() => setPartes((ps) => (ps.includes(c) ? ps.filter((x) => x !== c) : [...ps, c]))}>
              {c}
            </Button>
          ))}
        </div>
        <code className="block text-xs bg-muted rounded px-2 py-1.5 font-mono">{partes.join(' + ') || '…'}</code>
        <Button size="sm" disabled={partes.length < 2} onClick={() => alGenerar(partes.join(' + '))}>
          Usar esta suma
        </Button>
      </div>

      <div className="rounded-lg border p-3 space-y-3">
        <div className="font-medium">3) Proyección con crecimiento anual</div>
        <div className="grid gap-2 md:grid-cols-2">
          <Select value={base} onValueChange={setBase}>
            <SelectTrigger className="text-sm"><SelectValue placeholder="Partida base" /></SelectTrigger>
            <SelectContent>
              {candidatas.map((c) => (
                <SelectItem key={c} value={c} className="font-mono text-xs">{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tasa} onValueChange={setTasa}>
            <SelectTrigger className="text-sm"><SelectValue placeholder="Crecimiento (parámetro %)" /></SelectTrigger>
            <SelectContent>
              {pctParams.map((c) => (
                <SelectItem key={c} value={c} className="font-mono text-xs">{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <code className="block text-xs bg-muted rounded px-2 py-1.5 font-mono">{base} * (1 + {tasa}) ^ MAX(0, PERIODO - 1)</code>
        <Button size="sm" disabled={!base || !tasa} onClick={() => alGenerar(`${base} * (1 + ${tasa}) ^ MAX(0, PERIODO - 1)`)}>
          Usar esta proyección
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Documentación de la sintaxis del lenguaje
// ---------------------------------------------------------------------------

export function AyudaSintaxis() {
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <BookOpen className="size-4" /> Documentación del lenguaje de fórmulas
        </CardTitle>
      </CardHeader>
      <CardContent className="text-xs text-muted-foreground space-y-2">
        <div>
          <b>Operadores:</b> <code className="font-mono">+ − * / ^ ( ) %</code> · comparaciones <code className="font-mono">= == &lt;&gt; != &lt; &gt; &lt;= &gt;=</code> · lógicos <code className="font-mono">AND OR NOT</code>. El sufijo <code className="font-mono">%</code> divide entre 100 (<code className="font-mono">35%</code> = 0,35).
        </div>
        <div>
          <b>Funciones:</b> <code className="font-mono">IF(cond, entonces, si_no)</code> · <code className="font-mono">MIN MAX ABS ROUND(x, dec) SUM POW</code>.
        </div>
        <div>
          <b>Referencias temporales:</b> <code className="font-mono">PERIODO</code> (año actual; 0 = inversión) · <code className="font-mono">PERIODOS</code> · <code className="font-mono">MESES_ANIO</code> · <code className="font-mono">LAG(partida, n)</code> valor de una partida anual n años atrás (solo reglas anuales).
        </div>
        <div>
          <b>Sumatorias por tabla</b> (ámbito anual/proyecto): <code className="font-mono">SUMA_SERVICIOS(expr)</code> · <code className="font-mono">SUMA_PERSONAL(expr)</code> · <code className="font-mono">SUMA_APORTACIONES(monto_aportacion)</code> · <code className="font-mono">SUMA_INVERSIONES(IF(AND(categoria_inv = "inversion_fija", moneda_inv = "USD"), monto_inv, 0))</code>.
        </div>
        <div>
          <b>Campos por fila:</b> servicios: <code className="font-mono">precio_base, cantidad_base_mensual, capacidad_max_mensual, costo_variable_unitario</code> · personal: <code className="font-mono">cantidad, salario_promedio_anual</code> · inversiones: <code className="font-mono">monto_inv, categoria_inv, moneda_inv, vida_util_inv</code>.
        </div>
        <div>
          <b>Seguridad:</b> no se ejecuta código del usuario: el analizador admite únicamente las operaciones listadas, valida variables y unidades, detecta dependencias circulares y divisiones por cero, y exige resultados finitos. Las fórmulas se guardan por proyecto; las no traducibles a Excel se documentan al exportar.
        </div>
      </CardContent>
    </Card>
  );
}
