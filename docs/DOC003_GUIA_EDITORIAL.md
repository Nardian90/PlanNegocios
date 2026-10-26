# Guía editorial interna del PDF — PLANEX Cuba (DOC-003)

Esta guía define el sistema visual y las reglas de composición de los informes
PDF generados por PLANEX. Es normativa para el compositor
(`src/lib/planex/io/pdf.ts`) y de referencia para el exportador DOCX. El estilo
es un **informe corporativo basado en criterios APA 7** para jerarquía,
numeración y notas de tablas y figuras; el texto justificado del cuerpo es una
**convención editorial propia de PLANEX**, no un requisito de APA 7 (que alinea
a la izquierda). El documento se declara como informe profesional; cuando los
datos y las validaciones del proyecto estén completos, podrá entregarse a
clientes e inversionistas.

## 1. Tipografías y cuerpos

| Uso | Fuente | Cuerpo | Color |
|---|---|---|---|
| Título de portada | helvetica bold | 20 pt | blanco sobre banda azul oscuro |
| Nombre del proyecto (portada) | helvetica bold | 15 pt | `#1E293B` |
| Título de capítulo (fluye) | helvetica bold | 13 pt | `#1E293B` + filete inferior |
| Subtítulo interno | helvetica bold | 10,5 pt | `#1E293B` + filete suave |
| Cuerpo narrativo | helvetica | 9 pt | `#334155` |
| Nota / texto pequeño | helvetica | 7,8 pt | `#334155` |
| Cuerpo de análisis | helvetica | 8 pt | `#334155` |
| Título de tabla / figura | helvetica bold | 9,5 pt | `#1E293B` |
| Cabecera de tabla | helvetica bold | = cuerpo de tabla | `#1E293B` sobre relleno `#EEF2F7` |
| Cuerpo de tabla (vertical) | helvetica | **8,5 pt objetivo, 7,5 pt mínimo** | `#334155` |
| Cuerpo de tabla (apaisada) | helvetica | **8 pt objetivo, 7 pt mínimo** | `#334155` |
| Nota al pie de tabla | helvetica italic | 7,2 pt | `#64748B` |
| Encabezado de ejecución | helvetica | 8 pt | título `#1E293B` + proyecto `#64748B` |
| Pie de página | helvetica | 7 pt | `#64748B` |

El interlineado del cuerpo es `tamaño × 0,5 mm` (ratio ≈ 1,42): cómodo y
estable, sin fabricar páginas adicionales.

## 2. Márgenes, área útil, encabezado y pie

- Margen lateral: **14 mm** en vertical y apaisada.
- Encabezado de ejecución: `PLAN DE NEGOCIOS` + nombre del proyecto, línea base
  a 11 mm, filete a 14,5 mm. El cuerpo arranca a **22 mm**. Es un encabezado
  de EJECUCIÓN documental: los títulos de sección fluyen como contenido y no
  se repiten como encabezado fijo.
- Pie: filete a 13 mm del borde inferior; marca `PLANEX Cuba — Plan de
  Negocios (GOC-2026-O57)`, numeración `Página X de Y` y, en demo, `EJEMPLO
  ILUSTRATIVO CON DATOS FICTICIOS`. Zona reservada: 18 mm.
- Cuerpo útil vertical: 22 → 279 mm (257 mm). Apaisada: 22 → 192 mm (170 mm).

## 3. Justificación de párrafos (P0-1)

- Se justifican **los párrafos narrativos y los análisis generados por el
  modelo**, incluidas las notas pequeñas del cuerpo.
- No se justifican: títulos, subtítulos, encabezados de tabla, etiquetas de
  campos, listas breves, celdas numéricas, notas al pie de tabla ni la
  portada.
- El compositor corta por palabras con las métricas reales de la fuente y
  **reparte el espacio sobrante entre palabras** de cada línea intermedia; la
  última línea conserva su longitud natural (alineada a la izquierda).
- Tope editorial: si el reparto exigiría más de ~1,9 espacios extra por hueco,
  la línea se deja alineada a la izquierda antes que crear huecos exagerados.
- **Cruce de páginas:** las líneas intermedias quedan justificadas a ambos
  lados del salto y el párrafo continúa en la página siguiente.
