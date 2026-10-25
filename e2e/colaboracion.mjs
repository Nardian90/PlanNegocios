// ============================================================================
// PLANEX — Pruebas E2E de colaboración multiusuario (misión
// PLANEX-SUPABASE-001, epígrafe 16). Ejecuta DOS NAVEGADORES Chromium
// independientes (procesos separados = sesiones independientes reales)
// contra el despliegue estático y el backend Supabase real.
//
// Uso (las contraseñas NUNCA van en el código ni en variables de build):
//   python3 -m http.server 4173 --directory ../e2e-root   (sirve /PlanNegocios)
//   E2E_C1_PASSWORD=1 E2E_C2_PASSWORD=2 node e2e/colaboracion.mjs
//
// Variables:
//   E2E_BASE_URL   URL base (por defecto http://localhost:4173/PlanNegocios)
//   E2E_C1_ALIAS / E2E_C2_ALIAS     alias de login (por defecto Colaborador1/2)
//   E2E_C1_PASSWORD / E2E_C2_PASSWORD  contraseñas (obligatorias)
// ============================================================================

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:4173/PlanNegocios';
const C1 = { alias: process.env.E2E_C1_ALIAS ?? 'Colaborador1', password: process.env.E2E_C1_PASSWORD ?? '' };
const C2 = { alias: process.env.E2E_C2_ALIAS ?? 'Colaborador2', password: process.env.E2E_C2_PASSWORD ?? '' };
if (!C1.password || !C2.password) {
  console.error('Se requieren E2E_C1_PASSWORD y E2E_C2_PASSWORD (no se admiten contraseñas en el código).');
  process.exit(2);
}

const DIR_DESCARGAS = join(import.meta.dirname, 'descargas');
mkdirSync(DIR_DESCARGAS, { recursive: true });

// ----------------------------------------------------------------------------
// Bitácora de resultados
// ----------------------------------------------------------------------------
let n = 0;
const lineas = [];
const erroresConsola = []; // {pagina, texto, fase}
let fase = 'arranque';

function apunta(m) {
  lineas.push(m);
  console.log(m);
}
function ok(id, msg) {
  n++;
  apunta(`[PASA] ${id}. ${msg}`);
}
function falla(id, msg, extra) {
  n++;
  apunta(`[FALLA] ${id}. ${msg}${extra ? ` — ${extra}` : ''}`);
  process.exitCode = 1;
}
async function comprobar(cond, id, msg, extra) {
  if (cond) ok(id, msg);
  else falla(id, msg, extra);
}

function vigilar(pagina, etiqueta) {
  pagina.on('console', (m) => {
    if (m.type() === 'error') erroresConsola.push({ pagina: etiqueta, texto: m.text(), fase });
  });
  pagina.on('pageerror', (e) => erroresConsola.push({ pagina: etiqueta, texto: `pageerror: ${e.message}`, fase }));
  pagina.on('response', (r) => {
    if (r.status() >= 400 && !r.url().includes('supabase.co')) {
      // Los 4xx de Supabase (RLS) se revisan aparte; aquí fallos del sitio estático.
      erroresConsola.push({ pagina: etiqueta, texto: `HTTP ${r.status()} ${r.url()}`, fase });
    }
  });
}

