# PLANEX-DOC-002 — Informe de auditoría financiera, calidad documental y exportación profesional

Caso de regresión: **«Clínica Estomatológica Sonrisa Habana»** (plantilla de demostración, datos ficticios, tasa ilustrativa 743 CUP/USD, impuesto 35 % — ambos pendientes de validación oficial).
Rama: `audit/planex-doc-002`. No se fusiona ni se despliega a producción sin autorización expresa del propietario.

> **Nota sobre las cifras citadas por la misión.** El texto de la misión cita la salida histórica del informe (inversión 592.000,0 kCUP, ingresos del año 1 387.120,0 kCUP, recuperaciones 3,5/3,3 años, equivalencia 1.200 kUSD = 480.000 kCUP), que corresponde a la tasa 400 CUP/USD de la versión anterior de la demostración. Tras la corrección de la tasa a 743 (misión UX-002, autorizada por el propietario) y de las fórmulas de la presente misión, los valores del caso de regresión son otros: inversión 1.099.640,0 kCUP (= 1.480,0 kUSD), ingresos del año 1 719.075,4 kCUP (= 967,8 kUSD × 743; esta cifra se corrigió en DOC-002-R1: antes figuraba «718.675,4» por una errata de dígito — el modelo canónico, el PDF y el Word siempre mostraron 719.075,4), recuperación del proyecto 3,5 años (3,46) y del capital aportado 3,2 años. **No se modificó fórmula alguna para forzar la coincidencia con los resultados anteriores** (§1 de la misión): las diferencias quedan documentadas en la tabla de conciliación antes/después.

---

## 1. Errores matemáticos confirmados (corregidos)

### 1.1 FCFF con el interés completo en lugar del interés después de impuestos (§4.1)

**Confirmado.** El motor computaba `FCFF = UDI + intereses devengados + depreciación − CAPEX − …`. La UDI ya descuenta el gasto por intereses **con su efecto tributario** (la regla de impuesto grava la UAI, que va después de intereses): sumar el interés completo reincorporaba de más el escudo fiscal, sobreestimando el FCFF en `intereses × tasa` cada año.

**Corrección aplicada.** El escudo se **deriva de la propia regla de impuestos del proyecto**: se reevalúa la regla activa (`impuesto_utilidades_k`) con la base hipotética sin intereses (`UAI + intereses devengados`), y

```
escudo_fiscal(t) = impuesto(sin intereses)(t) − impuesto(regla activa)(t)
FCFF(t) = UDI + (intereses devengados − escudo) + depreciación − CAPEX ampliaciones
          (+ recuperación del CT en el último año) − inversión total (año 0)
FCFE(t) = FCFF − (intereses pagados − escudo) + desembolsos − amortizaciones
```

Con la regla plana vigente, `escudo = intereses × 35 %`, de modo que `FCFF = UDI + intereses × (1 − 35 %) + depreciación − …`, exactamente la fórmula estándar de la misión cuando la utilidad es posterior a intereses e impuestos. Si el usuario edita la regla de impuestos (base, tasas, topes), el escudo **se recalcula desde su regla**; si su regla no depende de la base después de intereses, el escudo es cero y la reincorporación del interés completo es la correcta para ese modelo (coherencia con «no imponer una fórmula sin reconciliarla con el tratamiento fiscal real»).

**Identidad de reconciliación probada en tests (todos los años, gracia de principal, gracia total y sin deuda):**

```
FCFF − FCFE = intereses pagados − escudo fiscal − desembolsos + amortizaciones
```

Con intereses corrientes equivale a la definición estándar `FCFE = UDI + depreciación − CAPEX + desembolsos − amortizaciones`; con gracia total (interés capitalizado), la porción no pagada no es salida de caja y se reincorpora neta de escudo. La serie `indicadores.escudoFiscal` queda expuesta en el modelo, en la tabla de flujos del informe y en el Excel.

**Efecto en el caso de regresión (kUSD, tasa 743):**

| Año | Interés devengado | Escudo (35 %) | FCFF antes (interés completo) | FCFF corregido | Diferencia |
|-----|------------------:|--------------:|------------------------------:|---------------:|-----------:|
| 1   | 24,00             | 8,40          | 392,58                       | 384,18         | −8,40      |
| 3   | 22,08             | 7,73          | 459,03                       | 451,31         | −7,73      |
| 5   | 17,28             | 6,05          | 534,72                       | 528,67         | −6,05      |
| 7+  | 0,00              | 0,00          | 475,86                       | 475,86         | 0,00       |

