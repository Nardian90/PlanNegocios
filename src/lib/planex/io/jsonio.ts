// ============================================================================
// Importación / exportación JSON con esquema versionado y validación.
// El JSON es solo datos: no se ejecuta código proveniente del archivo; las
// expresiones se evalúan con el parser seguro del motor.
// ============================================================================

import { PlanexProject, SCHEMA_VERSION } from '../types';
import { normalizarProyecto } from '../model/factory';

export interface ResultadoImportacion {
  ok: boolean;
  proyecto?: PlanexProject;
  errores: string[];
  avisos: string[];
  /** Reglas importadas desconocidas que quedaron deshabilitadas. */
  reglasDesconocidas: string[];
}

export function proyectoAJSON(p: PlanexProject): string {
  const salida: PlanexProject = {
    ...p,
    planex: { ...p.planex, schemaVersion: SCHEMA_VERSION, app: 'PLANEX Cuba', generado: new Date().toISOString() },
    actualizado: new Date().toISOString(),
  };
  return JSON.stringify(salida, null, 2);
}

export function parsearProyectoJSON(texto: string): ResultadoImportacion {
  const errores: string[] = [];
  const avisos: string[] = [];
  let dato: unknown;
  try {
    dato = JSON.parse(texto);
  } catch (e) {
    return {
      ok: false,
      errores: [`El archivo no es un JSON válido: ${(e as Error).message}`],
      avisos,
      reglasDesconocidas: [],
    };
  }
  const o = (dato ?? {}) as Record<string, unknown>;
  if (typeof o !== 'object' || o === null) {
    return { ok: false, errores: ['La raíz del JSON debe ser un objeto de proyecto.'], avisos, reglasDesconocidas: [] };
  }
  const meta = (o.planex ?? null) as Record<string, unknown> | null;
  if (!meta || typeof meta !== 'object') {
    errores.push('Falta el bloque "planex" con la versión del esquema (planex.schemaVersion). El archivo no parece un proyecto PLANEX.');
  } else {
    const version = String(meta.schemaVersion ?? '');
    if (!version) {
      errores.push('El proyecto no declara planex.schemaVersion.');
    } else {
      const [mayor] = version.split('.');
      const [mayorActual] = SCHEMA_VERSION.split('.');
      if (mayor !== mayorActual) {
        avisos.push(
          `Versión de esquema ${version} distinta de la actual ${SCHEMA_VERSION}: se intentará una importación compatible. Revise los resultados.`
        );
      }
    }
  }
  if (!Array.isArray(o.parametros)) avisos.push('El proyecto no incluye parámetros: se usarán los de fábrica.');
  if (!Array.isArray(o.reglas)) avisos.push('El proyecto no incluye reglas: se usarán las de fábrica.');

  const proyecto = normalizarProyecto(dato);
  const reglasDesconocidas = proyecto.reglas.filter((r) => r.categoria === 'Importadas').map((r) => r.nombre);
  if (reglasDesconocidas.length > 0) {
    avisos.push(
      `${reglasDesconocidas.length} regla(s) importadas no pertenecen al conjunto de fábrica y quedaron deshabilitadas hasta que las revise en Configuración de cálculos.`
    );
  }
  if (!proyecto.negocio || !proyecto.financiero || !proyecto.general) {
    errores.push('Estructura incompleta: faltan secciones esenciales del proyecto.');
  }

  return {
    ok: errores.length === 0,
    proyecto: errores.length === 0 ? proyecto : undefined,
    errores,
    avisos,
    reglasDesconocidas,
  };
}

export function descargarArchivo(nombre: string, contenido: string | Blob | ArrayBuffer, tipo = 'application/json') {
  const blob =
    typeof contenido === 'string'
      ? new Blob([contenido], { type: `${tipo};charset=utf-8` })
      : contenido instanceof Blob
        ? contenido
        : new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function nombreArchivoSeguro(nombre: string): string {
  return (nombre || 'planex')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9 _-]+/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 60) || 'planex';
}
