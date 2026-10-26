# PLANEX-DOC-003 — Informe del rediseño editorial del PDF

**Rama:** `doc/planex-doc-003-editorial-pdf` (desde `main` = `4931350`, PR #7
fusionado). **No se fusiona, no se despliega:** la decisión queda reservada al
propietario del repositorio.

**Caso de regresión:** «Clínica Estomatológica Sonrisa Habana», tasa
ilustrativa 743 CUP/USD, mismos supuestos de la rama. El motor financiero NO
se modificó: los cálculos y cifras son idénticos a los del modelo activo.

---

## 1. Diagnóstico de causas raíz (antes de tocar código)

Medición de línea base con PyMuPDF sobre los PDF entonces vigentes
(`doc003/antes/`, evidencia «antes» etiquetada):

| Defecto declarado | Causa raíz verificada |
|---|---|
| Párrafos «no se ven justificados» aunque el código lo declare | `parrafo()` dividía con `splitTextToSize()` y llamaba `doc.text(linea, …, { align: 'justify' })` **línea a línea**; cada línea pre-cortada es para jsPDF la última de su bloque ⇒ el justificado nunca se aplicaba. Medición: bordes derechos de líneas intermedias de un mismo párrafo dispersos hasta **51 pt** (518,9–557,9) frente al margen de 555,6 pt. |
| Páginas con una cuarta parte de contenido y una página vacía | (a) `paginaNueva: true` por defecto en todas las secciones; (b) tras cada grupo apaisado, `addPage(portrait)` **incondicional** aunque no hubiera contenido que continuar; (c) secciones con encabezado + 1 párrafo dejaban la vertical anterior casi vacía. Línea base CUP: **37 páginas, 21 por debajo del 35 % de ocupación, una página totalmente vacía (pág. 27, 0 %)**. |
| Tablas «excesivamente cuadriculadas, compactas y poco profesionales» | `theme: 'grid'` con bordes en TODAS las celdas, cabecera azul oscuro con blanco, y fuentes de 6–7 pt universales. |
| Cambios vertical/apaisado con espacios vacíos | El grupo apaisado consumía también las tablas estrechas contiguas y siempre añadía una vertical detrás; el título de sección se redibujaba fijo por sección en lugar de fluir. |
| Alineación por posición, no por contenido | `halign: i === 0 ? 'left' : 'right'` ignoraba `TablaDoc.alineaciones` y alineaba a la derecha columnas «Estado», «Fuente», «Detalle». |

## 2. Cambios realizados

### 2.1 Nuevo compositor con conocimiento de página (`io/pdf.ts`, reescritura)

- **P0-1 Justificación real:** renderizador de párrafo que corta por palabras
  con las métricas reales de la fuente y **reparte el espacio sobrante entre
  palabras** de cada línea intermedia. Última línea natural. Tope editorial
  contra huecos exagerados. **Párrafos que cruzan saltos de página quedan
  justificados a ambos lados del corte.** Control de huérfanas de 1–2 palabras
  por recomposición de ancho objetivo.
- **P0-2 Paginación:** capítulos que fluyen (abren página solo sin arranque
  digno), títulos pegados a su contenido (keep-with-next), bloques de
  análisis/campos/figuras con reglas de mantener-juntos, **grupos apaisados
  sin páginas verticales vacías detrás** (la página posterior se abre solo si
  hay contenido), sección dominada por tabla ancha compone su título junto a
  la tabla, encabezado de ejecución documental en TODAS las páginas (título de
  sección = contenido, no encabezado fijo), índice con numeración real (doble
  pasada) y salto de página tras el índice.
- **P0-3 Tablas:** estilo corporativo sin rejilla (filetes horizontales
  selectivos), cabecera con relleno suave, subtotales/totales en negrita con
  filete superior (`TablaDoc.resaltar`), notas APA al pie (`TablaDoc.nota`),
  cebra solo en tablas largas, **autoajuste de fuente con suelos 8,5/7,5 pt
  (vertical) y 8/7 pt (apaisada)** — prohibido el 6 pt universal —, anchos por
  medición real (cifras jamás comprimidas, prosa jamás partida,
  identificadores largos pueden partirse solo con muchas columnas), y
  **alineación por contenido de columna** respetando `TablaDoc.alineaciones`.
- **Criterio de apaisado por CONTENIDO** (`requiereApaisada`), compartido por
  PDF y DOCX: apaisado solo si la tabla ancha no cabe en vertical ni con todo
  el repertorio de ajuste. En USD (cifras kUSD compactas) el informe fluye
  íntegro en vertical; en CUP las proyecciones multianuales van a bloque
  apaisado.
- **Diagnóstico de composición exportable** (`exportarPDFConDiagnostico`,
  `componerDesdeModelo`): posiciones reales de línea (justificado), ocupación
  por página, fuentes y alineaciones de cada tabla — base de las pruebas y de
  la auditoría de densidad.