La recuperación del proyecto pasa de 3,41 a **3,46 años** (se muestra «3,5»); la del capital aportado **no cambia** (3,22 → «3,2»): el FCFE es algebraicamente idéntico antes y después de la corrección, y esa invariancia es precisamente una de las pruebas automáticas. Ambas recuperaciones quedan etiquetadas como **simples, sin descontar** (sin tasa de descuento alguna: no son VAN ni TIR), en el motivo del indicador, en las reglas, en las narrativas, en la ayuda y en el informe.

### 1.2 Etiqueta «(en USD)» sobre el equivalente convertido (§6)

**Confirmado.** La fila «Inversión fija (en USD) 891.600,0» mostraba el equivalente en kCUP (a tasa 743) bajo un rótulo que dice «en USD» (con tasa 400 mostraba 480.000,0, como citó la misión). **Corregido:** la tabla 4.7 muestra ahora dos columnas — monto **original** (1.200,0 kUSD / kCUP de origen) y **equivalente** en la moneda de presentación — con nota explícita del tipo de cambio aplicado; el rótulo es «Inversión fija facturada en USD (no es el equivalente en CUP: ver monto original)». La corrección cubre todas las partidas equivalentes (gastos previos, inversión fija en CUP convertida, capital de trabajo) y aplica igual en PDF y Word.

---

## 2. Inconsistencias contables confirmadas (corregidas)

### 2.1 Conciliación del desembolso inicial — la brecha del año 0 (§4.2)

**Confirmado.** Las fuentes declaradas (1.480,0 kUSD: aportaciones 1.180,0 + crédito 300,0) cubren exactamente la inversión total (1.480,0), pero el **gasto de montaje del año 0** (6 trabajadores × 96 000 CUP = **576,0 kCUP** = 0,78 kUSD) se paga fuera de la inversión total: los flujos iniciales eran −1.480,78 (proyecto) y −1.180,78 (socios) mientras las tablas de financiación declaraban cobertura exacta. La misión pedía determinar si ese gasto se financia con el capital de trabajo: la respuesta es que **no** — el CT (235,0 kUSD) ya está dentro de la inversión total, y la nómina de montaje es gasto del período no capitalizable.

**Corrección aplicada.**
- Nueva **tabla de conciliación del desembolso inicial** en el informe: inversión total + gastos del año 0 = **necesidad total de arranque** (1.480,8 kUSD) frente a fuentes declaradas → **brecha 576,0 kCUP**, con la nota de que los años 0 y 1 conservan el mismo significado en aportaciones, fuentes, calendarios y flujos.
- El motor emite el hallazgo `FINANCIACION_ANO0` (advertencia importante, afecta conclusiones) cuando la brecha existe, con la cifra exacta y la corrección propuesta (mayor capital de trabajo, aporte adicional o declaración expresa del supuesto).
- Las **aportaciones** pasan a etiquetarse «Año 0 (montaje), Año 1, Año 2» — la convención real del modelo (el desembolso del año 0 financia la inversión total) — y la narrativa lo dice textualmente; antes se rotulaban «Año 1/2/3» mientras se computaban como fondos del año 0 (inconsistencia de significado entre tablas, §4.2).
- No se contó dos veces el capital de trabajo ni los gastos de puesta en marcha (verificado por prueba): la nómina de montaje sigue fuera de «gastos previos» y el CT se desembolsa una sola vez dentro de la inversión total.

### 2.2 Otras conciliaciones verificadas (nuevas pruebas automáticas)

- **Dividendos:** la reserva se constituye una sola vez sobre la base distribuible, que NO es solo la utilidad del año: base = MAX(0, UDI + saldo acumulable de ejercicios anteriores) — actualizado y documentado con exactitud en DOC-002-R1 §5 —; `saldo acumulable = previo + UDI − reserva − pagables` reconcilia cada año; participación de **cada socio** (nacional y extranjero) con el parámetro de participación; caja acumulada visible en la tabla del informe.
- **Deuda:** `saldo final = inicial + desembolso + capitalización − amortización` por período; el principal no es gasto del estado de resultados; la amortización jamás excede el saldo.
- **Depreciación:** cada activo deprecia solo desde su año de disponibilidad, jamás por encima de su importe depreciable; el VNL al cierre (adecuación, vida 20 años; ampliación del año 7) queda declarado como valor neto en libros **sin** asumirse su realización.
- **FCFF/FCFE:** identidad de reconciliación (§1.1) probada año a año en los tres regímenes de gracia y sin deuda; el diagnóstico la vigila como `FLUJOS_NO_RECONCILIAN` (bloqueante).
- **Beneficios al país:** resumen, tabla y conclusiones provienen del mismo total (prueba de cuadre exacto).

