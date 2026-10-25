#!/usr/bin/env node
// ============================================================================
// PLANEX — copia el worker de pdf.js a public/pdfjs (misión DOC-001 §4).
//
// El visor integrado usa pdf.js con worker real (no «fake worker» en el hilo
// principal). El despliegue es estático bajo la subruta /PlanNegocios/, así
// que el worker se sirve desde public/pdfjs/pdf.worker.min.mjs y el visor
// configura workerSrc con el basePath correspondiente.
//
// Este script se ejecuta ANTES de cada build (npm hook «prebuild») para
// garantizar que la copia corresponda SIEMPRE a la versión instalada de
// pdfjs-dist (bun.lock). Una prueba unitaria adicional verifica la
// coincidencia de versiones si la copia se queda obsoleta.
// ============================================================================

import { copyFileSync, mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require2 = createRequire(import.meta.url);
const pkg = require2('pdfjs-dist/package.json');
const origen = require2.resolve('pdfjs-dist/build/pdf.worker.min.mjs');
const destino = new URL('../public/pdfjs/pdf.worker.min.mjs', import.meta.url).pathname;

mkdirSync(new URL('../public/pdfjs/', import.meta.url).pathname, { recursive: true });
copyFileSync(origen, destino);

// Registro de versiones para la prueba de consistencia y la auditoría.
const versionFile = new URL('../public/pdfjs/VERSION.json', import.meta.url).pathname;
writeFileSync(versionFile, JSON.stringify({ pdfjsDist: pkg.version, copiado: new Date().toISOString() }, null, 2) + '\n');

if (!existsSync(destino)) {
  console.error('No se pudo copiar el worker de pdf.js');
  process.exit(1);
}
console.log(`worker pdf.js ${pkg.version} -> ${destino}`);
