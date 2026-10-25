# PLANEX-DOC-001 — Diagnóstico, arquitectura y decisiones técnicas

> **Misión**: motor documental unificado, previsualización fiel, exportación
> PDF/DOCX y moneda de presentación. Rama de trabajo:
> `doc/planex-doc-001` (sin merge hasta autorización del propietario).
> Base: commit `92555f7` (main, tras el PR #2 de AUDIT-001).

---

## 1. Diagnóstico de la implementación existente (misión §2)

### 1.1 Qué se encontró (verificado en el repositorio)

| # | Hallazgo | Evidencia | Causa |
|---|----------|-----------|-------|
| D1 | La previsualización era una **aproximación HTML** independiente del PDF: sin paginación, sin numeración y con textos que podían divergir del exportador | `preview.tsx` (DocumentoPlan) renderizaba tarjetas `Hoja` mientras `io/pdf.ts` componía el documento con jsPDF | Dos implementaciones de la presentación (HTML y PDF) alimentadas por separado del motor |
| D2 | **No existía exportador DOCX** ni biblioteca de Word | `package.json` (solo jsPDF, xlsx-js-style, jszip) y `src/lib/planex/io/` (jsonio, pdf, persistence, xlsx) | La exportación original cubría PDF/XLSX/JSON |
| D3 | **No existía visor de PDF** ni biblioteca equivalente | Sin dependencia `pdfjs-dist`; la vista `#/preview` no mostraba el PDF real | La vista documental se diseñó como HTML en la enmienda anterior |
| D4 | **Sin selector de moneda de presentación**: todos los importes documentales salían en kUSD (unidad nativa del motor) y los salarios en CUP | `io/pdf.ts` con literales «miles de USD»/«kUSD» incrustados; `Ajustes` solo tenía `horizonteAnios` | La GOC publica en miles de USD y no se había requerido presentación en CUP |
| D5 | **Defecto de navegación reproducido**: «Previsualizar plan» desde el editor llamaba `navegar('/preview')` sin `?plan=`, y la vista redirigía a `/proyectos` por no tener identificador | `PlanexApp.tsx:374` + guardia de `VistaPreviaDoc` (`if (!planRuta) navegar('/proyectos')`) | El parámetro de URL se introdujo para compartir enlaces y el menú no se actualizó |
| D6 | Los textos analíticos incrustaban cifras con `fmtK` y unidades kUSD fijas (57 usos en `analisis.ts`, 8 en `controles.ts`) | `engine/analisis.ts` | El narrador dinámico se creó en AUDIT-001 antes de existir moneda de presentación |
| D7 | El workflow `deploy.yml` mostraba un filtro aparentemente corrupto (`branches: ain]`) | Verificación byte a byte: **artefacto de lectura del entorno** (el filtro de salida elimina la secuencia `[m`); el archivo real contiene `branches: [main]` y los despliegues disparaban correctamente | Sanitización de escapes ANSI en las herramientas de la sesión |
| D8 | El `tipo_cambio` ya existía como **parámetro Nivel A** (400 CUP/USD, fecha 2026-10-01, fuente documentada, editable) y el motor ya convertía CUP→USD una sola vez | `templates/reglas.ts` (`tipo_cambio`), reglas `inversion_fija_cup_k` y `costo_laboral_k` | Diseño correcto de AUDIT-001 reutilizable como fuente única de la tasa |

### 1.2 Solución seleccionada (misión §3)

**Modelo documental canónico único** (`src/lib/planex/doc/`):

- `modelo.ts` — tipos del documento: portada, secciones (4.1–4.12,
  diagnóstico, notas), elementos (párrafo, campos, subtítulo, tabla,
  análisis, aviso) y tablas con alineaciones/anchura.
- `construir.ts` — `construirDocumentoPlanex(proyecto, modelo, {moneda})`
  produce la **única** representación del contenido.
- `moneda.ts` — contexto de conversión leído del parámetro `tipo_cambio`.

**Tres consumidores, un modelo** (misión §3.2):

| Representación | Implementación | Fidelidad |
|---|---|---|
| Visor integrado | pdf.js v6 (worker propio bajo `/pdfjs/`) mostrando **los mismos bytes** que descarga el usuario | Idéntica por construcción (mismo ArrayBuffer) |
| PDF | `io/pdf.ts` (jsPDF + autoTable) renderiza el modelo; portada, índice de doble pasada con numeración real, encabezados de sección, pies numerados, encabezados de tabla repetidos | Documento de referencia |
| DOCX | `io/docx.ts` (biblioteca `docx` v9) renderiza el mismo modelo: estilos Word, TOC actualizable (`TOC \h \o "1-1"` + `updateFields`), tablas editables con `tblHeader`/`cantSplit`, pie «Página X de Y», y **orientación apaisada solo en las secciones de tablas financieras anchas** | Alta fidelidad estructural; paginación propia de Word (declara la misión) |

El documento HTML aproximado (`preview.tsx`) se **retiró** por innecesario
(la misión exige mostrar el PDF real, no una aproximación) — sustitución
justificada en D1/D3 y confirmada por el criterio de aceptación 2.

**Bibliotecas añadidas** (una por problema, sin duplicar visores):
`pdfjs-dist@6.4.299` (visor; worker copiado por `prebuild`:
`scripts/copiar-worker-pdfjs.mjs` → `public/pdfjs/`, con prueba de
sincronía de versiones) y `docx@9.14.0` (Word nativo). `fflate` solo como
dependencia de pruebas (inspección ZIP).

## 2. Moneda de presentación (misión §5)

- **Fuente de la tasa**: el parámetro existente `tipo_cambio` (CUP por USD)
  con su `fechaRef` y `fuente`; ninguna tasa nueva.
- **Conversión única desde el origen**: `kUSD → kCUP = ×tasa`;
  `CUP completos → kUSD = /tasa/1000`; filas de inversión convertidas desde
  la moneda de la propia fila (`montoFilaAK`). Redondeo SOLO al formatear.
- **No se convierten**: porcentajes, cantidades, plantilla, horas, vidas
  útiles, períodos, y el propio tipo de cambio. Verificado por pruebas.
- **Salarios**: permanecen en **CUP** (la metodología 4.9 lo exige);
  cuando la presentación es USD se añade la columna «Equivalente anual
  (USD)» con la tasa documentada (trazabilidad de origen, misión §5.2.6).
- **Persistencia**: `ajustes.monedaPresentacion` se guarda **por plan**
  (sección `meta` de la sincronización) — sin migración de base de datos —
  de modo que ambos colaboradores ven y exportan la misma moneda
  (decisión documentada; la alternativa por-usuario se descartó por poder
  alterar la exportación de un colaborador desde la preferencia del otro).
  Retrocompatible: los planes previos se interpretan como USD.
- **Huellas independientes de la moneda**: los análisis editados por el
  usuario no quedan «desactualizados» al cambiar la moneda (las huellas se
  computan sobre valores de origen) — probado explícitamente.
- **Nota documental**: cada documento incluye tasa, fecha y fuente, y el
  supuesto de demostración se declara cuando corresponde (§5.2.10).

## 3. Visor integrado (misión §4)

Vista propia `#/preview?plan=` (sin modales) con barra integrada:
anterior/siguiente, ir a página con total, zoom ±/ajustar ancho/ajustar
página con porcentaje, búsqueda con contador y resaltados, pantalla
completa, descarga (bytes idénticos), Word, Excel y **selector USD/CUP**.
Estados: generación en curso, actualizado (con hora), «cambios sin
regenerar» con acción manual, y errores. Regeneración por huella del
proyecto con retardo de 700 ms (sin regenerar por cada pulsación).

## 4. Seguridad y colaboración (misión §11)

Sin cambios en el esquema, RLS ni flujos de autenticación. La generación
es 100 % cliente con la clave publicable; ninguna credencial nueva. La
exportación confirma lo pendiente y advierte de conflictos antes de
descargar. Las pruebas E2E se ejecutaron con Supabase real (login del
colaborador 1, plan compartido) y los planes de prueba se eliminaron
tras la verificación (entrega prístina: 0 planes).

## 5. Archivos modificados y añadidos

**Añadidos**: `doc/moneda.ts`, `doc/modelo.ts`, `doc/construir.ts`,
`io/docx.ts`, `components/planex/VisorPdf.tsx`,
`scripts/copiar-worker-pdfjs.mjs`, `public/pdfjs/*`,
`tests/planex/doc_moneda.test.ts`, `tests/planex/docx.test.ts`,
`tests/planex/doc_multipagina.test.ts`, `e2e/doc.mjs`,
`e2e/REPORTE-E2E-DOC.txt`, este documento y `docs/DOC001_EVIDENCIAS.md`.

**Modificados**: `types.ts` (MonedaPresentacion + Ajustes),
`model/factory.ts`, `store.ts` (setMonedaPresentacion),
`engine/analisis.ts` (contexto de presentación, retrocompatible),
`model/controles.ts` (ídem), `io/pdf.ts` (renderer del modelo),
`VistaPreviaDoc.tsx` (visor integrado), `PlanexApp.tsx` (fix D5 + Word),
`package.json` (docx, pdfjs-dist, fflate, prebuild), `eslint.config.mjs`
(ignora `public/`), `README.md`.

**Retirados**: `components/planex/preview.tsx` (aproximación HTML).

## 6. Limitaciones reales

1. La paginación de Word difiere de la del PDF (motores de composición
   distintos, como anticipa la misión §3.2); el contenido y la estructura
   sí son idénticos y verificables.
2. La búsqueda del visor opera sobre los runs de texto de pdf.js: frases
   partidas entre celdas de tablas distintas pueden requerir buscar por
   palabras más cortas.
3. El índice de Word es un campo TOC que el procesador actualiza al abrir
   (Word/LibreOffice lo preguntarán o recalcularán con F9): sin
   actualización de campos, el índice aparece vacío por diseño de OOXML.
4. La tasa de cambio sigue siendo un supuesto de demostración (400) que
   debe validarse antes del uso oficial — heredado y documentado.
5. El impuesto (35 %) y las cifras de las plantillas siguen siendo
   supuestos demostrativos con su advertencia visible en los documentos.