---

## 3. Resultados que requieren decisión metodológica (documentados, no impuestos)

1. **Caja de dividendos = FCFE acumulado desde el año 0** (incluye la fase de inversión): política conservadora que retiene repartos hasta recuperar en caja los aportes (en la demo, dividendos pagables 0 en años 1–3). Se decidió **mantener** la regla (no cambia resultados respecto de la versión auditada) y documentarla expresamente en el informe («política conservadora»), en la ficha de parámetros y en la ayuda, y listarse aquí como decisión pendiente de ratificación por el propietario.
2. **Recuperación del capital de trabajo al cierre = 0 %** (sin liberación en el año final): hipótesis conservadora **presentada como hipótesis** (no regla universal) en parámetros, narrativa, ayuda e informe; editable con justificación documental.
3. **Inflación de costos fijos = 0 %** (contratos nominales fijos): la misión pedía determinar si la ausencia de indexación del canon/servicios públicos/otros gastos fijos era intencional o incompleta. Es una **regla intencional**, ahora explícita: parámetro nuevo `inflacion_costos_fijos` (defecto 0 %) aplicable a canon, servicios públicos, otros gastos fijos, aranceles, otros impuestos y royalties; el parámetro de inflación se renombró «Inflación prevista (costos variables unitarios de servicios)». Ninguna partida indexada se sugiere por un parámetro genérico: el alcance de cada parámetro se **deriva de las reglas activas** y se publica en la tabla «Alcance documentado de cada parámetro financiero» (partidas afectadas, fórmula, ámbito, efecto contable/caja, redondeo).
4. **Interés devengado vs pagado en FCFF/FCFE:** FCFF usa el devengado neto de escudo y FCFE el pagado neto de escudo — con gracia total, la porción capitalizada no es salida de caja. Documentado en `flujos.ts` y en el informe.
5. **Ampliación del año 7:** CAPEX (150,0 kUSD) y capacidad adicional entran ambos en el año 7 (convención del escenario B); la utilización de gabinetes baja de 89,6 % (año 6) a ~67 % (año 7), todo reproducible desde horas-mes.

---

## 4. Supuestos no verificados (visibles, no contados como validados)

- **Tasa de impuesto 35 %**: supuesto de demostración editable; el informe la marca como advertencia económica que **condiciona** las conclusiones (resumen y conclusiones lo dicen expresamente).
- **Tasa de cambio 743 CUP/USD** (fecha de corte del supuesto 2026-10-25, realineada a la fecha del documento en DOC-002-R1 §6; antes figuraba 2026-10-26, posterior al documento): ilustrativa, **PENDIENTE DE VALIDACIÓN OFICIAL** (fuente y fecha documentadas en la nota de conversión y en el bloque de fuentes, presentadas como fecha de corte del supuesto y no como cotización observada).
- **Demanda solvente (38 000 personas) y captación (12 %)**: estimación ficticia; el informe reconcilia 4.560 personas captadas con 13.344 servicios previstos del año 1 mediante la **hipótesis explícita** de ≈ 2,9 servicios por paciente captado al año (frecuencia de visita), declarada como supuesto a validar.
- **Referencias documentales de las aportaciones**: las cinco referencias de la demo son hipótesis (ficticias/proforma/pendientes): el informe las rotula **«HIPÓTESIS (no validada)»** y el diagnóstico las emite como `REFERENCIA_HIPOTESIS` (información pendiente). Un campo «con referencia documental» exige ahora una referencia identificable (título, emisor, fecha) para contar como respaldo.
- **Requisitos regulatorios y fuentes de mercado**: listados, no verificados; la aplicación no declara cumplimiento legal, sanitario, tributario ni de mercado.

El diagnóstico no clasifica el plan como globalmente «correcto» porque las sumas cuadren: evalúa las **seis dimensiones independientes** de la misión (integridad aritmética; coherencia financiera y contable; evidencia y trazabilidad de los supuestos; cumplimiento de la estructura metodológica; estado de validación normativa y comercial — jamás «ok» —; calidad documental) y emite un **estado general** comprensible: *Borrador de demostración · Borrador con validaciones pendientes · Validación financiera pendiente · Revisión profesional pendiente · Listo para revisión final* (solo con campos completos, sin errores ni advertencias financieras y supuestos con referencia identificable; nunca equivale a validación normativa). La plantilla demo queda en «Borrador de demostración», con la declaración de responsabilidad **pendiente de aceptar** y el aviso «BORRADOR NO APTO PARA PRESENTACIÓN».

---

## 5. Defectos de presentación corregidos (§3)

