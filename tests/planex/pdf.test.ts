// ============================================================================
// Pruebas del exportador PDF (misión §7): documento multipágina, texto
// seleccionable, advertencia de datos ficticios y coherencia con el motor.
// ============================================================================
import { describe, test, expect } from 'bun:test';
import { computeProject } from '../../src/lib/planex/engine/engine';
import { crearProyectoClinica } from '../../src/lib/planex/templates/clinica';
import { exportarPDF } from '../../src/lib/planex/io/pdf';
import { writeFileSync } from 'node:fs';

const proyecto = crearProyectoClinica();
const modelo = computeProject(proyecto);
const { datos, nombre } = exportarPDF(proyecto, modelo);
const buf = Buffer.from(await datos.arrayBuffer());
writeFileSync(new URL('./salida-clinica.pdf', import.meta.url).pathname, buf);

function textoPDF(b: Buffer): string {
  // jsPDF escribe streams sin comprimir con compress:false → texto legible en ()Tj
  const s = b.toString('latin1');
  const partes: string[] = [];
  for (const m of s.matchAll(/\((.*?)\) Tj/g)) partes.push(m[1]);
  return partes.join(' ').replace(/\\(\(|\))/g, (x) => x.slice(1));
}

describe('PDF — documento exportable', () => {
  test('genera un PDF válido de varias páginas', () => {
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    const paginas = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(paginas).toBeGreaterThan(10);
  });

  test('contiene el título del proyecto y la metodología (texto seleccionable)', () => {
    const t = textoPDF(buf);
    expect(t).toContain('PLAN DE NEGOCIOS');
    expect(t).toContain('Clínica Estomatológica');
    expect(t).toContain('GOC-2026-O57');
  });

  test('incluye el índice con numeración y las secciones 4.1–4.12', () => {
    const t = textoPDF(buf);
    for (const s of ['4.1', '4.4', '4.5', '4.6', '4.7', '4.8', '4.9', '4.10', '4.11', '4.12', 'Índice']) {
      expect(t).toContain(s);
    }
  });

  test('incluye la advertencia de datos ficticios (plantilla demo)', () => {
    const t = textoPDF(buf);
    expect(t).toContain('EJEMPLO ILUSTRATIVO CON DATOS FICTICIOS');
  });

  test('contiene las cifras clave del modelo activo (impuesto y recuperación)', () => {
    const t = textoPDF(buf);
    // Impuesto año 1 = 129,2 kUSD (35 % de 369,2)
    expect(t).toContain('129,2');
    // Inversión total 1 480,0 (el separador de miles depende del ICU del runtime)
    expect(/1\.?480,0/.test(t)).toBe(true);
    expect(t).toContain('35,0 %');
  });

  test('los pies de página numeran las páginas', () => {
    const t = textoPDF(buf);
    expect(t).toContain('Página 2 de');
    expect(t).toContain('PLANEX Cuba');
  });

  test('el nombre del archivo es razonable', () => {
    expect(nombre.endsWith('.pdf')).toBe(true);
    expect(nombre.length).toBeGreaterThan(5);
  });
});
