# PLANEX Cuba — Informe de implementación y verificación

**Aplicación de página única para elaborar Planes de Negocios de propuestas con inversión extranjera (Gaceta Oficial GOC-2026-O57, epígrafes 4.1–4.12).**

---

## 1. Funciones implementadas

### Núcleo: motor de cálculo configurable (prioridad 1)
- **Motor independiente de la interfaz** (`src/lib/planex/engine/`): tokenizador → parser (AST) → evaluador **sin `eval()`** ni ejecución de código libre. Operaciones admitidas: `+ − * / ^`, paréntesis, `%` postfix, comparaciones, `AND/OR/NOT`, `IF` (con cortocircuito), `MIN/MAX/ABS/ROUND/SUM/POW`, `LAG(partida, años)` para referencias a años anteriores, y sumatorias por tabla `SUMA_SERVICIOS / SUMA_PERSONAL / SUMA_APORTACIONES / SUMA_INVERSIONES`.
- **Grafo de dependencias por ámbito** (servicio / personal / proyecto / año) con orden topológico, **detección de ciclos** y recurrencias legítimas (auto-referencias vía LAG).
- **Nivel A — 23 parámetros** editables (tasa de impuesto, tipo de cambio, interés, gracia, plazo, inflación, crecimientos de precios/volumen/salarios, porcentajes de admin/mantenimiento, canon, públicos, crédito, capital de trabajo, aranceles…), cada uno con nombre, descripción, valor, unidad, fuente, fecha de referencia, marca de supuesto demostrativo y **reglas que dependen de él**.
- **Nivel B — 40 reglas** con expresión editable, expresión de fábrica, historial (expresión anterior), habilitar/deshabilitar y auditoría (variables usadas, valores actuales, error si falla).
- **Regla demostrativa del impuesto**: `MAX(0, utilidad_antes_impuestos_k × tasa_impuesto_utilidades)` con tasa **35 % inicial editable** (supuesto de demostración, no tasa legal). Cambiar la tasa (35 % → 30 %) y cambiar la fórmula (base UAI → base ingresos) son **capacidades independientes, ambas implementadas y probadas**.
- Control de errores: sintaxis inválida, variables inexistentes, división por cero / no finito, dependencias circulares, reglas deshabilitadas con dependientes → **nunca se muestran valores falsos**: la partida se marca y explica el error; las exportaciones avisan antes de continuar.

### Plantillas (disponibles desde el primer uso)
- **Clínica Estomatológica**: ejemplo completo con datos ficticios coherentes (9 servicios; ingresos año 1 = 967,8 kUSD; inversión 1.480,0 kUSD = aportaciones 1.180 + crédito 300 al 8 % con gracia 1 y amortización 5; 27 trabajadores en operación; depreciación 117,125 kUSD/año; horizonte 10 años ≥ recuperación ≈ 4,0 + 1; beneficios al país acumulados ≈ 4.078 kUSD). Advertencia «EJEMPLO ILUSTRATIVO CON DATOS FICTICIOS…» visible en aplicación, previsualización, PDF y Excel.
- **Default**: estructura metodológica completa, formularios vacíos, **ayudas metodológicas por apartado** (texto fiel de la GOC-2026-O57) y reglas activas. Sin datos → issues «pendiente» indicando qué falta; no presenta resultados definitivos con datos inexistentes.
- Administración: crear desde plantilla, crear nuevo, abrir JSON, guardar copia independiente, restaurar plantilla de origen, avisos antes de sustituir datos no guardados. Las plantillas nunca se modifican: cada plan es un objeto independiente.

### Estructura metodológica 4.1–4.12
Información general (con declaración de responsabilidad), título, índice automático, resumen ejecutivo con cifras vinculadas al motor, descripción del negocio (modalidad, objeto, PNDES/EDT, inversionistas, **tabla de aportaciones** con advertencia de derechos reales/Dirección de Patrimonio MFP), aspectos técnicos (servicios con capacidad y alertas de exceso, consumos), análisis financiero (inversión, financiación con detección de insuficiencia/exceso, proyección por años, impuesto, flujo de caja, recuperación y gráfico), mercado, fuerza de trabajo (CUP, subtotales por grupo, entidad contratante), inversiones (vehículos y cronograma con barra visual), beneficios directos al país y conclusiones editables con borrador automático.