- Control de huérfanas: una última línea de 1–2 palabras se evita
  recomponiendo el párrafo con un ancho objetivo levemente menor (factores
  0,97…0,90) cuando el párrafo tiene 3+ líneas.
- Las palabras más anchas que la columna se parten por caracteres (caso raro,
  p. ej. identificadores largos).

## 4. Paginación y continuidad (P0-2)

- Portada: página propia. Índice: página propia (numeración real por doble
  pasada; el cuerpo abre en página nueva tras el índice).
- Los capítulos **fluyen**: solo abren página nueva cuando el espacio
  restante no admite un arranque digno (título + ~22 mm de contenido) o cuando
  la sección lo declara expresamente (`paginaNueva`).
- Los subtítulos y títulos de tabla/figura van **pegados a su contenido**
  (keep-with-next): nunca quedan solos al pie de página.
- Bloques de análisis: se mantienen enteros si caben; como mínimo, título +
  etiqueta + primeras líneas.
- Bloques de campos (`campos`): se mantienen enteros si no caben en lo que
  queda pero sí en una página (≤ 78 % del cuerpo); evita remanentes de 2–3
  campos huérfanos.
- Figuras: indivisibles; si no caben y caben en página nueva, se mueven enteras.
- **Grupos apaisados:** una tabla va a página apaisada SOLO si, marcada como
  ancha, no cabe en vertical aplicando todo el repertorio de ajuste (autoajuste
  de fuente + último recurso de comprimir solo columnas de texto). Es una
  decisión de CONTENIDO, no de conteo de columnas: en USD (cifras compactas)
  el informe completo fluye en vertical; en CUP las proyecciones multianuales
  van a bloque apaisado. El grupo absorbe tablas apaisadas consecutivas y los
  bloques livianos intermedios/finales que quepan. **Nunca** se añade una
  página vertical vacía de transición: la página posterior se abre solo si hay
  contenido que continuar. Si la sección está dominada por una tabla ancha, el
  título y su introducción breve se componen junto a la tabla en el bloque.
- Encabezados de tabla repetidos en cada página de tablas multipágina
  (`showHead: 'everyPage'`) y filas que no se parten (`rowPageBreak: 'avoid'`).

## 5. Tablas financieras (P0-3)

- **Estilo corporativo sin rejilla:** filetes horizontales selectivos — cierre
  superior y filete inferior de la cabecera, filete superior de cada fila de
  subtotal/total, cierre inferior de la última fila. Sin líneas verticales.
- Cabecera: relleno suave `#EEF2F7`, texto `#1E293B` en negrita. Contraste
  suficiente sin el azul oscuro de la rejilla anterior.
- Subtotales/totales (`TablaDoc.resaltar`): negrita + filete superior. Las
  filas de total nunca quedan aisladas del detalle que resumen (van pegadas al
  bloque; el corte multipágina conserva el encabezado).
- **Cifras alineadas a la derecha; conceptos a la izquierda.** La alineación
  se decide por el CONTENIDO de cada columna (≥ 80 % de celdas con aspecto
  numérico ⇒ derecha): una columna «Estado», «Fuente», «Unidad» u
  «Observación» no se alinea a la derecha por su posición. `TablaDoc.
  alineaciones`, cuando está declarada, tiene prioridad.
- Fondos alternos discretos (`#F6F8FB`) solo en tablas de más de 12 filas.
- **Suelos tipográficos:** vertical 8,5 pt objetivo / 7,5 pt mínimo; apaisada
  8 pt objetivo / **7 pt mínimo absoluto**. El 6 pt universal queda prohibido.
- Autoajuste: se mide cada columna con las métricas de la fuente activa; las
  columnas numéricas jamás se comprimen por debajo de su cifra más ancha; las
  de texto pueden envolver (y partir identificadores largos cuando hay muchas
  columnas) pero nunca partir palabras de prosa.
- Unidades visibles en el título (convención actual de `construir.ts`) y notas
  al pie de tabla (`TablaDoc.nota`, estilo APA: *Nota. …*).
- Numeración secuencial «Tabla N. / Figura N.» incorporada al título, igual
  en PDF, Word y visor.

## 6. Avisos, validaciones y estado de demostración