### 2.2 Modelo documental (`doc/modelo.ts`, `doc/construir.ts`)

- `TablaDoc.resaltar?: number[]` (filas de subtotal/total) y `TablaDoc.nota?:`
  string (nota APA). Marcadas: inversión total, fuentes de financiación,
  subtotales del estado de resultados (`negrita` ya existente), TOTAL fuerza de
  trabajo, TOTAL por canal, totales de beneficios al país, filas clave de la
  conciliación del arranque, FCFF/FCFE. Notas añadidas a las tablas donde
  aclaran moneda, supuesto o lectura.
- Política de paginación: `paginaNueva` por defecto **false** (los capítulos
  fluyen; el compositor decide). Sin cambios en el motor financiero.

### 2.3 DOCX coherente (`io/docx.ts`)

- Tablas con el mismo lenguaje visual: filetes horizontales selectivos, sin
  rejilla vertical, cabecera `EEF2F7` con texto oscuro, filas `resaltar` en
  negrita con filete superior, cierre inferior de última fila, notas APA al
  pie, alineación por contenido de columna (misma regla del 80 %),
  `tableHeader` y `cantSplit` conservados, cuerpos 8,5 pt vertical / 7,5 pt
  apaisada (antes 6,5 pt). Párrafos justificados (ya existente) verificados.
  El mismo criterio de orientación apaisada por contenido.

## 3. Informe de densidad de páginas (§4.4) — CUP

Línea base → resultado (misma plantilla, misma moneda, mismas cifras):

| Métrica | Antes | Después |
|---|---|---|
| Páginas (CUP / USD) | 37 / 37 | **32 / 30** |
| Páginas con ocupación del cuerpo < 35 % | 21 | **0** (sin contar excepciones) |
| Páginas vacías | 1 (pág. 27, 0 %) | **0** |
| Justificado medido (líneas intermedias al margen ±2,5 pt) | dispersión hasta 51 pt | **198/198 (100 %)** CUP |
| Fuente mínima de tabla | 6 pt | 7,5 pt vertical / 7 pt apaisada |

Ocupación por página del cuerpo (CUP, tras el rediseño): la mayoría entre 60
y 100 %. Excepciones por debajo del 35–50 % con razón editorial verificable:

| Página | Ocupación | Razón verificable |
|---|---|---|
| 1 | ~46 % | Portada (excepción declarada). |
| 2 | ~39 % | Índice (excepción declarada). |
| 6 | ~47 % | Cierre de 4.5 + arranque de 4.6 con bloque de campos mantenido entero (evita el remanente huérfano de 3 campos). |
| 15 | ~40 % | Bloque apaisado con la tabla central de flujos (4.7.1); aislamiento de orientación intencional; la figura que sigue no cabe y va a vertical. |
| 17 | ~38 % | Cola de la tabla de dividendos (encabezado repetido) + reglas del módulo. |

En USD no hay ninguna página del cuerpo por debajo del 35 % salvo la cola
final (pág. 30, ~38 %). La auditoría automatizada de estas reglas vive en
`tests/planex/doc003.test.ts` (falla si aparece una página sin contenido o una
página de baja ocupación sin razón de la lista anterior).

## 4. Verificación visual ejecutada (§8)

- **Renderizado de TODAS las páginas** de ambos PDF (CUP: 32, USD: 30) con
  `pdftoppm` a 100 dpi + hojas de contacto completas
  (`docs/capturas/doc003-hoja-contacto-*.png`).
- **Inspección visual con modelo de visión** (GLM-5V) de: la hoja de contacto
  completa CUP, la hoja de contacto completa USD y las páginas individuales 3,
  6, 12, 13, 14, 15, 16, 17, 19, 22, 26 y 30 del CUP (párrafos largos, tablas,
  cambios de orientación, figuras, colas de tabla). Conclusiones: sin texto
  superpuesto ni recortado; tablas dentro de márgenes y legibles; estilo
  corporativo con filetes horizontales confirmado; totales en negrita con
  filete superior confirmados en la proyección; encabezados repetidos en
  tablas partida; figuras con ejes numéricos, leyenda y nota. Observaciones
  menores: la portada deja aire inferior (excepción declarada) y en la figura
  de utilización de recursos el área de trazado es modesta frente a leyenda
  (limitación heredada del tamaño fijo de figura, ver §6).
- **Comparación explícita antes/después** (evidencia en
  `docs/capturas/doc003-antes-*.png` / `doc003-despues-*.png`): rejilla
  completa → filetes horizontales; 6 pt → cuerpos ≥ 7,5 pt con aire; bloques de
  párrafos con bordes derechos rectos medidos.