### Exportaciones e intercambio
- **Previsualización**: vista documental (hojas carta de fondo claro constante) con todas las secciones y tablas del modelo vigente + impresión.
- **PDF** (jsPDF + autoTable): 16 páginas en el ejemplo, portada, **índice con numeración a doble pasada**, encabezados repetidos en tablas, pies de página con paginación, texto seleccionable, advertencia ficticia en portada y pies, y cifras del modelo activo.
- **Excel** (xlsx-js-style): **18 hojas con fórmulas reales y referencias entre hojas** (Proyecciones ← Servicios/Personal/Inversion/Parametros/Financiacion; el impuesto es `=MAX(0,(D$22*Parametros!$C$3))`). Celdas de entrada en ámbar y fórmulas en verde; totales; `fullCalcOnLoad` inyectado en `xl/workbook.xml` para recalcular al abrir; hoja «Reglas» documenta cada traducción y las **no traducibles** se exportan como valor estático con aviso (nunca en silencio); hoja «Controles» con verificaciones.
- **JSON**: esquema versionado (`planex.schemaVersion` 1.0.0), exportación/importación con validación, rechazo comprensible de archivos malformados/incompatibles, conservación de reglas y parámetros del usuario, reglas desconocidas deshabilitadas y marcadas, recálculo e integridad tras importar. Sin ejecución de código del archivo.
- **Persistencia local**: autoguardado en `localStorage` (debounce 700 ms), biblioteca de proyectos guardados, estado de guardado visible, aviso al salir con cambios pendientes.

### Interfaz
Barra superior (nombre editable, plantilla activa, estado de guardado, % de cumplimentación, alertas, configuración, previsualización, PDF, Excel, JSON, tema), navegación lateral con avance por secciones y móvil, alertas clasificadas (error / inconsistencia / pendiente / supuesto / documental / legal) con **navegación al apartado afectado**, celdas calculadas distinguibles con tooltip de fórmula y acceso a la regla, tablas editables (añadir/eliminar/reordenar, validación numérica, monedas/unidades), **temas Dark/Light** persistentes, adaptabilidad a escritorio y tableta.

## 2. Instrucciones de ejecución

Clonar el repositorio, instalar dependencias e iniciar el servidor de desarrollo:

```bash
git clone https://github.com/Nardian90/PlanNegocios.git
cd PlanNegocios
npm install      # o: bun install
npm run dev      # o: bun run dev → http://localhost:3000
```

- Al abrirla por primera vez aparece el selector de plantillas: «Clínica Estomatológica» (ejemplo) o «Default» (general).
- Prueba rápida del motor: Configuración de cálculos → cambiar la tasa del impuesto (35 → 30) o editar la fórmula del impuesto; verificar 4.7.
- Pruebas automáticas: `bun test tests/planex/` (58 pruebas).

## 3. Arquitectura

```
src/lib/planex/
  types.ts                  Modelo de datos único (proyecto 4.1–4.12, params, reglas, issues, indicadores)
  engine/tokenizer|parser|evaluator|engine   Motor de cálculo (AST seguro, sin eval)
  excel/traductor.ts        AST → fórmulas Excel (SUMIFS/SUMPRODUCT/SUM, LAG→columna, NoTraducible)
  templates/reglas.ts       23 parámetros + 40 reglas de fábrica
  templates/clinica.ts      Ejemplo completo ficticio
  templates/default.ts      Plantilla general + ayudas metodológicas
  model/factory.ts          Normalización/creación (importación tolerante)
  model/cumplimiento.ts     % de cumplimentación por sección
  io/jsonio.ts              Export/import JSON validado
  io/persistence.ts         localStorage (actual + biblioteca + tema)
  io/xlsx.ts                Libro Excel de 18 hojas con fórmulas + fullCalcOnLoad
  io/pdf.ts                 PDF con índice paginado (doble pasada)
  store.ts                  Estado global (zustand) con mutaciones tipadas
src/components/planex/      Shell, secciones 4.1–4.12, config (params/reglas/editor), preview
tests/planex/               58 pruebas: motor (35) + XLSX (16) + PDF (7)
```

## 4. Pruebas ejecutadas y resultados (todas reales, sin afirmaciones vacías)

