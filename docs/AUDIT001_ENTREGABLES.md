# PLANEX-AUDIT-001 — Entregables de la auditoría integral

> **Documento de entrega de la misión §19 (A–G)** — Auditoría integral, corrección matemática y contable, cumplimiento metodológico y plantilla profesional.
> Todas las cifras de este documento provienen del motor de cálculo (no hay resultados hardcodeados); se reproducen con `bun run scripts/verificar-modelo.ts`.

---

## A. Informe de auditoría

Defectos detectados, su causa, el riesgo económico y la corrección implementada. Cada corrección queda verificada por una prueba de la suite (176/176 en verde).

| ID | Defecto detectado | Causa raíz | Consecuencia económica | Corrección | Prueba |
|----|-------------------|-----------|------------------------|------------|--------|
| AUD-01 | Cifras sin agrupación de miles es-ES («1480,0» en vez de «1.480,0») en PDF, XLSX, análisis y diagnóstico | El ICU del entorno de ejecución no inserta el separador de miles para `es-ES` (verificado en bun y node); el formateo dependía de `Intl.NumberFormat` | Presentación no conforme al formato de la Gaceta; lecturas erróneas de magnitudes (riesgo documental, no de cálculo) | Formateo manual y determinista en `src/lib/planex/format.ts` (agrupa miles con punto, coma decimal, un decimal) | §16.7 PDF («1.480,0»), §17 («2.265»), xlsx.test |
| AUD-02 | Los INGRESOS no quedaban limitados por el pool de recursos compartidos: la regla realizable era `MIN(demanda, tope teórico del servicio)` | `srv_cantidad_real_mensual` usaba `mtr_capacidad_mensual` (capacidad teórica por servicio) e ignoraba el factor pro-rata del módulo de capacidad | En el escenario A se facturaba demanda no atendible (años 9-10) sobreutilizando gabinetes/profesionales: ingresos y recuperación optimistas; con profesionales insuficientes la producción no caía | La regla pasa a ser `mtr_cantidad_real_mensual` (asignación pro-rata del pool compartido + tope técnico) | §16.4 (CANTIDAD 2.500, PROFESIONALES=2, escenario A recorta con advertencia) |
| AUD-03 | La caja de dividendos acumulaba el FCFE desde el año 1, excluyendo la fase de inversión | `fcfeAcumDe` sumaba desde t=1 | Se proponían dividendos pagables en el año 1 (107,3 kUSD) con la empresa aún sin recuperar caja (acumulado −824,3 kUSD): reparto imposible de pagar | La caja acumulada pasa a ser el FCFE acumulado DESDE el año 0 (identidad `caja = indicadores.fcfeAcumulado` en todos los años); `pagables = MIN(propuestos, max(0, caja))` | §16.3 (identidad caja, identidad MIN, `DIVIDENDOS_RESTRINGIDOS`), §8 |
| AUD-04 | Vocabulario del motivo de recuperación incompleto («Interpolación lineal» con mayúscula; «no se recupera» en minúscula dentro de una frase genérica) | Redacción previa no alineada con §4.3 | El método de cálculo no quedaba explícito para el lector del plan (requisito metodológico) | Textos del motivo: «Se aplica interpolación lineal intranual: (t−1) + \|acumulado anterior\| / (acumulado actual − acumulado anterior)» y «No se recupera dentro del horizonte de análisis.» | §4.3/§16.3 (tres casos del cálculo de la recuperación) |
| AUD-05 | El análisis de ingresos/costos solo comparaba los EXTREMOS de la trayectoria (año 1 vs N): una caída intermedia quedaba invisible | `analisisIngresosCostos` comparaba únicamente `uai1` contra `uaiN` | El plan podía presentar una utilidad que «mejora» ocultando un descenso real intermedio (p. ej. año 7, por la depreciación de la ampliación), atribuyendo el riesgo a decisiones erróneas | Detección año a año de descensos de la UAI con frase «DESCIENDE en el año t (de X a Y kUSD)…» y advertencia de causas | §16.6 (ingresos a la baja: precios −40 % → caída del año 7 detectada y narrada) |
| AUD-06 | Mensajes de diagnóstico con punto decimal («faltan 472.0 kUSD», «(107.3 kUSD)») incoherentes con el formato es-ES del resto del documento | Construcción de mensajes con `toFixed(1)` en `engine.ts` y `controles.ts` | Incoherencia documental entre cifras del documento y del panel de alertas | Todos los mensajes usan `fmtK`/`fmtPct`/`fmtAnios` (mismo formateo que PDF/XLSX) | §3.1 («472,0»), §16.7 (unidades y monedas visibles), verificación de UI |
| AUD-07 | La suite §16.7 no cargaba (1 error): comillas simples anidadas en el título de una prueba | Error de sintaxis en `audit_export.test.ts` | 19 pruebas de exportación no se ejecutaban (falsa sensación de cobertura) | Corrección de la sintaxis; la suite quedó operativa | 19 pruebas §16.7 en verde |
| AUD-08 | La base de datos compartida rechazaba la plantilla «centro»: `plans_template_key_check` solo admitía `clinica`/`default` | La migración `0004_template_centro.sql` existía en el repositorio pero nunca se aplicó al Supabase remoto | Imposible crear el segundo proyecto (§17) en el espacio compartido: la generalización no era demostrable en la app real | Migración 0004 aplicada al remoto (script reproducible `scripts/aplicar-migracion.ts`); verificado creando el Centro desde la UI | Verificación de navegador (creación + edición + análisis del Centro) |
| AUD-09 | Datos/expectativas de pruebas inconsistentes con su propia documentación | Errores del trabajo en curso previo: (a) §16.1 sin el calendario de crédito de las entradas originales → UAI sin intereses (393,2 ≠ 369,2); (b) demanda 1.500 «muy superior» a 1.824 (era inferior); (c) vida útil 5 desde el año 3 con expectativa `[7]=0` (contradice la vida útil); (d) flujos no convencionales que no cruzaban el cero; (e) anclas publicadas (129,22) exigidas con precisión 2 sobre valores redondeados; (f) recuento de hojas y columnas de un XLSX anterior | Las pruebas no verificaban lo que decían verificar | Correcciones documentadas en el propio código de prueba con su justificación; el motor se validó además contra las cifras exactas completas | §16.1 (UAI 369,2 exacto 369,185; impuesto 129,2 exacto 129,21475), §16.2, §16.4, §16.7 |
| AUD-10 | El libro XLSX se re-comprimía con DEFLATE al inyectar `fullCalcOnLoad` | `activarRecalculoAutomatico` regeneraba el zip completo con compresión | El marcador de recálculo y las fórmulas no eran auditables en el archivo crudo (la prueba de auditoría de bytes fallaba) | El zip final se genera con compresión STORE (sin pérdida: el XLSX es válido y más auditable) | §16.7 (fullCalcOnLoad y «MAX(0» verificables en crudo), §16.5 |

**Criterio de la misión §1 respetado**: ninguna cifra final se fijó en el código. Los cambios de resultados (dividendos restringidos en los primeros años, ingresos del escenario A limitados) surgieron de corregir la lógica, no de editar importes.

---

## B. Informe del modelo financiero

### Flujos de caja (dos indicadores separados, misión §4)

- **FCFF (flujo del proyecto, decisiones de inversión)**: `FCFF_t = UDI_t + intereses devengados_t + depreciación_t − CAPEX de ampliaciones_t (+ liberación del capital de trabajo en el último año, si el parámetro lo indica)`. Los intereses se reincorporan por ser flujo del financiador; las amortizaciones del principal NO son gasto. **Año 0**: `FCFF_0 = UDI_0 − inversión total` (el resultado de montaje queda dentro; el CAPEX inicial es la inversión total).
- **FCFE (flujo de los socios, decisiones de financiación)**: `FCFE_t = FCFF_t − intereses pagados_t + desembolsos del crédito_t − amortización_t`. **Año 0**: `FCFE_0 = −aportaciones + UDI_0 + desembolso del crédito`.
- Con el crédito deshabilitado ambos flujos coinciden (demostrado por el Centro).

### Recuperación (§4.3)

- Interpolación lineal explícita sobre el acumulado: `payback = (t−1) + |acum_{t−1}| / (acum_t − acum_{t−1})` cuando `acum_{t−1} < 0 ≤ acum_t`.
- Casos distinguibles: recuperación dentro del horizonte; **fuera del horizonte** (`anios = null`, sin cifra aparentemente definitiva); **indeterminada** cuando el acumulado cambia de signo más de una vez (flujos no convencionales) con advertencia; falta de reglas con error explícito.
- El horizonte debe cumplir `N ≥ recuperación + 1` (se advierte en caso contrario).

### Depreciación (§5, por activo)

- Registro por activo con costo, moneda, disponibilidad, vida útil, residual y método lineal: `cuota = base × (1 − residual) / vida`.
- Solo deprecia desde su año de disponibilidad; la acumulada se limita a la base depreciable (`MIN(cuota, base − acumulada)`); activos sin vida útil o método «ninguno» quedan fuera y se reportan.
- Es gasto no monetario: se reincorpora UNA sola vez al flujo; las ampliaciones del escenario B generan calendarios nuevos desde su año.

### Deuda (§6)

- Calendario por año con desembolso, interés devengado, capitalización (gracia total), interés pagado, amortización y saldos. Invariante verificada: `saldo final = saldo inicial + desembolso + capitalización − amortización`; nunca amortiza por encima del saldo.
- Gracia de principal (intereses corrientes) o gracia total (intereses capitalizados); métodos: capital constante, sistema francés (PMT) y pago único. Todos los parámetros (monto, tasa, gracia, plazo) son editables y viajan a la hoja Deuda del XLSX.

### Capital de trabajo (§4.4)

- El desembolso inicial forma parte de la inversión total. Su liberación al final NO se supone: solo entra si `pct_recuperacion_capital_trabajo > 0` (regla explícita, advertida como supuesto parametrizado).

### Dividendos (§8)

- `saldoAcumulable` absorbe pérdidas previas (incluida la de montaje del año 0) → `base = max(0, UDI + saldo previo)` → `reserva legal (10 % demostrativo)` → `distribuible` → `propuestos = distribuible × pct_reparto (50 % demostrativo)`.
- **Caja = FCFE acumulado desde el año 0, antes de repartos**; `pagables = MIN(propuestos, max(0, caja))`; participación de cada socio (40 % cubana demostrativa) ≠ porcentaje de reparto. Los recortes generan `DIVIDENDOS_RESTRINGIDOS` con importe y explicación.

### Impuestos (§16.5)

- Regla demostrativa editable: `impuesto = MAX(0, UAI × tasa)` con la tasa como PARÁMETRO (35 % inicial, supuesto declarado con `TASA_DEMO`); resultados negativos tributan cero. El cambio 35 % → 30 % recorre impuesto, UDI, flujos, recuperación, análisis y exportaciones.

### Monedas y redondeo (§3.2)

- CUP y USD nunca se suman sin convertir: las partidas en CUP (p. ej. costo laboral, inversiones del Centro) se convierten UNA vez con `tipo_cambio` (supuesto documentado; 400 CUP/USD en el momento de la auditoría, actualizado a 743 CUP/USD en UX-002 por indicación del propietario). Precisión interna completa; redondeo únicamente en presentación (es-ES, un decimal, miles con punto).

---

## C. Plantilla clínica final — «Sonrisa Habana»

Plantilla precargada coherente (escenario B activo: sin excesos de capacidad; el escenario A sí alerta). Cifras del modelo activo:

- Inversión inicial: **1.480,0 kUSD** (gastos previos 45,0 + inversión fija 1.200,0 + capital de trabajo 235,0); financiación exacta: aportaciones 1.180,0 (708,0 extranjero + 472,0 nacional) + crédito 300,0.
- Ingresos año 1: **967,8 kUSD** · costos variables 254,8 · costo laboral 38,3 (15 312 000 CUP convertidos una vez).
- **UAI año 1: 369,2** (exacto 369,185) · impuesto 35 %: **129,2** (exacto 129,21475) · **UDI: 240,0** · FCFF año 1: **381,1** (UDI + 24,0 intereses + 117,125 depreciación).
- **Recuperación: 3,5 años (proyecto) y 3,3 años (socios)** — la cifra vieja de «4,0 años» era defectuosa (mezclaba utilidad neta con amortizaciones contra la inversión total).
- Depreciación por activo: 9 activos, deprecia desde disponibilidad (año 1), máximo 125,1 en el año 7 (ampliación), 2 activos con VNL al cierre (advertido).
- Deuda: 300,0 al 8 %, gracia de principal 1 año, capital constante 5 anualidades; intereses totales 96,0; saldo 0,0 al año 6; servicio máximo 84,0 (año 2).
- Dividendos: propuestos desde el año 1, **pagables 0,0 mientras la caja acumulada es negativa** (años 1-3) y recortados hasta que la caja cubre; `DIVIDENDOS_RESTRINGIDOS` lo explica con importes.
- Beneficios al país conciliados resumen↔tabla: **4.399,6 kUSD período completo / 4.398,2 explotación** (impuestos 2.309,4 + fuerza de trabajo + dividendos cubanos 1.177,3 + canon + aranceles + otros impuestos; sin doble contabilización; año 0 solo montaje).

---

## D. Evidencias de pruebas

**Suite automatizada: 176/176 en verde (2.886 verificaciones, ~3,3 s)** — `bun test`:

| Suite | Pruebas | Epígrafes de la misión |
|-------|---------|------------------------|
| engine.test.ts | 44 | Núcleo: parámetros, reglas editables, validaciones, anclas de la plantilla |
| audit_regresion.test.ts | 17 | §16.1 (cifras visibles originales) + §3.1 (conciliación inversión/financiación) |
| audit_depreciacion.test.ts | 11 | §16.2 (calendario por activo, disponibilidades, residual, reincorporación única) |
| audit_flujos.test.ts | 16 | §4.3/§16.3 (interpolación, fuera de horizonte, no convencionales, FCFF/FCFE, caja de dividendos) |
| audit_capacidad.test.ts | 13 | §16.4 (precio, cantidad, gabinetes, horario, duración, profesionales, escenarios, cascada) |
| audit_tributario.test.ts | 9 | §16.5 (35 % → 30 %: cascada completa en cifras, textos, PDF y XLSX) |
| audit_analisis.test.ts | 14 | §16.6 + §12.13 (reacción de los textos; trazabilidad generado/manual/desactualizado) |
| audit_export.test.ts | 19 | §16.7 (PDF/XLSX/JSON: totales, índice, fórmulas, caché, controles, sin valores antiguos) |
| audit_generalizacion.test.ts | 13 | §17 (Centro «Imagen Habana» + plantilla Default) |
| xlsx.test.ts | 16 | Estructura del libro (22 hojas), fórmulas reales, recálculo |
| pdf.test.ts | 7 | Documento exportable, índice, advertencia, cifras del modelo |

**Verificación en navegador (estático, autenticación real contra Supabase)**: landing → login (colaborador1) → proyectos compartidos → plan clínica: cifras corregidas en 4.7 (UAI 369,2 / impuesto 129,2 / UDI 240,0 / 1.480,0 con miles agrupados), alertas con los CUATRO niveles (0 errores / 0 advertencias / 0 pendientes / 6 observaciones, incluida la explicación de dividendos restringidos), vista previa documental dedicada (recuperaciones 3,5/3,3 años, resumen con 4.399,6), creación y análisis propios del Centro (2.265,0 / 4,6 años / sin crédito / escenario A). Capturas en `docs/capturas/captura-audit-*.png`.

**Verificación de base de datos**: migración 0004 aplicada y restricción verificada (`clinica`/`default`/`centro`); planes de verificación eliminados (entrega prístina: 0 planes, 0 versiones huérfanas).

**Incidencias pendientes**: (1) el proceso de `bun test` a veces no termina tras completar todas las pruebas (los resultados se emiten íntegros en ~3 s; el síntoma no afecta resultados y se documenta como pendiente de investigación); (2) las contraseñas de los colaboradores siguen siendo las de prueba («1»/«2») — deben cambiarse antes de un uso real.

---

## E. Demostración de generalización — Centro de Diagnóstico «Imagen Habana»

Segundo proyecto con estructura de negocio DISTINTA, construido con las mismas reglas de fábrica (cero fórmulas nuevas; la plantilla solo aporta datos):

- Inversión extranjera total (sin socio cubano), 6 líneas de servicios de imagen, **horizonte 8 años** (≠10), **sin crédito** → FCFF = FCFE y una sola recuperación, tasa de demostración **30 %** (≠35 %), un aporte en **CUP** convertido una vez, activo «Resonancia magnética 1.5 T» **disponible desde el año 3** (no deprecia antes; la depreciación total alcanza su máximo de 214,6 en el año 3).
- Inversión **2.265,0 kUSD** · ingresos año 1 **822,6** · UAI 300,2 · UDI 210,1 · **recuperación 4,6 años** · horizonte ≥ recuperación + 1.
- Escenario A (capacidad constante) declarado en el análisis; los análisis se generan desde los resultados propios del Centro (verificado en pruebas y en la UI).
- La plantilla Default permite además un tercer negocio arbitrario (probado con «Servicios técnicos industriales», 6 años, un servicio).

---

## F. Estado de las exportaciones

- **PDF** (`jsPDF`, doble pasada): índice con numeración real, secciones 4.1–4.12, cifras del modelo activo en es-ES («1.480,0», «3,5 años»), advertencia de datos ficticios, sin valores antiguos («4,0»/«cuatro años» ausentes); se regenera distinto al cambiar la tasa (30 % visible). Verificado byte a byte contra el modelo.
- **XLSX** (`xlsx-js-style` + inyección `fullCalcOnLoad`, zip STORE auditable): **22 hojas** con fórmulas reales y referencias entre hojas (Depreciacion, Deuda, FlujosCaja, Dividendos, Capacidad), valores en caché idénticos al motor, impuesto dependiente de `Parametros!$C$` (al cambiar la celda y recalcular, produce `0,30 × UAI`), Controles con los CUATRO niveles y las 7 dimensiones, Resumen con recuperaciones en texto del modelo vigente. Los casos no traducibles quedan documentados, nunca sustituidos en silencio.
- **JSON** (esquema versionado 2.0.0): conserva datos, parámetros, reglas, análisis editados con autoría y huellas; round-trip completo verificado (recalcula idéntico) e import como plan compartido operativo.

---

## G. Limitaciones

Ninguna parte de la aplicación valida cumplimiento legal, tributario, sanitario ni de inversión; la estructura documental NO equivale a validación normativa. Pendientes de validación externa antes de un uso oficial:

1. **Tasa del impuesto sobre utilidades**: 35 % (clínica) y 30 % (centro) son supuestos de demostración editables; documentar la tasa legal aplicable con su fuente normativa vigente.
2. **Tipo de cambio**: 743 CUP/USD (tasa ilustrativa pendiente de validación oficial), supuesto editable; documentar tipo de cambio oficial y fecha.
3. **Licencias y autorizaciones**: licencia sanitaria (MINSAP), registro de la empresa (Registro Mercantil), autorizaciones ambientales, CEPEC/DAMN según la modalidad; la app exige completar los campos pero no verifica documentos.
4. **Mercado**: demanda aparente/solvente y captación son supuestos ilustrativos sin fuente verificada; una propuesta real exige investigación primaria con fecha.
5. **Avalúos**: activos aportados (fijos, circulantes, derechos) requieren certificación (Dirección de Patrimonio del MFP cuando corresponda) y conciliación documental con el inventario de inversiones.
6. **Distribución de beneficios**: los porcentajes (reserva 10 %, reparto 50 %, participación cubana 40 %) son política demostrativa; validar la regla jurídica aplicable a la modalidad (Ley 118/2014, Decreto-Ley 335/2018 y normativa complementaria).
7. **Seguridad**: las contraseñas de los colaboradores de prueba deben sustituirse; la autenticación es Supabase Auth (server-side), pero el espacio compartido queda expuesto a quien posea credenciales válidas.