| # | Defecto (evidencia antes) | Corrección | Evidencia |
|---|---------------------------|------------|-----------|
| 1 | Superposición en 4.1: el subtítulo «4.2 Título» se dibujaba como encabezado absoluto (y=20) **sobre** el encabezado «4.1 Información general» (revisión visual 150 dpi: «4.2 Tifolmación general»), y el cursor no se movía bajo él | Los subtítulos se renderizan **en flujo** (negrita, filete, separación); eliminado todo posicionamiento absoluto para bloques de texto variable | `doc002-seccion-41-campos-pendientes.png` |
| 2 | Cuerpo narrativo alineado a la izquierda | **Justificado** como convención editorial de PLANEX (título/etiquetas/celdas no se justifican); el informe declara expresamente que APA 7 alinea a la izquierda y que el justificado NO se presenta como requisito APA | Revisión visual: párrafos con ambos márgenes limpios |
| 3 | Caracteres corruptos: U+2212 «−» se imprimía como «"» («(t"1)», «capitalización " amortización») y los corchetes CJK 【】 como dígitos («0Nombre…0»); el Word conservaba los caracteres y **no coincidía con el PDF** | Módulo `doc/texto.ts`: conversión única y determinista a WinAnni-seguro, compartida por PDF y DOCX; los contenidos de ambos formatos coinciden carácter a carácter; pruebas detectan caracteres de control, marcadores sin sustituir y tokens | Extracción: «(t-1)», «FCFF - FCFE = intereses pagados - escudo», 0 apariciones de los patrones corruptos |
| 4 | Marcador de autor corrupto 【…】 con la declaración presentada como firmada | Campo pendiente profesional «[Pendiente: nombre y apellidos de quien elabora]», declaración «PENDIENTE DE ACEPTAR», aviso «BORRADOR NO APTO PARA PRESENTACIÓN» con la lista de campos; la demo ya no simula firma ni responsabilidad | Ídem evidencia #1 |
| 5 | Palabras partidas en la primera columna de las tablas financieras y columna «Estado» ilegible en fuentes | Anchos por **contenido** en todas las tablas y páginas **apaisadas** para las tablas de ≥10 columnas (como hace Word), con pies de página adaptados a cada orientación | `doc002-proyeccion-apaisada.png`, `doc002-fichas-parametros.png` |
| 6 | Unidades narrativas mezcladas («62.412,0 miles de CUP» junto a «316.057,0 kCUP»), gramática «más tardío/temprano que la recuperación» | Unidad única por frase (`pres.corto`), concordancia «más tardía/temprana» | Pruebas de sincronización |
| 7 | Sin numeración de tablas ni figuras | Numeración secuencial «Tabla N.»/«Figura N.» incorporada al modelo canónico (mismo rótulo en visor, PDF y Word), títulos con `keepNext` en Word y salto anti-huérfanos en PDF | Revisión visual |
| 8 | Sin gráficos | **Tres figuras vectoriales** generadas localmente desde los mismos datos (evolución de ingresos/costos/utilidad; flujos acumulados FCFF/FCFE con cruces de cero marcados; utilización de recursos por año con umbral), con número, título, unidades, leyenda, nota APA y referencia desde el texto; PDF las dibuja vectorialmente y Word incrusta un PNG codificado por la propia aplicación (fflate) — sin CDN ni servicios externos | `doc002-figura-flujos-cruce-cero.png` |
| 9 | Desglose de ingresos por canal ausente | Canal por servicio (exportación / plataformas con pagos desde el exterior / venta en plaza) + tabla «Proyección de ingresos por canal» (sin duplicar operaciones: la suma por canales cuadra con el estado de resultados, probado) | `doc002-tabla-servicios-apaisada.png` |

---

## 6. Pruebas realmente ejecutadas y sus resultados

Entorno de ejecución: Bun 1.3.14 (Linux x86_64). Resultados verificados en esta rama:

| Verificación | Resultado |
|---|---|
| `bun test tests/planex/` (16 archivos) | **288/288 pass, 0 fail** (3.462 comprobaciones antes → 6.008 tras añadir la suite DOC-002 y actualizar las expectativas afectadas) |
| `tsc --noEmit` | 0 errores |
| `eslint .` | 0 problemas |
| `next build` (exportación estática) | OK (out/index.html + worker pdf.js presentes) |
| Renderizado visual de TODAS las páginas del plan de regresión (37 páginas, pdftoppm 100–130 dpi) + revisión asistida página a página (portada, índice, 4.1, tablas apaisadas, figuras, diagnóstico, notas, fuentes) | Sin superposiciones, sin palabras partidas, pies de página correctos en ambas orientaciones, figuras vectoriales legibles con ejes/rejilla/leyenda |
| Extracción de texto del PDF (pdftotext + streams jsPDF) vs. modelo canónico | Fórmulas completas («(t-1)», «FCFF - FCFE = …», «DESPUÉS DE IMPUESTOS»), 0 caracteres de control, 0 marcadores sin sustituir, 0 tokens (`undefined`/`NaN`/`${`) |
| DOCX descomprimido e inspeccionado | Texto seleccionable real; 3 PNG de figuras válidos (cabecera/crc/IDAT decodificables con PIL); estilos Word (Heading1/2), `tblHeader`, `cantSplit`, `keepNext`, TOC actualizable; texto idéntico al modelo y sin U+2212/【】 |

**Suite DOC-002 nueva (42 pruebas)** — `tests/planex/doc002.test.ts`: escudo fiscal derivado de la regla activa; FCFF menor que el antiguo exactamente en el escudo; identidad FCFF−FCFE en gracia de principal, gracia total y sin deuda; FCFE invariante y definición estándar con intereses corrientes; recuperaciones recalculadas y etiquetadas «simple, sin descontar»; brecha del año 0 (576,0 kCUP) y hallazgo FINANCIACION_ANO0; tabla de conciliación; convención única año 0/año 1; alcance de la inflación (variable ≠ fijos, `inflacion_costos_fijos` indexa solo las partidas fijas); fichas de parámetros derivadas de reglas; bloque de fuentes con tipos diferenciados; dividendos (reserva única, caja, participación por socio); VNL y CT documentados; conciliación demanda/captación/volumen (4.560 → 13.344 → ≈2,9 servicios por paciente); utilización reproducible (912 horas-mes disponibles, 89,6 % año 6, alivio en el 7); desglose por canal sin duplicar; seis dimensiones y máquina de estado general (demostración → validación financiera → pendientes → revisión profesional → listo); advertencia económica por tasa demostrativa; sanitizer WinAnni (mapeos, control de caracteres, marcadores); PDF sin fórmulas corruptas; subtítulos en flujo; numeración Tabla/Figura; sincronización de cifras CUP/USD; figuras (claves, series idénticas a la tabla 4.7, PNG válido, referencias desde el texto, nota editorial APA); etiqueta de inversión fija con monto original; salarios en CUP con equivalente documentado.

**Expectativas actualizadas en suites existentes** (documentan el cambio, no lo ocultan): FCFF del año 1 = UDI + (24 − 8,4) + 117,125 (antes 392,58 → ahora 384,18); cascada tributaria ΔFCFF = Δtasa × (UAI + intereses) y ΔFCFE = Δtasa × UAI; hoja Controles del Excel con las seis dimensiones y el estado general; recuperaciones «3,5/3,2» (proyecto/socios); Word admite exactamente las 3 figuras como PNG locales (sigue sin rasterizar texto).

---

## 7. Limitaciones que continúan pendientes

1. **Validación oficial** de la tasa de cambio (743 CUP/USD) y del impuesto (35 %): supuestos demostrativos; advertidos en todos los documentos y en el bloque de fuentes.
2. **Datos de demostración**: la plantilla sigue siendo ficticia («Borrador de demostración»); la brecha del año 0 (576,0 kCUP) es un hallazgo real del caso, no un error del motor, y se deja visible a propósito — la decisión de financiarla o ajustar los datos corresponde al propietario del plan.
3. **Política de caja de dividendos** (FCFE acumulado desde el año 0): decisión metodológica pendiente de ratificación (§3.1); cambiarla alteraría el calendario de repartos de la demo (años 4+).
4. **Paginación PDF vs Word**: los motores de composición difieren (el PDF numera el índice con doble pasada; Word usa TOC actualizable); los contenidos, cifras, tablas, fórmulas y figuras coinciden, la paginación exacta no.
5. **E2E de navegador con Supabase real** (53/63 y 19/19 de las misiones anteriores): no se reejecutó en esta sesión (requiere credenciales del despliegue); la validación del documento se realizó con los mismos generadores usados por la interfaz (exportarPDF/exportarDOCX consumen el modelo canónico idéntico al visor) más renderizado visual completo del PDF e inspección del DOCX.
6. **Figuras en Word**: se incrustan como PNG generado localmente (idénticos datos que el vector del PDF); una futura mejora podría incrustar EMF/SVG nativo, que Word admite pero con soporte desigual según versión.

## 8. Evidencias comparativas