| Prueba | Resultado |
|---|---|
| Apertura de ambas plantillas desde el selector (navegador) | ✔ |
| Carga inicial completa de la clínica (ingresos 967,8; UAI 369,2; impuesto 129,2; recuperación 4,0) | ✔ (unit. + navegador) |
| Ayuda contextual en Default | ✔ |
| Edición de formularios y tablas; altas/bajas; recálculo de subtotales/totales | ✔ |
| Cambiar precio de servicio → ingresos (120.000 → 144.000 USD) y cascada a estado de resultados (991,8 / 392,0 / 137,2) | ✔ (navegador) |
| Cambiar volumen de pacientes y costo variable unitario | ✔ (unit.) |
| Tasa 35 % → 30 %: impuesto 129,2 → 110,8 en UI y motor | ✔ (unit. + navegador) |
| Cambiar la fórmula (base UAI → ingresos): impuesto = 290,3 = 967,8 × 30 % | ✔ (unit. + navegador) |
| Rechazo de sintaxis inválida; variables inexistentes; ciclos; /0; regla deshabilitada | ✔ (unit., 5 casos) |
| Insuficiencia y exceso de financiación | ✔ |
| Período de recuperación + requisito horizonte ≥ recuperación + 1 | ✔ |
| Guardar/recuperar; autoguardado; recarga sin pérdida | ✔ (navegador) |
| JSON: round-trip con reglas modificadas; rechazo de malformado y sin esquema | ✔ (unit.) |
| Previsualización (portada, índice, secciones, advertencia) | ✔ (navegador) |
| PDF: 16 páginas, texto seleccionable, índice, cifras del modelo | ✔ (unit. + artefacto) |
| XLSX: 18 hojas, fórmulas reales (impuesto = MAX(0; D$22 × Parametros!$C$3)), referencias entre hojas (SUMIFS/SUMPRODUCT), sin referencias rotas (926+ fórmulas), valores en caché = motor | ✔ |
| Cambiar tasa a 30 % en el libro recalcula el impuesto (estructura de fórmula + fullCalcOnLoad) | ✔ (verificación programática de fórmula y XML; ver limitación 5.3) |
| Dark/Light y persistencia del tema | ✔ (navegador) |
| Consola sin errores relevantes durante toda la sesión | ✔ |
| Lint (`bun run lint`) | ✔ 0 errores |
| Suite automatizada | ✔ **58/58** |

## 5. Limitaciones conocidas

1. **Recálculo en Excel**: se escriben fórmula + valor en caché y se fuerza `fullCalcOnLoad` en `xl/workbook.xml`; el recálculo real lo ejecuta Excel/LibreOffice al abrir. No se disponía de un motor de hoja de cálculo en el entorno para validar la ejecución final (se verificó estructura de fórmula, referencias y XML).
2. **Paneles congelados** en XLSX y **repetición de encabezados** en tablas del PDF de más de una página: autoTable repite encabezados; los paneles congelados no los escribe la biblioteca comunitaria (documentado).
3. El **período de recuperación** se exporta a Excel como valor documentado (su interpolación no es expresable como una fórmula portable); la parte recurrente (acumulado) sí es fórmula.
4. Aportes por año: la tabla metodológica contempla 3 años de aportación (Año 1–3); ampliarlo requiere reglas nuevas (posible desde el editor).
5. La advertencia de datos ficticios permanece mientras el plan provenga de la plantilla «Clínica» (elección conservadora; al crear desde Default no aparece).
6. **No se ha desplegado a producción ni se ha hecho merge** (según instrucción); solo servidor de desarrollo.

## 6. Requisitos legales, tributarios, sanitarios y de mercado pendientes de validación por el usuario

- **Tasa del impuesto sobre utilidades** (35 % es supuesto demostrativo editable): confirmar régimen tributario aplicable, exenciones y base legal vigente.
- **Tipo de cambio CUP/USD** (400 como referencia ficticia): tasa oficial, fecha y fuente.
- Certificación de la **Dirección de Patrimonio del MFP** para aportes de derechos reales; avalúos de activos aportados.
- Licencia sanitaria (MINSAP), registros y autorizaciones (ONEI/Registro Mercantil, CEPEC/DAMN según corresponda), ambientales y de residuos biomédicos.
- Regulación laboral y de la entidad empleadora autorizada para contratar la fuerza de trabajo; tratamiento de cargas y contribuciones sobre salarios (factor 1,0 de fábrica).
- Validación de demanda solvente, precios y costos reales con estudios de mercado primarios; requisitos de comercialización en divisas y moneda nacional.
- Alineación real con el PNDES vigente y la Estrategia de Desarrollo Territorial aplicable.

## 7. Archivos de salida

- Aplicación: `src/` (ruta `/`, servidor de desarrollo puerto 3000).
- Evidencias en `docs/`: ejemplos generados (PDF y libro Excel con fórmulas) en `docs/ejemplos/`, capturas claro/oscuro en `docs/capturas/`.
- Pruebas: `tests/planex/` (58 casos, ejecutar con `bun test tests/planex/`).
