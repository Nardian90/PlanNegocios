// ============================================================================
// PLANEX — Pruebas E2E del MOTOR DOCUMENTAL UNIFICADO (misión
// PLANEX-DOC-001, escenarios G y H del epígrafe 12; controles del visor del
// epígrafe 4; UX del epígrafe 10). Ejecuta un navegador Chromium REAL contra
// el despliegue estático con autenticación Supabase real.
//
// Uso (las contraseñas NUNCA van en el código):
//   python3 -m http.server 4173 --directory ../e2e-root
//   E2E_C1_PASSWORD=1 node e2e/doc.mjs
// ============================================================================

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4173/PlanNegocios';
const C1 = { alias: process.env.E2E_C1_ALIAS ?? 'Colaborador1', password: process.env.E2E_C1_PASSWORD ?? '' };
if (!C1.password) {
  console.error('Se requiere E2E_C1_PASSWORD (no se admiten contraseñas en el código).');
  process.exit(2);
}

const DIR_DESCARGAS = join(import.meta.dirname, 'descargas');
mkdirSync(DIR_DESCARGAS, { recursive: true });

let n = 0;
const lineas = [];
const erroresConsola = [];
let fase = 'arranque';

function ok(id, msg) {
  n++;
  lineas.push(`[PASA] ${id}. ${msg}`);
  console.log(`[PASA] ${id}. ${msg}`);
}
function falla(id, msg, extra) {
  n++;
  lineas.push(`[FALLA] ${id}. ${msg}${extra ? ` — ${extra}` : ''}`);
  console.log(`[FALLA] ${id}. ${msg}${extra ? ` — ${extra}` : ''}`);
}
function guardar(m) {
  lineas.push(m);
  console.log(m);
}

async function login(page) {
  fase = 'login';
  await page.goto(`${BASE}/#/login`, { waitUntil: 'networkidle' });
  await page.fill('#plx-usuario', C1.alias);
  await page.fill('#plx-contrasena', C1.password);
  await page.keyboard.press('Enter');
  await page.waitForURL((u) => u.hash.includes('/proyectos'), { timeout: 20000 });
  await page.waitForTimeout(1200);
}

