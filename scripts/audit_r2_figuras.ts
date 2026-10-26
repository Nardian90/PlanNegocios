// ============================================================================
// PLANEX-DOC-002-R2 §4 — Regeneración de la evidencia del gráfico acumulado.
//
// Regenera la captura de la Figura 3 (flujos acumulados FCFF/FCFE con cruce
// de cero) para que muestre la versión REAL con etiquetas numéricas en el eje
// Y y marcas de año en el eje X (DOC-002-R1 §7). La captura anterior se
// conserva en el repositorio renombrada como «antes-de-etiquetas» (evidencia
// del estado previo, claramente identificada).
//
// La captura usa el MISMO rasterizador PNG que incrusta el Word (figuras.ts):
// no hay una vía distinta de renderizado para la evidencia y el documento.
// ============================================================================
import { writeFileSync } from 'fs';
import { computeProject } from '../src/lib/planex/engine/engine';
import { crearProyectoClinica } from '../src/lib/planex/templates/clinica';
import { generarFiguras, rasterizarPNG } from '../src/lib/planex/doc/figuras';

const p = crearProyectoClinica();
const m = computeProject(p);

for (const [moneda, tasa] of [['CUP', 743], ['USD', 1]] as const) {
  const conv = {
    kUSDaK: (k: number) => k * tasa,
    unidadTabla: moneda === 'CUP' ? 'Miles de CUP (kCUP)' : 'Miles de USD (kUSD)',
    unidadCorta: moneda === 'CUP' ? 'kCUP' : 'kUSD',
  };
  const figuras = generarFiguras(p, m, conv);
  const flujos = figuras.find((f) => f.clave === 'flujos');
  if (!flujos) throw new Error('Figura de flujos no encontrada');
  // Escala 2 (1280×640): etiquetas legibles para la evidencia.
  const { png, ancho, alto } = rasterizarPNG(flujos, { ancho: 1280, alto: 640, escala: 2 });
  if (moneda === 'CUP') {
    writeFileSync('docs/capturas/doc002-figura-flujos-cruce-cero.png', png);
    console.log(`Captura CUP regenerada: ${ancho}x${alto} px, ${png.length} bytes`);
    console.log('  marcasY:', flujos.marcasY.map((x) => x.etiqueta).join(' | '));
    console.log('  marcasX:', flujos.marcasX.map((x) => x.etiqueta).join(' '));
  } else {
    writeFileSync('/tmp/doc002-figura-flujos-usd-r2.png', png);
    console.log(`Captura USD de control: ${ancho}x${alto} px, ${png.length} bytes`);
    console.log('  marcasY (USD):', flujos.marcasY.map((x) => x.etiqueta).join(' | '));
  }
}