- Aviso de caja ámbar: fondo `#FFF3CD`, filete `#D97706`, texto 7,5 pt
  `#92400E`. Dimensionado al contenido: inequívoco pero proporción moderada —
  nunca desplaza bloques enteros para «ganar limpieza».
- Bloques de análisis: título ámbar + etiqueta de trazabilidad (generado /
  editado / desactualizado) + cuerpo justificado con filete lateral ámbar.
- Las advertencias financieras NO se ocultan para mejorar la estética.
- Estado demo: banda en portada + marca centrada en el pie de cada página.

## 7. Figuras

- Vectoriales, dibujadas desde los mismos datos del modelo; título APA,
  unidades, leyenda con muestras de color y nota. Indivisibles; se mueven
  enteras a página nueva si no caben.

## 8. Coherencia DOCX

- Mismos contenidos, cifras, tablas, notas y figuras (modelo canónico único).
- Párrafos justificados (`w:jc val="both"`), tablas con los mismos filetes y
  resaltes, cabecera `EEF2F7`, notas APA, encabezado repetido (`tableHeader`)
  y filas sin partir (`cantSplit`).
- PDF y Word pueden diferir en paginación; no en datos ni contenido. El
  criterio de orientación apaisada es EL MISMO (por contenido), con métricas
  aproximadas de Calibri.
- El texto jamás se rasteriza para imitar la paginación del PDF.

## 9. Excepciones de densidad admitidas (auditoría §4.4)

Pueden quedar por debajo del 35 % de ocupación del cuerpo, con razón
verificable: la **portada**, el **índice**, las páginas de **bloque apaisado**
aislado (la tabla ancha y su contexto) y la **cola final del documento**.
Cualquier otra página por debajo del umbral es un defecto de paginación y debe
revisarse. La auditoría automatizada vive en `DiagnosticoComposicion` y en
`tests/planex/doc003.test.ts`.

---

# Adenda DOC-003-R1 — Reglas de colisión y cierre editorial

## Campos etiquetados (4.1, 4.2, 4.8)

- La etiqueta (9 pt negrita) y su valor (8,7 pt) viven en líneas base
  SEPARADAS 4,4 mm, derivadas de las métricas de la fuente (descenso +
  ascenso + aire ≥ 0,4 mm). El valor se sangra 2 mm bajo su etiqueta.
- Un campo es atómico: nunca se parte entre páginas.
- Una lista de campos que no cabe se divide EQUILIBRADA: la cola conserva
  al menos el 35 % de una página (nada de colas de 1–2 campos huérfanos).
- La altura de cada campo se mide con la misma anchura con la que se dibuja.

## Bloques de análisis y filete decorativo

- Título, etiqueta de estado y cuerpo comparten la columna M+5.
- El cuerpo NUNCA nace en el margen del folio: vive a la derecha del filete
  y CONSERVA su margen al cruzar saltos de página.
- La altura se estima con la MISMA anchura del render (sin anchos falsos).
- El filete se dibuja con color y grosor fijados tras cada cambio de página;
  en cruces, abraza la primera línea reanudada con el mismo aire superior.

## Tablas: cadena de ajuste documentada

1. Reducción de fuente hasta el suelo (≥ 8,5 pt vertical / ≥ 7 pt apaisada).
2. Compresión SOLO de columnas de texto hacia su suelo.
3. Orientación apaisada por CONTENIDO (la declaración «ancha» es una pista,
   no una puerta).
4. División en bloques lógicos de columnas: conceptos repetidos,
   encabezados y títulos «(parte i de n)», nota en la última parte.

**Prohibido**: el escalado proporcional silencioso de TODAS las columnas
(las cifras, porcentajes, códigos y unidades no se comprimen nunca). El
sobrante de anchura reparte aire primero a las columnas de TEXTO.

## Paginación y títulos

- El título de capítulo reserva como «arranque digno» la altura real de su
  primer contenido (no una constante): nada de títulos huérfanos al pie.
- La absorción en bloques apaisados usa la ALTURA REAL del elemento liviano;
  su lectura pertenece junto a la tabla que interpreta.
- Ningún texto invade: la banda del pie (línea + numeración), la banda bajo
  la cabecera fija, ni el margen derecho de su orientación.

## Portada

- Toda línea de la portada se ajusta al ancho útil (la nota de generación
  se envuelve en varias líneas; jamás desborda el folio).
