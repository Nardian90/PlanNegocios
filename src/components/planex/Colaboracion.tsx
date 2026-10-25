'use client';

// ============================================================================
// PLANEX — Indicador de estado de sincronización con el servidor.
//
// MISIÓN UX-002 §4.1: la colaboración, el historial de versiones, la
// comparación de versiones, los comentarios, los colaboradores y la
// resolución de conflictos viven AHORA en la vista integrada
// «Colaboración» (#/colaboracion?plan=…) con pestañas sincronizadas por
// URL. Los antiguos diálogos (DialogoHistorial, DialogoActividad,
// DialogoComentarios, DialogoConflictos) fueron sustituidos por pestañas
// de esa vista: ya no existen ventanas modales para estas tareas.
// ============================================================================

import * as React from 'react';
import { AlertTriangle, Check, CloudOff, Loader2, Upload } from 'lucide-react';
import { resumenSincronizacion, useSync } from '@/lib/supabase/sync';

export function EstadoSincronizacion({ compacto = false }: { compacto?: boolean }) {
  const estados = useSync((s) => s.estados);
  const conflictos = useSync((s) => s.conflictos);
  const conectado = useSync((s) => s.conectado);
  const guardadoEn = useSync((s) => s.guardadoEn);
  const [resumen, setResumen] = React.useState(resumenSincronizacion());

  React.useEffect(() => {
    setResumen(resumenSincronizacion());
  }, [estados, conflictos, conectado, guardadoEn]);

  const clase =
    resumen.tipo === 'conflicto' || resumen.tipo === 'error'
      ? 'text-destructive'
      : resumen.tipo === 'sin_conexion'
        ? 'text-amber-600 dark:text-amber-400'
        : resumen.tipo === 'pendiente' || resumen.tipo === 'guardando'
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-emerald-600 dark:text-emerald-400';

  const icono =
    resumen.tipo === 'conflicto' ? <AlertTriangle className="size-3.5" />
    : resumen.tipo === 'error' ? <AlertTriangle className="size-3.5" />
    : resumen.tipo === 'sin_conexion' ? <CloudOff className="size-3.5" />
    : resumen.tipo === 'guardando' ? <Loader2 className="size-3.5 animate-spin" />
    : resumen.tipo === 'pendiente' ? <Upload className="size-3.5" />
    : <Check className="size-3.5" />;

  return (
    <span className={`text-[11px] inline-flex items-center gap-1.5 ${clase} ${compacto ? '' : ''}`} role="status" aria-live="polite">
      {icono} {resumen.texto}
    </span>
  );
}