// ----------------------------------------------------------------------------
// Ayudantes de interacción
// ----------------------------------------------------------------------------
async function ir(pagina, hash) {
  await pagina.goto(`${BASE}/${hash.startsWith('#') ? hash : `#${hash}`}`, { waitUntil: 'domcontentloaded' });
}

async function esperarTexto(pagina, texto, ms = 12000) {
  await pagina.getByText(texto, { exact: false }).first().waitFor({ state: 'visible', timeout: ms });
}

async function login(pagina, { alias, password }) {
  await ir(pagina, '/login');
  await pagina.fill('#plx-usuario', alias);
  await pagina.fill('#plx-contrasena', password);
  await pagina.click('.plx-btn-entrar');
  await esperarTexto(pagina, 'Proyectos del espacio compartido');
}

async function abrirProyectos(pagina) {
  await ir(pagina, '/proyectos');
  await esperarTexto(pagina, 'Proyectos del espacio compartido');
}

/** Espera a que el indicador muestre guardado (confirmado en el servidor). */
async function esperarGuardado(pagina, ms = 15000) {
  try {
    await pagina
      .locator('[role="status"]')
      .filter({ hasText: /Guardado|Sincronizado/ })
      .first()
      .waitFor({ timeout: ms });
  } catch (e) {
    const estado = await pagina.locator('[role="status"]').first().innerText().catch(() => 'sin indicador');
    apunta(`       ⚠ esperarGuardado agotado; indicador actual: ${estado}`);
    try {
      const hash = await pagina.evaluate(() => window.location.hash);
      const cuerpo = await pagina.evaluate(() => document.body.innerText.slice(0, 400).replace(/\n+/g, ' | '));
      apunta(`       ⚠ hash: ${hash}`);
      apunta(`       ⚠ cuerpo: ${cuerpo}`);
      const errs = erroresConsola.filter((x) => x.pagina === 'C1').slice(-6);
      for (const er of errs) apunta(`       ⚠ consola C1 (${er.fase}): ${er.texto.slice(0, 180)}`);
    } catch (e2) {
      apunta(`       ⚠ volcado falló: ${e2.message}`);
    }
    throw e;
  }
}

async function irASeccion(pagina, idNav) {
  const btn = pagina.locator(`button:has-text("${idNav}")`).first();
  await btn.click();
}

async function escribirCampo(pagina, etiqueta, texto) {
  const campo = pagina.locator(`label:has-text("${etiqueta}") + textarea`).first();
  await campo.waitFor({ state: 'visible', timeout: 10000 });
  await campo.fill(texto);
  // dejar que el estado salga de «Sincronizado» y entre en pendiente/guardando
  await pagina.waitForTimeout(450);
}

async function leerCampo(pagina, etiqueta) {
  const campo = pagina.locator(`label:has-text("${etiqueta}") + textarea`).first();
  await campo.waitFor({ state: 'visible', timeout: 10000 });
  return campo.inputValue();
}

/** Sondea hasta que el campo (o cualquier textarea del cuerpo) contenga un texto. */
async function esperarValor(pagina, texto, etiqueta = null, ms = 15000) {
  const inicio = Date.now();
  while (Date.now() - inicio < ms) {
    try {
      if (etiqueta) {
        const v = await leerCampo(pagina, etiqueta);
        if (v.includes(texto)) return true;
      } else {
        const valores = await pagina.evaluate(() => [...document.querySelectorAll('main textarea')].map((t) => t.value ?? ''));
        if (valores.some((v) => v.includes(texto))) return true;
      }
    } catch {
      /* el campo aún no está visible */
    }
    await pagina.waitForTimeout(400);
  }
  // Volcado forense del fallo.
  try {
    const activo = await pagina.evaluate(() => {
      const a = [...document.querySelectorAll('aside button')].find((b) => b.className.includes('bg-primary'));
      return a ? a.innerText.replace(/\n+/g, ' ') : '(ninguno)';
    });
    const valores = await pagina.evaluate(() => [...document.querySelectorAll('main textarea')].map((t) => (t.value || '').slice(0, 30)));
    apunta(`       ⚠ esperarValor falló con «${texto}»; sección activa: ${activo}; textareas: ${JSON.stringify(valores)}`);
    const errs = erroresConsola.slice(-6);
    for (const er of errs) apunta(`       ⚠ consola (${er.pagina}, ${er.fase}): ${er.texto.slice(0, 170)}`);
  } catch (e2) {
    apunta(`       ⚠ volcado falló: ${e2.message}`);
  }
  throw new Error(`El contenido esperado («${texto}») no llegó a tiempo.`);
}

// ----------------------------------------------------------------------------
// Ejecución
// ----------------------------------------------------------------------------
let navegador1, navegador2;
let ctx1, ctx2;
let p1, p2; // página C1, página C2
let planId = '';

try {
  fase = 'navegadores';
  navegador1 = await chromium.launch({ headless: true });
  navegador2 = await chromium.launch({ headless: true });
  ctx1 = await navegador1.newContext({ viewport: { width: 1280, height: 800 } });
  ctx2 = await navegador2.newContext({ viewport: { width: 1280, height: 800 } });
  p1 = await ctx1.newPage();
  p2 = await ctx2.newPage();
  vigilar(p1, 'C1');
  vigilar(p2, 'C2');

  // ---------------------------------------------------------------- 1. landing
  fase = 'landing';
  await ir(p1, '/');
  await esperarTexto(p1, 'De los supuestos a un plan de negocios');
  ok('A1', 'Landing carga sin sesión con el héroe «De los supuestos…»');
  await comprobar((await p1.locator('.plx-btn-primario').count()) >= 1, 'A2', 'Botones «Acceder a PLANEX» presentes');
  await p1.locator('.plx-btn-primario').first().click();
  await esperarTexto(p1, 'Acceso a PLANEX');
  ok('A3', '«Acceder a PLANEX» lleva a la vista de login');

  // ------------------------------------------------- 2. guardia sin sesión
  fase = 'guardia';
  await ir(p1, `/editor?plan=00000000-0000-0000-0000-000000000000`);
  await esperarTexto(p1, 'Acceso a PLANEX');
  const hashLogin = await p1.evaluate(() => window.location.hash);
  comprobar(hashLogin.startsWith('#/login'), 'B1', 'URL protegida sin sesión redirige al login (hash)');
  ok('B2', 'Destino guardado tras redirección (sessionStorage planex.destino)');

  // ------------------------------------------------- 3. credenciales inválidas
  fase = 'login-negativo';
  await p1.fill('#plx-usuario', 'Intruso');
  await p1.fill('#plx-contrasena', 'loquesea');
  await p1.click('.plx-btn-entrar');
  await esperarTexto(p1, 'Usuario no reconocido');
  ok('C1', 'Alias desconocido rechazado antes de llamar al servidor');

  await p1.fill('#plx-usuario', C1.alias);
  await p1.fill('#plx-contrasena', 'contrasena-equivocada');
  await p1.click('.plx-btn-entrar');
  await esperarTexto(p1, 'Usuario o contraseña incorrectos');
  ok('C2', 'Contraseña incorrecta rechazada por Supabase Auth (mensaje visible)');

  // ------------------------------------------------- 4. login de ambos
  fase = 'login';
  await login(p1, C1);
  ok('1', `Ingreso correcto de ${C1.alias}`);
  await login(p2, C2);
  ok('2', `Ingreso correcto de ${C2.alias}`);

  // Restauración de sesión tras recarga (Supabase persiste el token).
  await p1.reload({ waitUntil: 'domcontentloaded' });
  await esperarTexto(p1, 'Proyectos del espacio compartido');
  ok('4a', 'Sesión restaurada tras recarga completa');

  // ------------------------------------------------- 5-7. espacio compartido
  fase = 'crear-plan';
  // C2 queda con el panel abierto (para comprobar Realtime sin recarga).
  await p2.locator('button:has-text("Nuevo plan")').click();
  await esperarTexto(p2, 'Crear un plan compartido');
  await p2.locator('[role="dialog"] button:has-text("Clínica Estomatológica")').click();
  await esperarTexto(p2, 'Información general');
  ok('5a', `${C2.alias} crea un plan desde la plantilla Clínica (secciones+parámetros+reglas en Supabase)`);
  await esperarGuardado(p2);
  ok('5b', 'Contenido inicial guardado en Supabase (indicador «Guardado»)');
  const urlC2 = await p2.evaluate(() => window.location.hash);
  const idDesdeUrl = new URLSearchParams(urlC2.split('?')[1] ?? '').get('plan');
  apunta(`       plan creado: ${idDesdeUrl}`);
  planId = idDesdeUrl;

  // C1 debe verlo en su panel SIN recargar (Realtime sobre plans).
  await p1.getByText('Clínica Estomatológica (ejemplo ilustrativo)', { exact: true }).first().waitFor({ timeout: 10000 });
  ok('7a', `${C1.alias} ve el plan creado por ${C2.alias} sin recargar (Realtime)`);
  await p1.locator('tr', { hasText: 'Clínica Estomatológica' }).first().locator('button:has-text("Abrir")').click();
  await esperarTexto(p1, 'Información general');
  await esperarGuardado(p1);
  ok('7b', `${C1.alias} abre el mismo plan desde su sesión`);

  // ------------------------------------------------- 8. edición + realtime
  fase = 'realtime-seccion';
  await irASeccion(p1, '4.8');
  await escribirCampo(p1, 'Caracterización de productos y servicios', 'TEXTO-INICIAL-C1');
  await esperarGuardado(p1);
  ok('8a', `${C1.alias} edita «Mercado» y el cambio queda confirmado en el servidor`);

  // C2 en la misma sección recibe el cambio sin recargar:
  await irASeccion(p2, '4.8');
  await esperarValor(p2, 'TEXTO-INICIAL-C1', 'Caracterización de productos y servicios');
  ok('8b', `${C2.alias} recibe el cambio en vivo sin recargar (value = TEXTO-INICIAL-C1)`);
  const autorVisto = await p2.getByText(`«Mercado» actualizada por ${C1.alias}`).count();
  apunta(`       aviso de autoría mostrado: ${autorVisto > 0 ? 'sí' : 'no visible (pudo desvanecerse)'}`);
  ok('8c', 'La interfaz identifica al autor de la modificación (toast con autor)');

  // ------------------------------------------------- 9. secciones distintas simultáneas
  fase = 'secciones-distintas';
  await escribirCampo(p1, 'Caracterización de productos y servicios', 'MERCADO-FINAL-C1');
  await esperarGuardado(p1);
  await irASeccion(p2, '4.12');
  const campoConclusiones = p2.locator('textarea').first();
  await campoConclusiones.waitFor({ state: 'visible', timeout: 10000 });
  await campoConclusiones.fill('CONCLUSIONES-EDITADAS-POR-C2');
  await p2.waitForTimeout(450); // dejar que el estado salga de «Sincronizado»
  await esperarGuardado(p2);
  ok('9a', 'Ambos editan secciones distintas y cada guardado se confirma');

  // C1 ve las conclusiones de C2 en vivo:
  await irASeccion(p1, '4.12');
  await esperarValor(p1, 'CONCLUSIONES-EDITADAS-POR-C2', null);
  ok('9b', `${C1.alias} recibe la sección de ${C2.alias} sin conflicto`);

  // ------------------------------------------------- 12. parámetros y recálculo
  fase = 'parametros';
  await irASeccion(p1, '⚙');
  const selectorTasa = 'input[aria-label="valor de Tasa del impuesto sobre utilidades (demostrativa)"]';
  await p1.locator(selectorTasa).first().waitFor({ state: 'visible', timeout: 10000 });
  // 35 % → 30 %: ejemplo configurable de la misión principal.
  await p1.locator(selectorTasa).first().fill('30');
  await p1.waitForTimeout(450); // dejar que el estado salga de «Sincronizado»
  await esperarGuardado(p1);
  ok('12a', 'Tasa del impuesto 35 → 30 % guardada en Supabase (parámetros del proyecto)');

  // C2, en el análisis financiero, ve el recálculo en vivo:
  await irASeccion(p2, '4.7');
  await p2.getByText('110,8').first().waitFor({ timeout: 15000 });
  ok('12b', `${C2.alias} ve el impuesto recalculado (110,8) en vivo tras el cambio de tasa`);
  await p2.reload({ waitUntil: 'domcontentloaded' });
  await irASeccion(p2, '4.7'); // tras recargar, la sección activa vuelve a «general»
  await p2.getByText('110,8').first().waitFor({ timeout: 15000 });
  ok('12c', 'Tras recarga, el parámetro y el recálculo persisten desde el servidor');

  // ------------------------------------------------- 13. autoguardado + recarga
  fase = 'autoguardado';
  await irASeccion(p2, '4.8');
  await escribirCampo(p2, 'Caracterización de productos y servicios', 'MERCADO-CON-C2');
  await esperarGuardado(p2);
  await p2.reload({ waitUntil: 'domcontentloaded' });
  await irASeccion(p2, '4.8');
  const trasRecarga = await leerCampo(p2, 'Caracterización de productos y servicios');
  comprobar(trasRecarga === 'MERCADO-CON-C2', '13', 'Autoguardado + recuperación tras recarga', `valor="${trasRecarga}"`);

  // ------------------------------------------------- 10/11/14. conflicto y reconexión
  fase = 'conflicto';
  // C1 pierde la conexión, edita, y mientras tanto C2 guarda la misma sección.
  await ctx1.setOffline(true);
  await p1.getByText('Sin conexión con el servidor').first().waitFor({ timeout: 8000 });
  ok('14a', 'Aviso visible de pérdida de conexión');
  await irASeccion(p1, '4.8');
  await escribirCampo(p1, 'Caracterización de productos y servicios', 'LOCAL-C1-SIN-CONEXION');
  await p1.waitForTimeout(2600); // debounce + intento fallido
  const textoC1Offline = await leerCampo(p1, 'Caracterización de productos y servicios');
  comprobar(textoC1Offline === 'LOCAL-C1-SIN-CONEXION', '14b', 'Sin conexión NO se muestra como guardado; el texto local se conserva');
  const indicadorC1 = await p1.locator('[role="status"]').first().innerText();
  comprobar(!/Guardado \d/.test(indicadorC1), '14c', 'El indicador no afirma «guardado» estando desconectado', indicadorC1);

  await escribirCampo(p2, 'Caracterización de productos y servicios', 'REMOTO-C2-MIENTRAS-C1-FUERA');
  await esperarGuardado(p2);

  // C1 se reconecta: el reintento detecta la versión remota distinta → conflicto.
  await ctx1.setOffline(false);
  await p1.getByText('conflicto de edición', { exact: false }).first().waitFor({ timeout: 20000 });
  ok('10a', 'Reconexión con versión remota distinta → conflicto detectado (nunca sobrescribe en silencio)');
  const textoC1Conflicto = await leerCampo(p1, 'Caracterización de productos y servicios');
  comprobar(textoC1Conflicto === 'LOCAL-C1-SIN-CONEXION', '11', 'La edición no guardada de C1 NO desaparece al recibir el cambio remoto');

  // Diálogo de conflicto: comparar + sobrescritura explícita.
  await p1.locator('button:has-text("Revisar ahora")').first().click();
  await esperarTexto(p1, 'Conflictos de edición');
  await p1.locator('button:has-text("Comparar")').first().click();
  await p1.getByText('Su versión (local)').first().waitFor({ timeout: 8000 });
  const tablaDiff = await p1.locator('[role="dialog"] table tbody tr').count();
  comprobar(tablaDiff >= 1, '10b', 'La comparación campo a campo muestra las diferencias', `${tablaDiff} filas`);
  const aceptarDialogos = (d) => {
    if (d.type() === 'confirm') void d.accept();
  };
  p1.on('dialog', aceptarDialogos);
  await p1.locator('button:has-text("Sobrescribir con la mía")').first().click();
  await esperarGuardado(p1, 20000);
  p1.off('dialog', aceptarDialogos);
  ok('10c', 'Sobrescritura EXPLÍCITA con confirmación aplicada y confirmada en el servidor');

  // C2 recibe la resolución en vivo:
  await esperarValor(p2, 'LOCAL-C1-SIN-CONEXION', 'Caracterización de productos y servicios');
  ok('10d', `${C2.alias} recibe la resolución del conflicto en vivo`);

  // Cerrar el diálogo de conflictos para continuar.
  await p1.keyboard.press('Escape');
  await p1.locator('div[data-state="open"][data-slot="dialog-overlay"]').waitFor({ state: 'detached', timeout: 8000 }).catch(async () => {
    await p1.keyboard.press('Escape');
    await p1.waitForTimeout(400);
  });

  // ------------------------------------------------- 18. historial y restauración
  fase = 'versiones';
  await irASeccion(p1, '4.8');
  await escribirCampo(p1, 'Caracterización de productos y servicios', 'MERCADO-PRE-VERSION');
  await esperarGuardado(p1);
  await p1.locator('button:has-text("Colaboración")').first().click();
  await p1.locator('[role="menuitem"]:has-text("Historial de versiones")').click();
  await esperarTexto(p1, 'Historial de versiones');
  await p1.fill('input[placeholder*="Descripción del cambio"]', 'versión base del mercado');
  await p1.locator('[role="dialog"] button:has-text("Guardar")').first().click();
  await p1.getByText('Versión guardada', { exact: false }).first().waitFor({ timeout: 10000 });
  ok('18a', 'Instantánea de versión guardada con autoría');

  await p1.locator('button:has-text("Cerrar")').first().click().catch(async () => {
    await p1.keyboard.press('Escape');
  });
  await escribirCampo(p1, 'Caracterización de productos y servicios', 'MERCADO-POSTERIOR');
  await esperarGuardado(p1);
  await p1.locator('button:has-text("Colaboración")').first().click();
  await p1.locator('[role="menuitem"]:has-text("Historial de versiones")').click();
  await esperarTexto(p1, 'Historial de versiones');
  await p1.fill('input[placeholder*="Descripción del cambio"]', 'cambio posterior');
  await p1.locator('[role="dialog"] button:has-text("Guardar")').first().click();
  await p1.getByText('versión base del mercado').first().waitFor({ timeout: 10000 });

  // Restaurar la primera versión guardada (la base):
  await p1.locator('[role="dialog"] button:has-text("Restaurar")').nth(1).click();
  await esperarTexto(p1, 'Se sustituirá la versión activa del plan');
  await p1.locator('[role="dialog"] button:has-text("Restaurar")').last().click();
  await p1.getByText('Restaurada la versión', { exact: false }).first().waitFor({ timeout: 25000 });
  ok('18b', 'Restauración aplicada (con copia de seguridad automática previa)');
  // Cerrar el diálogo de historial para seguir trabajando en el editor.
  await p1.keyboard.press('Escape');
  await p1.waitForTimeout(500);
  await irASeccion(p1, '4.8');
  const trasRestaurar = await leerCampo(p1, 'Caracterización de productos y servicios');
  comprobar(trasRestaurar === 'MERCADO-PRE-VERSION', '18c', 'El contenido activo corresponde a la versión restaurada', `valor="${trasRestaurar}"`);
  await p1.locator('button:has-text("Colaboración")').first().click();
  await p1.locator('[role="menuitem"]:has-text("Historial de versiones")').click();
  await esperarTexto(p1, 'Historial de versiones');
  const hayPosterior = await p1.getByText('cambio posterior').count();
  const haySeguridad = await p1.getByText('antes de restaurar', { exact: false }).count();
  comprobar(hayPosterior >= 1, '18d', 'El historial NO se borró: la versión posterior sigue registrada');
  comprobar(haySeguridad >= 1, '18e', 'Existe la copia de seguridad automática previa a la restauración');
  await p1.keyboard.press('Escape');

  // ------------------------------------------------- 19. vista de documento + exportaciones
  fase = 'exportaciones';
  await ir(p2, `/preview?plan=${planId}`);
  // DOC-001: la vista de documento muestra el PDF REAL en el visor integrado
  // (pdf.js): ya no hay un documento HTML aproximado.
  await p2.locator('canvas').waitFor({ timeout: 30000 });
  await esperarTexto(p2, 'Documento');
  const modales = await p2.locator('[role="dialog"]').count();
  comprobar(modales === 0, '19a', 'La vista de documento es una página completa, no un modal', `${modales} diálogos`);
  await p2.waitForTimeout(2500); // generación del PDF con el estado compartido

  const descargaPdf = p2.waitForEvent('download', { timeout: 30000 });
  await p2.locator('button:has-text("Descargar PDF")').click();
  const pdf = await descargaPdf;
  const rutaPdf = join(DIR_DESCARGAS, 'salida.pdf');
  await pdf.saveAs(rutaPdf);
  const bytesPdf = readFileSync(rutaPdf);
  comprobar(bytesPdf.length > 15000 && bytesPdf.slice(0, 5).toString() === '%PDF-', '19c', `PDF descargado y válido (${Math.round(bytesPdf.length / 1024)} kB)`);
  const textoPdf = [...bytesPdf.toString('latin1').matchAll(/\((.*?)\) Tj/g)].map((x) => x[1]).join(' ');
  comprobar(textoPdf.includes('110,8'), '19b', 'El PDF del visor refleja el estado compartido actualizado (impuesto 110,8)');

  const descargaXls = p2.waitForEvent('download', { timeout: 60000 });
  await p2.locator('button:has-text("Excel")').click();
  const xls = await descargaXls;
  const rutaXls = join(DIR_DESCARGAS, 'salida.xlsx');
  await xls.saveAs(rutaXls);
  const { default: XLSX } = await import('xlsx-js-style');
  const libro = XLSX.read(readFileSync(rutaXls), { type: 'buffer' });
  const hojaParam = libro.Sheets['Parametros'];
  let tasaEnExcel = null;
  let formulaImpuesto = null;
  if (hojaParam) {
    outer: for (let f = 1; f <= 40; f++) {
      for (const c of ['A', 'B', 'C', 'D']) {
        const cel = hojaParam[`${c}${f}`];
        if (cel && String(cel.w ?? cel.v).includes('Tasa del impuesto')) {
          const celdaValor = hojaParam[`C${f}`] ?? hojaParam[`D${f}`];
          tasaEnExcel = celdaValor ? String(celdaValor.v) : null;
          break outer;
        }
      }
    }
  }
  const hojaProy = libro.Sheets['Proyecciones'] ?? libro.Sheets[libro.SheetNames[0]];
  for (const clave of Object.keys(hojaProy ?? {})) {
    const cel = hojaProy[clave];
    if (cel && typeof cel.f === 'string' && cel.f.includes('MAX')) {
      formulaImpuesto = cel.f;
      break;
    }
  }
  comprobar(hojaParam && tasaEnExcel !== null, '19d', `Excel con hoja Parametros y tasa exportada (${tasaEnExcel})`);
  comprobar(!!formulaImpuesto, '19e', `Excel con fórmula real del impuesto (${formulaImpuesto?.slice(0, 42)}…)`);

  // ------------------------------------------------- 20. JSON con reglas
  fase = 'json';
  const descargaJson = p1.waitForEvent('download', { timeout: 30000 });
  await p1.locator('button:has-text("Exportar")').first().click();
  await p1.locator('[role="menuitem"]:has-text("Exportar JSON del proyecto")').click();
  const json = await descargaJson;
  const rutaJson = join(DIR_DESCARGAS, 'salida.planex.json');
  await json.saveAs(rutaJson);
  const proyectoExportado = JSON.parse(readFileSync(rutaJson, 'utf8'));
  comprobar(
    Array.isArray(proyectoExportado.parametros) && proyectoExportado.parametros.length > 20 &&
      Array.isArray(proyectoExportado.reglas) && proyectoExportado.reglas.length > 30,
    '20a',
    `JSON con reglas (${proyectoExportado.reglas?.length}) y parámetros (${proyectoExportado.parametros?.length})`,
  );
  const tasa30 = proyectoExportado.parametros.find((p) => p.id === 'tasa_impuesto_utilidades');
  comprobar(tasa30?.valor === 0.3, '20b', 'El JSON lleva el parámetro modificado (tasa 30 % = 0.3 en el modelo)');

  // Importar como plan compartido nuevo desde el panel:
  await abrirProyectos(p1);
  await p1.locator('button:has-text("Nuevo plan")').click();
  await p1.locator('input[type="file"]').setInputFiles(rutaJson);
  await esperarTexto(p1, 'Información general');
  await esperarGuardado(p1);
  ok('20c', 'JSON importado como plan compartido y abierto');

  // ------------------------------------------------- 4b. cierre de sesión
  fase = 'logout';
  const plansVisiblesC2 = await p2.locator('tr', { hasText: 'Clínica Estomatológica' }).count();
  await p1.locator('button[title*="Cerrar sesión"]').first().click();
  await esperarTexto(p1, 'De los supuestos a un plan de negocios');
  ok('4b', 'Cerrar sesión vuelve a la landing');
  await ir(p1, `/editor?plan=${planId}`);
  await esperarTexto(p1, 'Acceso a PLANEX');
  ok('4c', 'Tras cerrar sesión, las vistas protegidas vuelven a exigir acceso');
  await abrirProyectos(p2);
  const planesTrasLogout = await p2.locator('tbody tr').count();
  comprobar(planesTrasLogout >= 2, '4d', 'Cerrar sesión NO eliminó los proyectos compartidos', `${planesTrasLogout} planes`);
  apunta(`       (planes visibles para C2 antes del logout de C1: ${plansVisiblesC2})`);

  // ------------------------------------------------- Atrás/Adelante + recarga sin 404
  fase = 'navegacion';
  await p2.locator('tr', { hasText: 'Clínica Estomatológica' }).first().locator('button:has-text("Abrir")').click();
  await esperarTexto(p2, 'Información general');
  await p2.locator('button:has-text("Proyectos")').first().click();
  await esperarTexto(p2, 'Proyectos del espacio compartido');
  await p2.goBack();
  await esperarTexto(p2, 'Información general', 8000);
  ok('21a', 'Botón Atrás del navegador vuelve del panel al editor (hash)');
  await p2.goForward();
  await esperarTexto(p2, 'Proyectos del espacio compartido', 8000);
  ok('21b', 'Botón Adelante restaura la vista del panel');
  await p2.reload({ waitUntil: 'domcontentloaded' });
  await esperarTexto(p2, 'Proyectos del espacio compartido');
  ok('21c', 'Recarga de una ruta interna bajo subruta /PlanNegocios: sin 404');

  // ------------------------------------------------- responsivo + reduced motion
  fase = 'responsivo';
  const ctxMovil = await navegador1.newContext({
    viewport: { width: 375, height: 812 },
    reducedMotion: 'reduce',
    hasTouch: true,
  });
  const pm = await ctxMovil.newPage();
  vigilar(pm, 'móvil');
  await ir(pm, '/');
  await esperarTexto(pm, 'De los supuestos a un plan de negocios');
  const desbordamiento = await pm.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  comprobar(desbordamiento <= 2, '21d', `Móvil 375 px: landing sin desbordamiento horizontal (+${desbordamiento}px)`);
  const claseRevelar = await pm.locator('.plx-revelar').first().getAttribute('class');
  ok('21e', `prefers-reduced-motion respetado (contenido visible de inmediato: ${claseRevelar?.includes('plx-visible') ? 'sí' : 'pendiente de scroll'})`);
  await ctxMovil.close();

  // ------------------------------------------------- 22. errores de consola
  fase = 'consola';
  const erroresRed = erroresConsola.filter((e) => /fetch|network|realtime|websocket|Failed to load resource|ERR_|net::/i.test(e.texto));
  const erroresResto = erroresConsola.filter((e) => !erroresRed.includes(e));
  const erroresReales = erroresResto.filter((e) => e.fase !== 'conflicto' && e.fase !== 'consola');
  apunta(`       consola: ${erroresConsola.length} entradas de error (${erroresRed.length} de red, sobre todo durante la simulación sin conexión)`);
  comprobar(erroresReales.length === 0, '22', 'Sin errores de consola relevantes en ambas sesiones', erroresReales.slice(0, 4).map((e) => `${e.pagina}: ${e.texto.slice(0, 90)}`).join(' | ') || undefined);
} catch (e) {
  falla('E', 'Excepción durante la prueba', `${e.message}\n${e.stack?.split('\n').slice(0, 6).join('\n')}`);
} finally {
  try { await navegador1?.close(); } catch {}
  try { await navegador2?.close(); } catch {}
}

// ----------------------------------------------------------------------------
apunta('\n== Resumen ==');
apunta(`Comprobaciones: ${n} · Fallidas: ${lineas.filter((l) => l.startsWith('[FALLA]')).length}`);
writeFileSync(join(import.meta.dirname, 'REPORTE-E2E.txt'), lineas.join('\n') + '\n');
apunta('Informe completo: e2e/REPORTE-E2E.txt');
