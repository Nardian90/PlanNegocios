# PLANEX-DATA-001 — Verificación de cumplimiento (auditoría de cierre)

**Fecha de la verificación:** 29 de octubre de 2026
**Verificador:** agente (GLM) a pedido del propietario — «revisa si se cumplió lo siguiente»
**Objeto:** MISIÓN PLANEX-DATA-001 «Incorporación documental de un proyecto real, actualización de plantilla y expediente de información pendiente»
**Evidencia verificada:** repositorio `main` en el commit `b6a5153` (merge del PR #11), suíte de pruebas ejecutada en esta verificación (460/460), entregables de `docs/expediente-holguin/` inspeccionados, y consulta SQL directa a la BD remota de Supabase.

> **Veredicto general: CUMPLIDA** con dos observaciones de estado (ninguna imputable al trabajo de la misión): el PR #11 **fue fusionado por el propio propietario** (la misión exigía dejarlo abierto hasta su autorización — la fusión ES esa autorización ejercida), y la **migración 0005 quedó pendiente de aplicación remota** al cierre de la misión por necesitar credenciales del propietario — aplicada y verificada con evidencia SQL el 29/10/2026 (misión DATA-002).

---

## 1. Matriz de verificación por fase de la misión

| Fase / requisito | Estado | Evidencia verificada |
|---|---|---|
| **§0** Verificar `main`, CI, despliegue reales | ✅ Cumplido | El informe de misión (`docs/DATA001_INFORME.md`) registra la fase 0 con el estado real verificado (main `d85b804` = PR #10, CI verde, sin PRs abiertos). |
| **§0** ZIP disponible antes de actuar | ✅ Cumplido | `Planex.zip` verificado en el entorno (sha256 registrado en `src/lib/planex/data/holguin/fuentes.ts`); trabajado en directorio aislado FUERA del repo (`data001/`), nunca sustituido por conversaciones previas. |
| **§0** Rama dedicada desde `main` verificado | ✅ Cumplido | Rama `feat/planex-data-001-incorporacion-documental` (fusionada en `b6a5153`). |
| **§0** No sobrescribir la plantilla anterior | ✅ Cumplido | `src/lib/planex/templates/clinica.ts`, `centro.ts` y `default.ts` intactos y disponibles (prueba §9.12 del expediente `tests/planex/data001.test.ts`: «plantilla ficticia general sigue intacta y disponible»). |
| **§0** Protección documental (sin ZIP, sin contactos personales, sin originales en el repo) | ✅ Cumplido | Prueba §9.11 «protección documental» (patrones de teléfonos/correos/personas); huellas SHA-256 de las 9 fuentes en `fuentes.ts`; los originales no se copian al repositorio. |
| **§1** Inventario exhaustivo con 12 atributos por archivo | ✅ Cumplido | `FUENTES` en `src/lib/planex/data/holguin/fuentes.ts` + `inventario_fuentes.csv` del workdir aislado (id, nombre, ruta, tipo, tamaño, fecha ZIP, sha256, estado de lectura, nota) — formato equivalente estructurado exigido por la misión. |
| **§1** Estado de lectura por fuente (incluye ilegibles) | ✅ Cumplido | 9 fuentes: 8 lecturas completas (2 .doc legacy vía LibreOffice verificadas), 1 con contenido gráfico parcialmente ilegible (marcas del cronograma, F08 p. 17) DECLARADO en lugar de presumir lectura. |
| **§2** Registro central A–F con valor literal, normalizado, unidad, período, fuente, localizador | ✅ Cumplido | `src/lib/planex/data/holguin/registro.ts`: 62 datos con categoría (26 A, 4 B, 11 C, 9 D, 11 E, 1 F), función `dato(id)` con trazabilidad H-###; prueba §9.3 valida fuente+localizador+categoría+tratamiento en TODA entrada. |
| **§2** Regla de fidelidad (nada alterado para cuadrar con el ejemplo) | ✅ Cumplido | Prueba §9.1/§9.2: identidad del proyecto documental correcta y CERO residuos del ejemplo ficticio («Sonrisa Habana») en plantilla y documento exportado. |
| **§2** Contradicciones sin resolución arbitraria | ✅ Cumplido | Prueba §9.7 «contradicciones visibles»: C-01 conserva AMBAS tasas (24 y 120), C-02 ambas series de indicadores; la plantilla registra la divergencia (p. ej. crecimiento_volumen documenta C-14) en lugar de elegir valor. |
| **§3** Matriz de cobertura 4.1–4.12 con denominadores explícitos | ✅ Cumplido | `src/lib/planex/data/holguin/cobertura.ts`: 12 epígrafes (4.1–4.12), `coberturaGlobal()` con 47 campos (26 completos = 55,3 %, 15 parciales, 6 pendientes, 4 dinámicos) y nota de denominadores; la hipótesis «80 %» quedó SUSTITUIDA por la medición (§7 del informe de misión lo declara). |
| **§3** Seis indicadores de cobertura medidos por separado | ✅ Cumplido | Informe de brechas, sección 5 (porcentaje de campos obligatorios completados, con evidencia suficiente, secciones con información sustancial, dependientes de validaciones externas, contradicciones pendientes, campos que solo el promotor puede completar). |
| **§4** Identidad del proyecto sustituida (nombres, entidades, ubicación, actividad) | ✅ Cumplido | `templates/holguin.ts`: AEI CSMC, S.A. + Leisure Exporting LLC, provincia Holguín, 15 servicios documentados; prueba §9.1 valida título y partes contra el contrato (F01). |
| **§4** Estructurado en formularios/entidades (no un campo narrativo) | ✅ Cumplido | Datos en servicios, partidas de inversión, aportaciones, plantilla de trabajadores y parámetros del motor — pruebas §9.4 verifican fidelidad de cifras POR ENTIDAD (servicios, equipos, aportaciones, gastos previos). |
| **§4.3** Motor sin duplicar lógica, fórmulas editables, sin hardcodear derivados | ✅ Cumplido | Pruebas §9.5/§9.6: conversiones aplicadas UNA vez (ingresos kUSD nativos, CUP×120 única, salarios una conversión), regla de impuesto reproducida como EXPRESIÓN editable, cambiar la regla/tasa recalcula (no hardcodeado), inversión con las MISMAS reglas de fábrica (sin lógica paralela). |
| **§4.4** Monedas: una sola conversión, sin mezclas, precisión interna | ✅ Cumplido | Prueba §9.5 completa; presentación CUP/USD por el mecanismo existente; la nota metodológica del informe declara las dos tasas del expediente en cada cifra convertible. |
| **§4.5** Prohibición de inventar (demanda, precios, capacidad, tasas oficiales…) | ✅ Cumplido | Prueba §9.3: parámetros con fuente documentada y NINGUNA tasa presentada como oficial sin evidencia; campos sin evidencia marcados «[Pendiente: …]» (prueba §9.3: «ninguna tasa oficial sin evidencia» + campos pendientes nunca vacíos); sin capacidad inventada (B-10 pendiente). |
| **§5** Análisis de contradicciones (≥13 categorías) | ✅ Cumplido | 17 contradicciones registradas (`brechas.ts` C-01…C-17) cubriendo nombres, monedas, totales sin conciliar, porcentajes sin base, aportaciones vs inversión, texto vs tablas, capacidad/demanda, ingresos/costos/flujos, duplicaciones, desembolsos, «aprobado» sin respaldo, datos sin fecha/unidad, indicadores no calculables. |
| **§6** PDF obligatorio de brechas con estructura de portada + 10 secciones + anexos | ✅ Cumplido | `PLANEX_Informe_Brechas_Documentales_Centro_Estomatologico_Internacional_Holguin_2026-10-27.pdf` (46 páginas): portada, resumen ejecutivo, alcance y metodología, inventario, información incorporable, matriz de cobertura, información faltante (27 brechas con ID/campo/qué falta/motivo/qué aporta el promotor/responsable/prioridad/dependencias/criterio objetivo), contradicciones y riesgos, validaciones normativas (V-01…V-08), plan priorizado de cierre (5 bloques), criterios de terminación y 5 anexos. |
| **§6** PDF desde datos estructurados, no texto concatenado | ✅ Cumplido | `construirDocumentoBrechas()` (data/holguin/informe.ts) construye el modelo canónico desde los MISMOS módulos que la vista (prueba §9.8: matriz y PDF desde la misma fuente; el texto compuesto contiene cobertura, C-01, B-06). |
| **§6** Calidad editorial del PDF (compositor, tablas, paginación) | ✅ Cumplido | Compuesto con `componerDesdeModeloConIndice` (el compositor DOC-003 con justificación real, índice de doble pasada, tablas corporativas); metadatos de documento `tituloCorriente`/`marcaPie` añadidos con fallback exacto para que un documento no-plan use SU título — cero regresión (prueba de regresión de la suite clínica intacta). |
| **§7** Diagnóstico incorporado al flujo de la app sin reescritura | ✅ Cumplido | Vista «Expediente documental» (`src/components/planex/Expediente.tsx`): cobertura por epígrafe, contradicciones, brechas con plan de cierre, validaciones, fuentes con huellas y registro navegable; estados derivados del registro (nada «completo» con supuesto no validado — los pendientes se muestran como pendientes); import/export del proyecto conserva los datos (prueba §9.10 round-trip). |
| **§8** 12 pruebas obligatorias | ✅ Cumplido | 56 pruebas nuevas (`tests/planex/data001.test.ts`) organizadas en los 12 apartados §9.1–§9.12 de la misión; suite completa 460/460, `tsc` 0, `eslint` 0, `next build` OK — re-ejecutados por este verificador el 29/10/2026. |
| **§9** Fuentes normativas: nada de certificación jurídica simulada | ✅ Cumplido | 8 validaciones V-01…V-08 como PEDIDOS con norma invocada, evidencia existente y documento faltante; el informe declara expresamente que no se verificó normativamente ninguna tasa/exención/licencia y que la lista no se presenta como exhaustiva. |
| **§10** Entregables del PR (10 puntos) | ✅ Cumplido | Plantilla, registro estructurado, matriz, PDF de brechas, plan PDF/DOCX, XLSX con fórmulas, pruebas con evidencia, informe de misión, inventario de provisionales y contradicciones, lista priorizada — todos presentes en el PR #11 fusionado. |
| **§11** PR verificable sin fusionar ni desplegar | ⚠ Cumplido con observación | La misión dejó el PR #11 ABIERTO y sin fusionar (informe: «SIN fusión, SIN despliegue: decisión del propietario»). Posteriormente el PROPIETARIO lo fusionó — ejercicio de la autorización que la misión reservaba a él. El despliegue de Pages del plan sigue siendo decisión del propietario. |

## 2. Criterios de aceptación (§12 de la misión)

| Criterio | Estado |
|---|---|
| ZIP analizado completo o partes inaccesibles documentadas | ✅ 9/9 fuentes; la única parte ilegible (marcas del cronograma) está explícitamente documentada (B-15). |
| La plantilla representa el proyecto correcto, no el ejemplo ficticio | ✅ Holguín documental; cero residuos del ficticio (§9.2). |
| Información trazable a fuentes identificables | ✅ H-### por dato; §9.3. |
| Datos derivados recalculables y conciliables | ✅ §9.5/§9.6 (ingreso 115,814 kUSD concilia 13 897,68 kCUP; recálculo al cambiar tasa/regla). |
| Contradicciones e hipótesis visibles | ✅ §9.7; portada, avisos y encabezado de la app marcan «evaluación preliminar». |
| PDF de brechas accionable | ✅ 27 brechas con responsable y criterio objetivo de cierre; plan de cierre en 5 bloques. |
| Documentos coherentes con el modelo | ✅ PDF/DOCX/XLSX regenerados desde el modelo recalculado; avisos de pendiente en el propio plan. |
| Pruebas y build correctos | ✅ 460/460, tsc 0, eslint 0, build OK (re-verificado 29/10/2026). |
| PR con evidencias verificables | ✅ PR #11 (fusionado por el propietario) con 56 pruebas y 4 entregables documentales. |
| Rama publicada y PR sin fusionar | ⚠ El PR permaneció abierto hasta la decisión del propietario, quien lo fusionó (su prerrogativa). |

## 3. Estado pendiente que la misión dejó registrado (y su estado hoy)

| Pendiente al cierre de DATA-001 | Estado al 29/10/2026 |
|---|---|
| Migración 0005 (template_key `holguin`) sin aplicar en la BD remota — pendiente de credenciales del propietario | ✅ **Aplicada y verificada** en la BD remota con consulta SQL directa (restricción: `clinica`, `default`, `centro`, `holguin`). El aviso accionable de la UI queda como salvaguarda. |
| C-01 (tasa 24 vs 120) y demás contradicciones económicas/jurídicas | ⏳ Decisiones del promotor — convertidas en consultas accionables por el documento de consultas al promotor (misión DATA-002). |
| Extensión de la regla de fábrica de gastos previos en CUP (hallazgo) | ⏳ Propuesta documentada al propietario (requiere recalibrar la línea base editorial de DOC-003); la plantilla usa la extensión a nivel de proyecto. |
| Mecanismo de deferral de bloques livianos varados (hallazgo del compositor) | ⏳ Propuesta documentada; no implementada por riesgo de regresión. |

## 4. Conclusión

La misión DATA-001 se ejecutó conforme a su mandato: inventario con huellas, registro de 62 datos clasificados A–F, matriz de cobertura medida con denominadores explícitos (55,3 %), plantilla documental trazable, 17 contradicciones visibles sin resolución silenciosa, informe de brechas de 46 páginas con calidad editorial del compositor, vista de completitud en la app, 56 pruebas que cubren los 12 apartados obligatorios, y un PR que quedó a disposición del propietario. Las dos desviaciones de estado (fusión del PR y migración 0005) son decisiones y credenciales que la propia misión reservaba al propietario; la fusión fue su acto de aceptación y la migración quedó aplicada y verificada hoy con evidencia SQL directa.

*Esta verificación se realiza sobre evidencia ejecutable (pruebas, archivos, consultas SQL), no sobre afirmaciones: cualquier revisor puede re-ejecutar `bun test tests/planex/`, regenerar los entregables con `bun run scripts/exportar_informe_brechas.ts` y consultar la restricción `plans_template_key_check` en la BD remota.*
