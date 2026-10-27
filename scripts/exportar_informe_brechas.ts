// ============================================================================
// PLANEX-DATA-001 — Exportación de los entregables documentales del
// expediente Holguín (headless, misma vía que la exportación de regresión).
//
// Genera en docs/expediente-holguin/:
//   · PLANEX_Informe_Brechas_Documentales_<proyecto>_<fecha>.pdf (obligatorio)
//   · Centro_Holguin_Plan_de_Negocios.pdf           (plan en CUP)
//   · Centro_Holguin_Plan_de_Negocios.docx           (Word, CUP)
//   · Centro_Holguin_Libro_con_formulas.xlsx         (Excel con fórmulas)
//
// Uso: bun run scripts/exportar_informe_brechas.ts
// ============================================================================

import { writeFileSync } from 'node:fs';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { computeProject } from '../src/lib/planex/engine/engine';
import { crearProyectoHolguin } from '../src/lib/planex/templates/holguin';
import { exportarPDF } from '../src/lib/planex/io/pdf';
import { exportarDOCX } from '../src/lib/planex/io/docx';
import { exportarXLSX } from '../src/lib/planex/io/xlsx';
import { componerInformeBrechas } from '../src/lib/planex/io/informe-brechas';

const dirDocs = join(process.cwd(), 'docs', 'expediente-holguin');
mkdirSync(dirDocs, { recursive: true });

const grab = (datos: ArrayBuffer | Uint8Array, nombre: string) => {
  const buf = datos instanceof Uint8Array ? Buffer.from(datos) : Buffer.from(new Uint8Array(datos));
  writeFileSync(join(dirDocs, nombre), buf);
  console.log(`OK ${nombre} (${(buf.length / 1024).toFixed(1)} KiB)`);
};

// ---------------------------------------------------------------- informe de brechas
console.log('Generando el informe de brechas documentales…');
const informe = componerInformeBrechas();
grab(informe.datos, informe.nombre);
console.log(`  Informe: ${informe.nombre}`);

// ---------------------------------------------------------------- plan del proyecto
console.log('\nExportando el plan del Centro Estomatológico Internacional Holguín…');
const proyecto = crearProyectoHolguin();
const modelo = computeProject(proyecto);

const pdf = exportarPDF(proyecto, modelo, { moneda: 'CUP' });
grab(await pdf.datos.arrayBuffer(), 'Centro_Holguin_Plan_de_Negocios.pdf');

const docx = await exportarDOCX(proyecto, modelo, { moneda: 'CUP' });
grab(await docx.datos.arrayBuffer(), 'Centro_Holguin_Plan_de_Negocios.docx');

const xlsx = await exportarXLSX(proyecto, modelo);
grab(xlsx.datos, 'Centro_Holguin_Libro_con_formulas.xlsx');

// ---------------------------------------------------------------- cifras de control
console.log('\nCifras de control del modelo Holguín (recalculadas por el motor):');
const k = (x: number) => x.toLocaleString('es-ES', { maximumFractionDigits: 2 });
const tasa = proyecto.parametros.find((p) => p.id === 'tipo_cambio')?.valor ?? 120;
console.log(`  Inversión total:        ${k(modelo.indicadores.inversionTotalKUSD)} kUSD (= ${k(modelo.indicadores.inversionTotalKUSD * tasa)} kCUP a ${tasa})`);
console.log(`  Aportaciones:           ${k(modelo.indicadores.aportacionesTotalesKUSD)} kUSD (= ${k(modelo.indicadores.aportacionesTotalesKUSD * tasa)} kCUP)`);
console.log(`  Ingresos año 1:         ${k(modelo.indicadores.ingresosTotales[1] ?? 0)} kUSD (documentado: 115,814 kUSD = 13 897,68 kCUP)`);
console.log(`  Utilidad neta año 1:    ${k(modelo.indicadores.utilidadNeta[1] ?? 0)} kUSD (negativa: bloqueo de tasas C-01 visible en el modelo)`);
console.log(`  Recuperación proyecto:  ${modelo.indicadores.recuperacionProyecto.anios === null ? 'no recuperada en el horizonte' : `${k(modelo.indicadores.recuperacionProyecto.anios)} años`}`);
console.log(`  Trabajadores:           ${modelo.indicadores.totalTrabajadores} (documentado: 10)`);
console.log(`  Issues del diagnóstico: ${modelo.issues.length} (errores: ${modelo.issues.filter((i) => i.tipo === 'error').length}, pendientes: ${modelo.issues.filter((i) => i.tipo === 'pendiente').length})`);
console.log('\nNOTA: los indicadores del expediente (VAN 24 709,58 / TIR 1387,85 % / 0,84 años del resumen; VAN 20 771,60 / TIR 904,02 % / 0,92 del anexo) NO se adoptan: dependen de la tasa 24 (contradicción C-01) y de una depreciación mal cargada (C-06).');
