# PLANEX-DATA-001 — Incorporación documental del proyecto real Holguín

**Misión:** transformar el expediente del ZIP adjunto (Planex.zip, 9 fuentes, sha256 `e47e7b31…839b25`) en la fuente documental de un plan de negocios profesional, trazable campo a campo, editable en PLANEX, con informe de brechas y PR sin fusionar.

**Rama:** `feat/planex-data-001-incorporacion-documental` (desde `main` = d85b804, merge del PR #10/DOC-003-R2, CI verde).

---

## 1. Qué se hizo (resumen ejecutivo)

1. **Inventario e inventario estructurado de las 9 fuentes** (texto + tablas + conversión LibreOffice de los .doc legacy), con huellas SHA-256, tamaño, fecha, estado de lectura y limitaciones por fuente (`src/lib/planex/data/holguin/fuentes.ts`). El directorio de trabajo con los ORIGINALES vive fuera del repositorio; los documentos no se copian al repo y los datos de contacto personal no se incorporaron.
2. **Registro central de información fidedigna** con 62 datos: valor literal, valor normalizado, unidad, período, fuente, localizador, categoría de confianza (A confirmado 26, B derivado 4, C provisional 11, D contradictorio 9, E pendiente 11, F 1), fórmula conservada en los derivados, tratamiento previsto y observaciones (`registro.ts`).
3. **Matriz de cobertura medible** de los 12 epígrafes (4.1–4.12) con censo de campos y denominadores explícitos: 47 campos censados, 26 completos (55,3 % de los 47 obligatorios), 15 parciales, 6 pendientes, 4 dinámicos (`cobertura.ts`). La cobertura se MIDE desde el registro; no se declara.
4. **Catálogo de contradicciones y brechas** derivado del mismo registro: 17 contradicciones (1 crítica, 5 altas) con ambos valores y localizadores; 27 brechas (3 bloqueantes) con qué falta, por qué, qué se pide, responsable, prioridad, dependencias y criterio objetivo de cierre; 8 validaciones normativas pendientes y un plan de cierre en 5 bloques secuenciados (`brechas.ts`).
5. **Plantilla especializada «Centro Estomatológico Internacional Holguín»** (`templates/holguin.ts`): AEI entre CSMC, S.A. y Leisure Exporting LLC; 15 servicios documentados (precios USD = CUP÷120, demanda mensual del expediente), 5 equipos cotizados (5 274,00 USD), gastos previos (26,20 kCUP), aportaciones (efectivo 1 600 kCUP + insumos 63 581,30 USD + equipos 5 274 USD), plantilla de 10 trabajadores con salarios derivados (fórmula conservada), impuesto 15 % solo años 8–10 (patrón del expediente), sin crédito, sin capacidad inventada, campos sin evidencia marcados `[Pendiente: …]`. Cada dato cita su entrada H-###.
6. **Vista «Expediente documental» en la app** (sección ED, visible solo en el proyecto Holguín): cobertura por epígrafe, contradicciones, brechas con plan de cierre, validaciones, inventario de fuentes con huellas y registro navegable, con exportación del informe PDF (`components/planex/Expediente.tsx`).
7. **Informe PDF obligatorio** «PLANEX_Informe_Brechas_Documentales_Centro_Estomatologico_Internacional_Holguin_2026-10-27.pdf» (46 páginas): compuesto CON EL MISMO COMPOSITOR EDITORIAL del plan (doble pasada, índice paginado, justificación real, tablas corporativas), con portada, 10 secciones y 5 anexos, generado desde los MISMOS módulos de datos que la vista de la app (`data/holguin/informe.ts`, `io/informe-brechas.ts`).
8. **Plan actualizado exportado** en PDF/DOCX/XLSX desde el modelo recalculado (`docs/expediente-holguin/`), con marcadores de pendiente y sin presentar supuestos como hechos.
9. **Pruebas**: 56 pruebas nuevas (`tests/planex/data001.test.ts`) que cubren los 12 apartados obligatorios de §9 de la misión; suite completa 460/460; `tsc` 0; `eslint` 0; `next build` OK.
10. **Migración 0005** para admitir `template_key = 'holguin'` en Supabase (aplicación remota pendiente de las credenciales del propietario; error de restricción capturado en la UI con instrucción accionable).

## 2. La contradicción crítica (C-01) y el resultado del modelo

El expediente usa **dos tasas de cambio simultáneas**: 24 CUP/USD en TODOS los encabezados de sus tablas (inversión, insumos, conversión de totales «MUSD») y 120 CUP/USD en la lista de precios de los servicios (confirmada por F09: TPR 80,00 USD/caso, blanqueamiento 150,00 USD/caso = CUP÷120). A los precios y costos REALES de lista/cotización:

- Ingresos anuales: **115 814,00 USD** (13 897,68 kCUP a 120) — concilia exactamente con la tabla del expediente.
- Materiales anuales (desde el año 2): **127 162,60 USD** (el doble del stock semestral cotizado).
- El costo material EXCEDE los ingresos: **el margen operativo es negativo** (UAI año 1 = −47,66 kUSD) y la inversión no se recupera en el horizonte.

La rentabilidad que declara el expediente (VAN 24 709,58 / TIR 1387,85 % / 0,84 años del resumen; VAN 20 771,60 / TIR 904,02 % / 0,92 del anexo — además incompatibles ENTRE SÍ, C-02) existe solo en el marco CUP con la tasa 24 valorando los insumos importados. La plantilla fija 120 (evidenciada por la lista de precios), conserva la 24 como contradicción documentada y NO adopta los indicadores del expediente. **La decisión de tasa corresponde al promotor con sustento normativo (V-07) y un solo parámetro la recalcula.** Este bloqueo se exhibe en la app (diagnóstico), en la plantilla (textos y fuentes de parámetros) y en el informe (secciones 1 y 7).

## 3. Otras contradicciones principales registradas (no resueltas en silencio)

- **C-06** El EERR del expediente carga la depreciación ACUMULADA (12,8→75,9 kCUP; total 417,7) como gasto del período en lugar de la anual (7,6): subestima la UAI de los años 2–10.
- **C-07** Tres versiones de salarios: plantilla 146 000 CUP/mes (F08 p. 21), EERR 360 000 implícitos (4 320 kCUP/año) y escala básica de F07 (5 750/4 210/2 810). La plantilla adopta la ESTRUCTURA de plantillas + el TOTAL del EERR con fórmula conservada (factor 2,6984 en plazas cubanas; extranjero a su valor exacto documentado 240 kCUP/año); ambas cifras permanecen visibles.
- **C-08** Escáner intraoral 3D cotizado en F02 (12 035,00 USD) pero ausente del modelo de inversión (5 274,00 USD): decisión del promotor (B-07).
- **C-11** La página de financiamientos resta aportes (3 252,53) de inversión (152,78) y declara necesidad 0,00; el estado de situación convierte el excedente en caja inicial (los insumos aportados en especie contados como efectivo).
- **C-05** Reparto 50/50 pactado en el contrato frente a participación 49/51 de la tabla de aportes (el diagnóstico de la app lo señala en cada recálculo).
- **C-13/C-17** Rótulos «MCUP/MUSD» usados para cifras en MILES (interpretación documentada); «salario de trabajadores cubanos» del beneficio país incluye el salario del directivo extranjero.
- Domicilio de Leisure Exporting LLC con dos versiones (C-09); tres abreviaturas de la entidad cubana SMC/CSMC/CMSM (C-10); ingresos del año 2+ un 4,95 % menores sin explicación (C-14); impuesto 15 % solo años 8–10 sin base legal citada (C-15); materiales del año 1 por 6 meses frente a 12 meses de ingresos (C-16).

## 4. Decisiones de modelado documentadas (todas reversibles en la app)

| Decisión | Base documental |
|---|---|
| Tipo de cambio 120 (parámetro editable, fuente citada) | Lista de precios CSMC «1×120» + F09 (H-025) |
| Servicios en USD nativo (precio = CUP÷120) | Tabla 4 del expediente y F09 (H-037) |
| Costo variable unitario = precio × 1,09805 | Reparto provisional proporcional que preserva el total cotizado (127 162,60 USD/año); fórmula en H-040, brecha B-13 |
| Salarios derivados (factor 2,6984 cubanos; extranjero exacto) | Estructura F08 p. 21 + total EERR (H-035/H-036); fórmula en H-091 |
| Impuesto 15 % años 8–10 por regla editable `IF(PERIODO >= 8, …)` | Patrón del EERR (H-033); SIN base legal — B-16 |
| Gastos previos en CUP: expresión extendida A NIVEL DE PLANTILLA | La regla de fábrica solo suma USD: sin la extensión, las 26,20 kCUP se perderían en silencio (hallazgo §6) |
| Sin recursos operativos ni duraciones (capacidad no inventada) | El expediente no aporta horas/duraciones (B-10): la demanda circula y el diagnóstico lo marca |
| Canon 0, públicos 0, mantenimiento 0, admin 0 % | EERR del expediente: partidas en 0,0 (H-041/H-048); brechas B-18/B-19 documentadas |
| Participación 50 % (reparto del contrato) | Cláusula 7.5 (H-013); incoherencia 49/51 visible (C-05) |

## 5. Verificaciones ejecutadas

- **Pruebas**: suite completa **460/460** (404 previas + 56 nuevas), 84 849 comprobaciones; tsc 0 errores; eslint 0; `next build` OK (build estático, export `out/`).
- **Entregables regenerados** desde los módulos finales: informe PDF (46 págs), plan PDF (31 págs), plan DOCX (83,8 KiB), libro XLSX con fórmulas (489,1 KiB) — `docs/expediente-holguin/`.
- **Auditoría de los PDF generados** (PyMuPDF): informe sin páginas con densidad <12 % (media 0,391), índice funcional con numeración real, encabezado propio («INFORME DE ANÁLISIS DOCUMENTAL») y pie propio; plan: única página de baja ocupación justificada como «cierre documental» por el propio diagnóstico del compositor; 0 bloques de texto más allá del margen derecho en ambos documentos.
- **Regresión DOC-003 intacta**: la plantilla clínica produce las mismas cifras (inversión 1 480,0 kUSD; ingresos año 1 967,8; recuperación 4,0/3,22 años) y el mismo comportamiento editorial; las 404 pruebas previas pasan sin modificación.
- **Round-trip JSON** del proyecto documental: plantilla, fuentes, expresiones de regla y cifras conservadas; el modelo recalcula idéntico.

## 6. Hallazgos de la aplicación (más allá del expediente)

1. **Regla `gastos_previos_k` de fábrica**: solo suma partidas en USD; una partida de gastos previos en CUP introducida por cualquier usuario se IGNORARÍA en silencio. El proyecto Holguín extiende la EXPRESIÓN a nivel de plantilla (mecanismo diseñado, preservado en el round-trip). **Propuesta al propietario**: extender la regla de fábrica — exige recalcibrar la línea base editorial de DOC-003 (la fórmula se renderiza en las fichas de trazabilidad del plan de regresión y cambia el reflow; medido: cola del documento a 18 %). No se aplicó para no alterar la regresión sin autorización.
2. **Encabezado/pie del compositor hardcodeados** para el plan («PLAN DE NEGOCIOS» / pie GOC-2026-O57). Añadidos `meta.tituloCorriente` y `meta.marcaPie` OPCIONALES con fallback exacto al comportamiento previo: cero riesgo de regresión, y el informe de brechas usa SU propio título.
3. **Limitación del compositor** (varado apaisado): un bloque liviano vertical que no cabe en su página y precede a un grupo apaisado queda varado en una página propia (plan Holguín p. 12 al 18,7 %: análisis de deuda y depreciación tras una tabla que llena la página y antes de la proyección apaisada). La absorción apaisada existente (R1/R2) solo absorbe livianos POSTERIORES al grupo. Propuesta: mecanismo de deferral de livianos previos; no se implementó en esta misión por riesgo de regresión en la línea base editorial (hallazgo documentado, no oculto).
4. **Migración 0005 pendiente de aplicar** en la BD remota (requiere `.env.admin.local` del propietario); la UI la detecta y muestra la instrucción exacta si se intenta crear el plan compartido Holguín.

## 7. Limitaciones y estado honesto

- El plan Holguín queda en **evaluación preliminar** marcada en portada, avisos, conclusiones y encabezado de la app: mientras C-01 (tasa), C-05 (reparto), C-06 (depreciación del expediente) y C-07 (salarios) no tengan decisión escrita del promotor, ningún resultado es presentable oficialmente.
- La cobertura medida (55,3 % de campos obligatorios con evidencia suficiente) NO es «80 %»: la hipótesis inicial de la misión se sustituyó por la medición por campos con denominadores explícitos (sección 5 del informe PDF).
- El cronograma del anexo del expediente tiene marcas gráficas ilegibles (F08 p. 17): las fechas del modelo quedaron como colocación provisional editable y marcadas (B-14). El análisis de sensibilidad del expediente está roto (variaciones 0,0) y no se reprodujo.
- No se verificó normativamente ninguna tasa, exención ni licencia: las 8 validaciones (V-01…V-08) son pedidos concretos con norma invocada, evidencia existente y documento faltante.
- Los datos de contacto personal (teléfonos/correos de personas naturales) del expediente NO se incorporaron al repositorio (prueba §9.11 lo verifica por patrón).

## 8. Entregables del PR

- `src/lib/planex/data/holguin/` — fuentes (inventario con SHA-256), registro (62 datos A–F), cobertura (matriz medible), brechas (17 C + 27 B + 8 V + plan de cierre), informe (constructor del documento).
- `src/lib/planex/templates/holguin.ts` — plantilla documental trazable.
- `src/components/planex/Expediente.tsx` + integración en `PlanexApp.tsx`, `Proyectos.tsx`, `comunes.tsx` (aviso documental), secciones y store.
- `src/lib/planex/io/informe-brechas.ts` + `componerDesdeModeloConIndice` y metadatos de documento en `pdf.ts`/`modelo.ts`.
- `supabase/migrations/0005_template_holguin.sql`.
- `scripts/exportar_informe_brechas.ts` (regeneración de los 4 entregables con un comando).
- `tests/planex/data001.test.ts` (56 pruebas).
- `docs/expediente-holguin/` — informe PDF (46 págs), plan PDF/DOCX, libro XLSX.
- Este informe de misión.

**Sin fusión, sin despliegue, sin push a `main`: decisión del propietario.**
