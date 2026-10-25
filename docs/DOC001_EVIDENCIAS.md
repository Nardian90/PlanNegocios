# PLANEX-DOC-001 — Evidencias de las pruebas

> Todas las evidencias se ejecutaron sobre la rama `doc/planex-doc-001`
> contra el build estático servido bajo `/PlanNegocios/` (igual que
> producción) y con Supabase real. Ninguna cifra de este documento es
> una afirmación sin ejecución: cada prueba indica su archivo y salida.

## 1. Suite unitaria y de integración — `bun test tests/planex/`

**Resultado: 222/222 pruebas, 0 fallos, 3 107 aserciones, 14 archivos.**
- Regresión AUDIT-001 + original: **176/176** intactas (el contexto de
  presentación es opcional y reproduce la salida nativa; huellas sin cambios).
- Novedades DOC-001: **46 pruebas**:
  - `doc_moneda.test.ts` — 22: escenarios A (USD), B (CUP), C (cambio de
    tasa), integridad de datos originales, huellas independientes de la
    moneda, salarios en CUP con equivalente, nota documental de la tasa.
  - `docx.test.ts` — 16: DOCX válido (ZIP/OOXML, partes obligatorias),
    TOC actualizable + `updateFields`, pie «Página X de Y» (PAGE/NUMPAGES),
    `tblHeader`/`cantSplit`, orientación apaisada solo en tablas anchas,
    editable sin imágenes, estilos Word; **consistencia §8**: INVERSIÓN
    TOTAL idéntica en modelo/PDF/Word, todos los títulos de sección en
    ambas representaciones, 6 análisis idénticos, cifras clave idénticas
    en ambas monedas y representaciones, escenario D (sin valores
    desactualizados: 35,0 % → 30,0 %), unidades coherentes.
  - `doc_multipagina.test.ts` — 8: escenario E (documento de 21+ páginas,
    índice real, **cabeceras repetidas en tabla multipágina forzada con
    80 activos**, pies numerados, años extremos presentes), escenario F
    (insuficiencia de financiación visible en análisis + resumen +
    diagnóstico; demanda LIMITADA marcada) y sincronía del worker
    (`public/pdfjs` byte-idéntico a la versión instalada).

## 2. E2E de navegador — `node e2e/doc.mjs` (Chromium real)

**Resultado: 19/19 PASA, 0 errores de consola** (`e2e/REPORTE-E2E-DOC.txt`).
Ejecutado contra `http://localhost:4173/PlanNegocios` con login Supabase
real (Colaborador1) y plan creado en la base compartida:

| # | Comprobación |
|---|---|
| 1 | Login Supabase real |
| 2 | Plan demo creado (id b140bea5…) |
| 3 | Visor muestra el **PDF real** con 21 páginas — worker de pdf.js activo bajo el basePath |
| 4 | Lienzo renderizado (muestreo de píxeles, no en blanco) |
| 5 | Navegación: página siguiente → página 2 |
| 6 | Zoom: el lienzo cambia de tamaño |
| 7 | Búsqueda: «Inversión» → 53 coincidencias, contador 1/53 |
| 8 | 4 resaltados dibujados sobre la página |
| 9 | Selector CUP → regeneración y chip «· CUP» |
| 10 | **Descarga CUP: 21 páginas, las mismas que el visor** (bytes idénticos) |
| 11 | PDF CUP contiene «Miles de CUP (kCUP)» y 592.000,0 (= 1.480 × 400) |
| 12 | PDF USD contiene «Miles de USD (kUSD)» y 1.480,0 (nativo del motor) |
| 13 | Word descargado: 78 KB, OOXML ZIP válido |
| 14 | Escenario G: la moneda persiste al cerrar y reabrir el plan |
| 15 | Móvil (390 px): sin desbordamiento horizontal |
| 16 | Controles del visor utilizables en pantalla pequeña |
| 17 | Temas claro/oscuro sin interrumpir el visor |
| 18 | Captura: `docs/capturas/captura-doc001-visor.png` |
| 19 | **0 errores de consola** en toda la sesión (incluido el worker) |

## 3. Compilación y despliegue local (escenario H)

- `bunx tsc --noEmit`: sin errores en `src/` (solo el `toMatch` del shim de
  tipos de pruebas, preexistente en `audit_analisis.test.ts`).
- `bun run lint`: **0 errores** (se ignora `public/`, activo generado).
- `NEXT_PUBLIC_BASE_PATH=/PlanNegocios bun run build`: export estático OK;
  `out/pdfjs/pdf.worker.min.mjs` presente y servido (HTTP 200) bajo la
  subruta exacta de producción.
- Servido con `python3 -m http.server` en `/PlanNegocios`: el visor cargó
  el worker y el PDF sin errores de red.

## 4. Artefactos de demostración (misión §14.9)

Generados por las pruebas en ambas monedas (plantilla Clínica):
- `tests/planex/salida-clinica-usd.pdf` / `salida-clinica-cup.pdf` (21 páginas cada uno)
- `tests/planex/salida-clinica-usd.docx` / `salida-clinica-cup.docx` (OOXML editable)
- `e2e/descargas/plan-demo-usd.pdf`, `plan-demo-cup.pdf`, `plan-demo.docx`
  (descargas reales del navegador)
- Captura del visor: `docs/capturas/captura-doc001-visor.png`

## 5. Entrega prístina

Tras las pruebas, los planes de verificación se eliminaron de la base
compartida con `scripts/limpiar-planes-prueba.ts`:
`Planes eliminados: 5 · Planes después: 0 · Versiones huérfanas: 0`.
No se aplicaron migraciones de base de datos (la misión no las requiere:
la moneda de presentación vive en `ajustes`, dentro de la sección `meta`
ya sincronizada).