- `docs/capturas/doc002-seccion-41-campos-pendientes.png` — 4.1 corregida: campos con marcador pendiente profesional, aviso «no apto», subtítulo 4.2 en flujo (antes: «4.2 Título» superpuesto al encabezado y marcador CJK corrupto).
- `docs/capturas/doc002-proyeccion-apaisada.png` — proyección 4.7 en página apaisada, columna de conceptos legible (antes: «ESTOMATO- LÓGICOS» partido).
- `docs/capturas/doc002-flujos-escudo-fiscal.png` — flujos con la fila «Escudo fiscal del interés devengado» e identidad de reconciliación.
- `docs/capturas/doc002-figura-flujos-cruce-cero.png` — Figura 3: acumulados FCFF/FCFE con cruces de cero marcados (3,5 / 3,2 años).
- `docs/capturas/doc002-diagnostico-estado-general.png` — diagnóstico con estado general y las seis dimensiones.
- `docs/capturas/doc002-fichas-parametros.png` — alcance documentado de parámetros (inflación variable vs fijos).
- `docs/capturas/doc002-tabla-servicios-apaisada.png` — tabla de servicios con canal de comercialización en apaisado.
- `docs/ejemplos/Ejemplo_Clinica_Plan_de_Negocios.pdf` y `Ejemplo_Clinica_Libro_con_formulas.xlsx` — regenerados con el motor corregido.

---

# PLANEX-DOC-002-R1 — Cierre de hallazgos residuales (adición a este informe)