- Nota de método: en una pasada el modelo de visión opinó desde miniaturas
  que los párrafos nuevos eran «serrados»; la **medición objetiva** (PyMuPDF,
  198/198 líneas intermedias al margen) y la revisión individual de páginas la
  contradicen: las miniaturas a baja resolución no distinguen desvíos de
  0,5 mm. La evidencia válida del justificado es la medición posicional.

## 5. Comprobaciones realmente ejecutadas

| Comprobación | Resultado |
|---|---|
| `bun test tests/planex/` (suite completa, 19 archivos) | **374 pass / 0 fail** (7 143 aserciones), incl. la nueva `doc003.test.ts` (23 pruebas) |
| `tsc --noEmit` | 0 errores |
| `eslint .` | 0 problemas |
| Exportación de regresión (PDF/DOCX/XLSX, CUP y USD) | OK; cifras de control idénticas (719.075,4 kCUP = 967,8 kUSD; inversión 1.099.640 kCUP = 1.480,0 kUSD; recuperaciones 3,46 / 3,22 años) |
| Pruebas de exportación PDF/DOCX/Excel | OK (incluidas en la suite: `pdf.test.ts`, `docx.test.ts`, `xlsx.test.ts`, `doc_multipagina.test.ts`) |
| Extracción de texto y conciliación de cifras | OK (pruebas §8 de `doc003.test.ts`: 719.075,4 / 1.099.640 / 967,8 / 1.480,0 presentes en PDF y Word; numeración Tabla 1–30 y Figura 1–3) |
| Medición del justificado (PyMuPDF, PDF final) | CUP 29/29 y USD 31/31 párrafos multilínea con borde derecho común ≤ 2,5 pt; 198/198 líneas intermedias al margen; 0 desbordes; últimas líneas naturales |
| Renderizado de todas las páginas + hoja de contacto | OK (evidencias en `docs/capturas/`) |
| Inspección visual (visión) de páginas clave y hojas de contacto | OK (§4) |
| Auditoría de densidad automatizada (área por página) | `doc003/antes` vs `doc003/despues` + JSON de auditoría adjuntos al informe |
| Vista previa documental de la aplicación | Sin cambios de API (`exportarPDF` mantiene firma; `VistaPreviaDoc` y `PlanexApp` consumen la misma función) |

Pendiente de ejecutar en el entorno del propietario: `next build` de
producción se ejecutó en este entorno (`bun run build`, ver registro en el PR)
— cualquier despliegue queda fuera del alcance y de la autorización de esta
misión.

## 6. Limitaciones declaradas

1. **El índice no computa saltos de tabla dentro de la página de inicio de una
   sección** (la doble pasada registra la página de arranque del título; si el
   título abre apaisado, apunta a la página apaisada). Correcto en todos los
   casos medidos.
2. **La portada conserva aire inferior** por diseño (excepción declarada en la
   guía); no se rellenó artificialmente.
3. **El tamaño de las figuras es fijo** (76 mm de alto): en la figura de
   utilización de recursos el área de trazado es modesta frente a la leyenda.
   Rediseñar las figuras queda fuera del alcance P0 de esta misión (§9 de
   DOC-002 las regeneró con ejes etiquetados; se conservan).
4. **El tope editorial del justificado** puede dejar una línea concreta sin
   llegar al margen derecho cuando estirarla crearía huecos exagerados (caso
   raro: líneas con palabras muy largas). Es una decisión deliberada, no un
   fallo.
5. **PDF y Word difieren en paginación** (motores de composición distintos):
   permitido por la misión §7; los datos, textos, tablas, notas y cifras
   coinciden.
6. El análisis visual con modelo de visión se realizó sobre renderizados a
   100 dpi y hojas de contacto; los matices submilimétricos del justificado se
   validaron por medición posicional, no por ojo.

## 7. Entregables

- Código: `src/lib/planex/io/pdf.ts` (compositor editorial),
  `src/lib/planex/io/docx.ts`, `src/lib/planex/doc/modelo.ts`,
  `src/lib/planex/doc/construir.ts`.
- Pruebas: `tests/planex/doc003.test.ts` (23 pruebas: justificado medido,
  cruce de páginas, huérfanas, densidad con excepciones verificables, suelo
  tipográfico, alineación por contenido, `alineaciones` explícitas, tablas
  sintéticas con negativos/cifras grandes/unidades, integridad CUP/USD,
  coherencia Word).
- Documentación: `docs/DOC003_GUIA_EDITORIAL.md` (guía adoptada),
  `docs/DOC003_INFORME.md` (este informe).
- Evidencias: `docs/capturas/doc003-antes-*.png` (línea base, etiquetadas
  «antes») y `doc003-despues-*.png` (regeneradas de los PDF actuales),
  hojas de contacto de los 32+30 páginas.
- Regresión regenerada: `docs/ejemplos/Ejemplo_Clinica_Plan_de_Negocios.pdf`
  (32 págs.) y `_USD.pdf` (30 págs.), Word CUP/USD y libro Excel.