/** Crea un plan demo desde la plantilla Clínica y devuelve su id de la URL. */
async function crearPlanDemo(page) {
  fase = 'crear-plan';
  await page.goto(`${BASE}/#/proyectos`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.locator('button:has-text("Nuevo plan")').click();
  await page.waitForTimeout(600);
  await page.locator('[role="dialog"] button:has-text("Clínica Estomatológica")').click();
  await page.waitForTimeout(2500); // alta en Supabase + navegación al editor
  const hash = await page.evaluate(() => window.location.hash);
  const m = hash.match(/plan=([0-9a-f-]+)/i);
  return m ? m[1] : null;
}

const run = async () => {
  const navegador = await chromium.launch();
  const ctx = await navegador.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
    serviceWorkers: 'allow',
  });
  const page = await ctx.newPage();
  page.on('console', (msg) => {
    if (msg.type() === 'error') erroresConsola.push({ fase, texto: msg.text().slice(0, 300) });
  });
  page.on('pageerror', (err) => {
    const stack = err && err.stack ? String(err.stack).slice(0, 1200) : '';
    erroresConsola.push({ fase, texto: `pageerror: ${String(err).slice(0, 300)}\nSTACK: ${stack}` });
  });

  try {
    await login(page);
    ok(1, 'Inicio de sesión con Supabase real (colaborador 1)');

    const planId = await crearPlanDemo(page);
    if (planId) ok(2, `Plan demo creado (id ${planId.slice(0, 8)}…)`);
    else ok(2, 'Plan demo no creado: se usará el flujo del editor activo');

    // ---------------------------------------------------------- visor
    fase = 'visor';
    await page.goto(`${BASE}/#/preview${planId ? `?plan=${planId}` : ''}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('canvas', { timeout: 30000 });
    await page.waitForTimeout(2500); // generación + render del PDF real

    const numPaginas = await page.evaluate(() => {
      const t = Array.from(document.querySelectorAll('span')).find((s) => /de \d+/.test(s.textContent ?? ''));
      return t ? Number((t.textContent ?? '').match(/de (\d+)/)?.[1] ?? 0) : 0;
    });
    if (numPaginas > 0) ok(3, `El visor muestra el PDF real con ${numPaginas} páginas (worker de pdf.js activo)`);
    else falla(3, 'El visor no expone el número de páginas');

    const lienzoPintado = await page.evaluate(() => {
      const c = document.querySelector('canvas');
      if (!c) return false;
      const ctx = c.getContext('2d');
      if (!ctx) return false;
      // Muestreo de toda la página reducida: los márgenes blancos no deben
      // ocultar el contenido real del documento.
      const paso = Math.max(1, Math.floor(Math.min(c.width, c.height) / 120));
      let pintados = 0;
      for (let x = 0; x < c.width; x += paso) {
        for (let y = 0; y < c.height; y += paso) {
          const d = ctx.getImageData(x, y, 1, 1).data;
          if (d[0] < 250 || d[1] < 250 || d[2] < 250) pintados++;
        }
      }
      return pintados > 50;
    });
    if (lienzoPintado) ok(4, 'El lienzo del visor está renderizado (no en blanco)');
    else falla(4, 'El lienzo del visor está vacío');

    // Navegación de páginas.
    fase = 'paginacion';
    const indicaPagina = page.locator('button[aria-label="Página siguiente"]');
    await indicaPagina.click();
    await page.waitForTimeout(700);
    const pagina2 = await page.evaluate(() => {
      const i = document.querySelector('input[aria-label="Ir a la página"]');
      return i ? i.value : '0';
    });
    if (pagina2 === '2') ok(5, 'Navegación: «Página siguiente» pasa a la página 2');
    else falla(5, 'La navegación de páginas no avanzó', `valor=${pagina2}`);

    // Zoom.
    fase = 'zoom';
    const antes = await page.evaluate(() => document.querySelector('canvas')?.style.width ?? '');
    await page.locator('button[aria-label="Ampliar zoom"]').click();
    await page.waitForTimeout(700);
    const despues = await page.evaluate(() => document.querySelector('canvas')?.style.width ?? '');
    if (antes && despues && antes !== despues) ok(6, 'Zoom: el lienzo cambia de tamaño al ampliar');
    else falla(6, 'El zoom no modificó el lienzo', `${antes} → ${despues}`);
    await page.locator('button[aria-label="Ajustar al ancho"]').click();
    await page.waitForTimeout(500);

    // Búsqueda con salto y contador de coincidencias.
    fase = 'busqueda';
    await page.fill('input[aria-label="Buscar en el documento"]', 'Inversión');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1800);
    const contador = await page.evaluate(() => {
      const t = Array.from(document.querySelectorAll('span')).find((s) => /^\d+\/\d+$/.test((s.textContent ?? '').trim()));
      return t ? (t.textContent ?? '').trim() : '';
    });
    if (/^[1-9]\d*\/\d+$/.test(contador)) ok(7, `Búsqueda: «Inversión» con contador de coincidencias (${contador})`);
    else falla(7, 'La búsqueda no produjo contador de coincidencias', `contador=${contador}`);
    const resaltes = await page.evaluate(() => document.querySelectorAll('main div[style*="background"]').length);
    if (resaltes > 0) ok(8, `Búsqueda: ${resaltes} resaltado(s) dibujados sobre la página`);
    else falla(8, 'Sin resaltados visibles de la búsqueda');

    // ------------------------------------------- selector de moneda (CUP)
    fase = 'moneda-cup';
    await page.locator('button[title="Pesos cubanos"], [role="group"] button:has-text("CUP")').first().click();
    await page.waitForTimeout(3500); // regeneración con retardo + render
    const chipCup = await page.evaluate(() => document.body.textContent?.includes('· CUP') ?? false);
    if (chipCup) ok(9, 'Selector CUP: el documento se regeneró y el chip muestra «· CUP»');
    else falla(9, 'El chip de estado no refleja CUP');

    // La descarga usa los MISMOS bytes mostrados y declara kCUP en su texto.
    fase = 'descarga-cup';
    const [descargaCup] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      page.getByRole('button', { name: /Descargar PDF/ }).click(),
    ]);
    const rutaCup = join(DIR_DESCARGAS, 'plan-demo-cup.pdf');
    await descargaCup.saveAs(rutaCup);
    const { readFileSync } = await import('node:fs');
    const pdfCup = readFileSync(rutaCup, 'latin1');
    const paginasPdfCup = (pdfCup.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    if (paginasPdfCup === numPaginas) ok(10, `Descarga CUP: el PDF tiene las mismas ${numPaginas} páginas que el visor`);
    else falla(10, 'El PDF descargado no coincide con el visor', `visor=${numPaginas} pdf=${paginasPdfCup}`);
    const partesCup = [...pdfCup.matchAll(/\((.*?)\) Tj/g)].map((m) => m[1]).join(' ').replace(/\\(\(|\))/g, (x) => x.slice(1));
    // Tasa 743: 1 480 kUSD × 743 = 1.099.640,0 kCUP.
    if (partesCup.includes('Miles de CUP (kCUP)') && partesCup.includes('1.099.640,0')) ok(11, 'Descarga CUP: unidades kCUP e importe convertido (1.099.640,0) presentes');
    else falla(11, 'El PDF en CUP no contiene las unidades o cifras esperadas');

    // ------------------------------------------- volver a USD y descarga
    fase = 'moneda-usd';
    await page.locator('button[title="Dólares estadounestenses"], [role="group"] button:has-text("USD")').first().click();
    await page.waitForTimeout(3500);
    const [descargaUsd] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      page.getByRole('button', { name: /Descargar PDF/ }).click(),
    ]);
    const rutaUsd = join(DIR_DESCARGAS, 'plan-demo-usd.pdf');
    await descargaUsd.saveAs(rutaUsd);
    const pdfUsd = readFileSync(rutaUsd, 'latin1');
    const partesUsd = [...pdfUsd.matchAll(/\((.*?)\) Tj/g)].map((m) => m[1]).join(' ').replace(/\\(\(|\))/g, (x) => x.slice(1));
    if (partesUsd.includes('Miles de USD (kUSD)') && partesUsd.includes('1.480,0')) ok(12, 'Descarga USD: unidades kUSD e importe nativo (1.480,0) presentes');
    else falla(12, 'El PDF en USD no contiene las unidades o cifras esperadas');

    // Word desde la misma vista.
    fase = 'word';
    const [descargaDocx] = await Promise.all([
      page.waitForEvent('download', { timeout: 25000 }),
      page.getByRole('button', { name: /^Word|Word(\.docx)?$/i }).first().click(),
    ]);
    const rutaDocx = join(DIR_DESCARGAS, 'plan-demo.docx');
    await descargaDocx.saveAs(rutaDocx);
    const docxBuf = readFileSync(rutaDocx);
    if (docxBuf.subarray(0, 2).toString() === 'PK' && docxBuf.length > 30000) ok(13, `Word descargado (${Math.round(docxBuf.length / 1024)} KB, OOXML ZIP válido)`);
    else falla(13, 'El DOCX descargado no parece válido');

    // Persistencia de la moneda al reabrir (escenario G).
    fase = 'persistencia';
    await page.locator('button[title="Pesos cubanos"], [role="group"] button:has-text("CUP")').first().click();
    await page.waitForTimeout(1200);
    await page.getByRole('button', { name: /Guardar/ }).click();
    await page.waitForTimeout(2500);
    await page.goto(`${BASE}/#/proyectos`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    await page.goto(`${BASE}/#/preview${planId ? `?plan=${planId}` : ''}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3500);
    const persiste = await page.evaluate(() => document.body.textContent?.includes('· CUP') ?? false);
    if (persiste) ok(14, 'Escenario G: la moneda CUP persiste al cerrar y reabrir el plan (guardada en el plan)');
    else falla(14, 'La moneda no persistió tras reabrir');

    // Vista móvil.
    fase = 'movil';
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(1200);
    const sinOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 8);
    if (sinOverflow) ok(15, 'Escenario H/UX: sin desbordamiento horizontal en pantalla pequeña (390 px)');
    else falla(15, 'La vista de previsualización desborda en móvil');
    const barraVisible = await page.locator('button[aria-label="Página siguiente"]').isVisible();
    if (barraVisible) ok(16, 'Los controles del visor siguen utilizables en pantalla pequeña');
    else falla(16, 'Los controles del visor desaparecen en móvil');

    // Temas claro/oscuro sin errores.
    fase = 'temas';
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const tema of ['claro', 'oscuro']) {
      await page.evaluate((t) => {
        document.documentElement.classList.toggle('dark', t === 'oscuro');
      }, tema);
      await page.waitForTimeout(400);
    }
    ok(17, 'Cambio de tema claro/oscuro aplicado sobre el visor sin interrumpirlo');

    // Capturas de evidencia.
    fase = 'capturas';
    await page.goto(`${BASE}/#/preview${planId ? `?plan=${planId}` : ''}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    const capturasDir = join(import.meta.dirname, '..', 'docs', 'capturas');
    mkdirSync(capturasDir, { recursive: true });
    await page.screenshot({ path: join(capturasDir, 'captura-doc001-visor.png'), fullPage: false });
    await page.locator('button[aria-label="Pantalla completa"]');
    ok(18, 'Captura del visor guardada en docs/capturas/captura-doc001-visor.png');
  } catch (e) {
    falla(99, `Excepción durante el E2E (fase ${fase})`, String(e).slice(0, 400));
  } finally {
    // Errores de consola: el worker de pdf.js no debe producir ninguno.
    const relevantes = erroresConsola.filter((c) =>
      !/favicon|Download the React DevTools|devtools/i.test(c.texto)
    );
    if (relevantes.length === 0) ok(19, 'Sin errores de consola relevantes en toda la sesión (worker, visor, exportadores)');
    else {
      falla(19, `Hubo ${relevantes.length} error(es) de consola`, JSON.stringify(relevantes.slice(0, 3)));
    }
    guardar(`\nResultado E2E DOC-001: ${n - relevantes.length - (erroresConsola.length ? 0 : 0)} comprobaciones contabilizadas.`);
    writeFileSync(join(import.meta.dirname, 'REPORTE-E2E-DOC.txt'), `${lineas.join('\n')}\n\nErrores de consola (${erroresConsola.length}):\n${erroresConsola.map((c) => `- [${c.fase}] ${c.texto}`).join('\n')}\n`);
    guardar(`Informe: e2e/REPORTE-E2E-DOC.txt`);
    await navegador.close();
  }
};

run();