Rama: `fix/planex-doc-002-r1-cierre-hallazgos` (desde `main`, que ya contiene el PR #5 fusionado). No se fusiona ni se despliega a producción sin autorización expresa del propietario. Validación de cierre ejecutada: `tsc --noEmit` (0 errores), `eslint .` (0 problemas), `bun test tests/planex/` (**318/318 pass**, 6.448 comprobaciones), `next build` estático OK y **exportación del plan de regresión** regenerada (`bun scripts/exportar_regresion.ts`): PDF y Word en CUP **y** en USD, y libro Excel con fórmulas.

Revisión visual efectuada (renderizado pdftoppm 110 dpi + inspección asistida página a página de las páginas exigidas): portada, índice, **4.1** (pág. 3), **4.6** con las tablas de recursos y de ampliaciones derivadas y la figura de utilización (págs. 7–9), **proyección financiera 4.7** incluida la Tabla 14 apaisada (págs. 12–15), **flujos 4.7.1 y Figura 3** (págs. 16–18), **diagnóstico con la tabla de conciliación del arranque** (págs. 31–32), **notas/parámetros** (págs. 33–37) y las variantes USD (portada y figura de flujos). Sin superposiciones ni textos cortados; los pies de página correctos en ambas orientaciones. **No** se recorrió visualmente el 100 % de las 37 páginas: las restantes (apartados narrativos 4.2–4.5, 4.8–4.12 y sus tablas) se validaron por extracción de texto y por las pruebas automáticas de solapes/carácter/truncado, no inspeccionando una a una su maquetación.

## Tabla por hallazgo: causa raíz, cambio, prueba y evidencia

| # | Hallazgo | Causa raíz | Cambio realizado | Prueba que lo demuestra | Evidencia |
|---|----------|------------|------------------|-------------------------|-----------|
| 1 | **Conciliación CUP/USD en la documentación** (ingresos año 1 citados como 718.675,4 kCUP) | Errata de dígito en la NOTA del informe de auditoría y en la descripción del PR #5 (el modelo, el PDF y el Word siempre calcularon 967,8 × 743 = 719.075,4) | `docs/DOC002_INFORME_AUDITORIA.md` corregido con nota de errata; descripción del PR #5 corregida por API; pruebas nuevas que verifican el ingreso del año 1 en ambas monedas en canónico, PDF y DOCX (no solo la inversión) | `doc002r1 §1`: motor 967,8 kUSD exactos; × 743 = 719.075,4; canónico/PDF/DOCX contienen la cifra de SU moneda y nunca la errata; el informe del repo menciona «718.675,4» solo 1 vez (la nota de corrección) | `docs/ejemplos/Ejemplo_Clinica_Plan_de_Negocios.pdf` pág. 4 y 14 («719.075,4»); `_USD.pdf` pág. 4 («967,8»); prueba de archivos en `doc002r1.test.ts` |
| 2 | **Diagnóstico de financiación inicial** (gastoAnio0 = max(0, −UDI_0)) | El gasto de caja del arranque se DEDUCÍA del resultado contable: la UDI del año 0 mezcla pérdidas no monetarias, devengos no pagados e ingresos neteados | Nueva función única `conciliarArranque()` (flujos.ts): nómina de montaje (`costo_laboral_k[0]`) + interés PAGADO del año 0 + impuesto del año 0 − ingresos explícitos del año 0; motor, análisis, documento y control consumen la MISMA fuente; eliminada la equivalencia con la UDI en los 4 puntos; la advertencia de la clínica sigue mostrando exactamente la nómina de montaje (576,0 kCUP) sin duplicar el capital de trabajo | `doc002r1 §2`: escenarios de pérdida no monetaria (dep. 52 kUSD en el año 0 → la brecha NO crece), ingresos del año 0 (la reducen exactamente), gracia total (el devengo capitalizado no es caja) y estabilidad ante UDI distinta; `doc002 §4.2` actualizado a las partidas explícitas | Tabla «Conciliación del desembolso inicial» del diagnóstico (págs. 31–32, brecha −576,0 kCUP) con el desglose por partidas y la nota «NO se deduce del resultado contable» |
| 3 | **Ampliación del año 7** (narrativa con año fijo «año 8») | El texto de la plantilla («plazoNiveles») fijaba el año por su cuenta, desacoplado del dato estructurado de recursos | Plantilla sin año narrado (apunta a la tabla de recursos); tabla nueva «Ampliaciones programadas… (derivadas del modelo)» con año/CAPEX/depreciación/VNL desde el MISMO dato; control nuevo `AMPLIACION_NARRATIVA_INCONSISTENTE` que bloquea narrar un año no registrado | `doc002r1 §3`: capacidad/CAPEX/depreciación/alivio de utilización usan el año 7; la narrativa no fija año; con una copia que narra «año 8» el hallazgo se dispara (prueba que impide la divergencia) | Págs. 7–8: Tabla 6 con año 7, CAPEX 111.450,0 kCUP y 11.145,0 kCUP/año desde el año 7; texto del análisis de cronograma citando «años 7» |
| 4 | **Supuesto de inflación fija** (0 % calificado de «conservador») | La descripción del parámetro cerraba el juicio («hipótesis deliberada y conservadora») sin exponer el sentido del sesgo ni la carga probatoria | Reclasificada como HIPÓTESIS DE GASTOS NOMINALES CONSTANTES sujeta a PRUEBA CONTRACTUAL, con partidas afectadas y advertencia de subestimación/sobreestimación; el análisis presenta la SENSIBILIDAD de resultados (Δ costos fijos del año N y Δ UDI acumulada frente al caso 0 %) cuando el parámetro es positivo | `doc002r1 §4/§5`: descripción sin «conservadora» + hipótesis en el análisis + sensibilidad reproducible con 4 % (el texto cita el delta exacto del modelo recalculado) | Pág. 15 (CUP) y equivalente USD: párrafo «GASTOS NOMINALES CONSTANTES… PRUEBA CONTRACTUAL… SUBESTIMA/SOBREESTIMA»; ficha de parámetros con partidas afectadas derivadas de reglas |
| 5 | **Reserva para dividendos** (base descrita solo como «del año») | La documentación del informe no exponía la fórmula real: la base incluye el saldo ACUMULADO de ejercicios anteriores, no solo la utilidad del año | Fórmula exacta `base_t = MAX(0, UDI_t + saldoAcumulable_(t−1))` documentada en el informe (reglas del módulo), en el parámetro `pct_reserva_legal` y en la ayuda, con la validación jurídica pendiente EXPLÍCITA y la decisión reservada al propietario | `doc002r1 §4/§5`: año 2 con saldo previo POSITIVO (base > UDI del año), reserva = 10 % × base; canónico contiene la fórmula y el rótulo «SUPUESTO EDITABLE PENDIENTE DE VALIDACIÓN JURÍDICA» | Pág. del módulo de dividendos: reglas expresas con la base matemática completa; ficha del parámetro en la pág. de notas |
| 6 | **Referencia temporal de la tasa** (2026-10-26 > fecha del documento 2026-10-25) | La fecha de corte del supuesto quedó un día DESPUÉS de la fecha del documento, presentándose como cotización observada | `fechaRef` realineada a 2026-10-25; la nota de conversión la rotula «fecha de corte del supuesto ilustrativo, no una cotización observada»; control nuevo `TASA_FECHA_FUTURA` que bloquea fechas posteriores y las marca como PREVISTA; la tasa 743 se mantiene como supuesto ilustrativo PENDIENTE DE VALIDACIÓN OFICIAL | `doc002r1 §6`: fecha ≤ fecha del documento y sin hallazgo en la demo; copia con 2026-10-26 → hallazgo `TASA_FECHA_FUTURA` (advertencia) + nota con «PREVISTA: es posterior a la fecha del documento» | Pág. 33/37: nota de moneda con «743,0 CUP por USD (fecha de referencia: 2026-10-25 — fecha de corte del supuesto ilustrativo…)» |
| 7 | **Gráfico de flujo acumulado** (sin etiquetas numéricas) | Las figuras no llevaban texto dentro: el eje Y no mostraba cifras ni el eje X los años | Rejilla con valores «bonitos» etiquetados (es-ES agrupado, dentro del rango) y marcas de año con paso automático; PDF vectorial + PNG de Word con la MISMA lista; fuente bitmap 5×7 propia para el PNG (sin CDN); visor web alineado; series FCFF/FCFE, nivel cero y cruces 3,5/3,2 siguen diferenciados | `doc002r1 §7`: las 3 figuras con marcas Y dentro de rango y años exactos; series idénticas a las tablas 4.7/4.7.1/4.6; el texto del PDF contiene las etiquetas del eje; el PNG decodificado tiene píxeles de etiquetas reales a la izquierda y bajo el eje | Figura 3 (pág. 18 CUP): Y = −1.000.000…3.000.000 kCUP, X = 0–10; USD: −1.000…4.000 kUSD; revisión visual de las tres figuras en ambas monedas sin solapes |
| 8 | **Pruebas independientes** (aserciones nuevas, no repiten las previas) | Las suites existentes validaban el estado DOC-002 pero no los hallazgos residuales de la misión R1 | Suite nueva `tests/planex/doc002r1.test.ts` (30 pruebas): ingreso año 1 en ambas monedas (canónico/PDF/DOCX), intereses devengados/pagados/capitalizados + FCFF/FCFE (incluida invariante de saldo y gracia total), financiación inicial desde salidas explícitas, año de ampliación consistente (tablas/narrativa/figuras), gráficos = tablas, fecha de tasa vs documento | La suite completa: **318/318 pass** con las suites previas intactas (42 de DOC-002 conservadas con expectativas puntuales actualizadas y documentadas en el código) | `bun test tests/planex/` en la rama; suites `doc002.test.ts` (42) + `doc002r1.test.ts` (30) |

## Limitaciones que continúan pendientes (estado tras R1)

1. **Validación oficial** de la tasa de cambio (743 CUP/USD) y del impuesto (35 %): supuestos demostrativos ilustrativos; el bloque de fuentes y la nota de conversión los presentan como pendientes de validación.
2. **Política de reservas y repartos**: la base exacta (UDI + saldo acumulado) está documentada, pero la política deseada por el propietario y su exigencia legal requieren confirmación jurídica expresa (hallazgo declarado, no resuelto por la aplicación).
3. **Hipótesis de gastos nominales constantes** (inflación de costos fijos 0 %): la prueba contractual de cada partida fija sigue pendiente; la sensibilidad se presenta al cambiar el parámetro, no se impone ningún valor.
4. **Brecha del año 0 (576,0 kCUP)**: hallazgo real del caso de demostración, ahora derivado de salidas de caja explícitas; la decisión de financiarla o ajustar los datos sigue siendo del propietario.
5. **Datos ficticios**: la plantilla continúa como «Borrador de demostración» con la declaración de responsabilidad pendiente de aceptar.
6. **E2E de navegador con Supabase real**: no reejecutado en esta sesión (credenciales del despliegue); la validación documental usó los mismos generadores que la interfaz más renderizado visual e inspección de archivo.
7. **Recorrido visual**: inspeccionadas asistidamente las páginas exigidas por la misión (4.1, 4.6, proyección, flujos, figuras, diagnóstico, notas, portada e índice en CUP, y portada/figuras en USD); el resto de páginas se validó por extracción de texto y pruebas automáticas, sin revisión visual una a una.
8. **Paginación PDF vs Word** y figuras de Word como PNG local: limitaciones ya conocidas de DOC-002 que persisten.

## Evidencias R1

- `docs/ejemplos/Ejemplo_Clinica_Plan_de_Negocios.pdf` / `.docx` (CUP) y `Ejemplo_Clinica_Plan_de_Negocios_USD.pdf` / `.docx` (USD) — regenerados con `scripts/exportar_regresion.ts`; `Ejemplo_Clinica_Libro_con_formulas.xlsx` con la nota de FCFF corregida (escudo fiscal).
- `tests/planex/doc002r1.test.ts` — suite independiente de cierre (30 pruebas).
- Revisión visual asistida de las páginas exigidas, ambas monedas (pdftoppm 110 dpi): sin superposiciones, con ejes etiquetados legibles.
