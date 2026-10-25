<div align="center">

# PLANEX Cuba

### Planes de Negocios de propuestas con inversión extranjera conforme a la Gaceta Oficial GOC-2026-O57

Aplicación web de página única para elaborar, calcular, validar y exportar Planes de Negocios
siguiendo textualmente las **Bases Metodológicas** publicadas en la Gaceta Oficial de la República
de Cuba, número extraordinario **GOC-2026-O57 de 9 de julio de 2026** (epígrafes 4.1 a 4.12).

![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss)
![Pruebas](https://img.shields.io/badge/Pruebas-58%2F58_pass-brightgreen?style=flat-square)
[![Deploy](https://github.com/Nardian90/PlanNegocios/actions/workflows/deploy.yml/badge.svg)](https://github.com/Nardian90/PlanNegocios/actions/workflows/deploy.yml)

### Aplicación en línea

**https://nardian90.github.io/PlanNegocios/** — despliegue automático desde la rama `main`
vía GitHub Actions + GitHub Pages. La aplicación es 100% estática: una vez cargada,
funciona sin conexión y no envía datos a ningún servidor (los planes se guardan en el
navegador y solo viajan cuando el usuario exporta JSON/PDF/Excel).

**Flujo de vistas** (cada una con URL propia, navegación por hash sin 404):

| Vista | Ruta | Acceso |
|---|---|---|
| Landing de presentación | `#/` | Público |
| Acceso con contraseña | `#/login` | Público |
| Aplicación (editor 4.1–4.12) | `#/app` | Protegido |
| Vista documental del plan | `#/preview` | Protegido |

**Acceso**: la aplicación se abre tras introducir la contraseña (`PLANEX`, sensible a
mayúsculas). ⚠️ La contraseña se verifica en el cliente: es una barrera de acceso
básica para uso personal o demostrativo, **no autenticación segura** — el código
descargado puede inspeccionarse y la comprobación puede eludirse. Para confidencialidad
real se requiere autenticación del lado del servidor. Detalle en
[`docs/ENMIENDA_VISTAS_Y_ACCESO.md`](docs/ENMIENDA_VISTAS_Y_ACCESO.md).

</div>

---

## Advertencia obligatoria

> **EJEMPLO ILUSTRATIVO CON DATOS FICTICIOS.** No constituye una propuesta aprobada ni acredita
> el cumplimiento de requisitos legales, tributarios, sanitarios o de inversión. Validar las
> cifras, supuestos, autorizaciones y requisitos aplicables antes de su presentación oficial.

La plantilla de ejemplo incluye esta advertencia en la aplicación, la previsualización,
el PDF y el libro Excel. La tasa impositiva del 35 %, el tipo de cambio y demás cifras de
demostración son **supuestos editables**, no tasas legales vigentes.

---

## Tabla de contenidos

1. [Características](#características)
2. [Capturas de pantalla](#capturas-de-pantalla)
3. [Conformidad metodológica GOC-2026-O57](#conformidad-metodológica-goc-2026-o57)
4. [Motor de cálculo configurable](#motor-de-cálculo-configurable)
5. [Plantillas incluidas](#plantillas-incluidas)
6. [Exportación e intercambio](#exportación-e-intercambio)
7. [Arquitectura del proyecto](#arquitectura-del-proyecto)
8. [Requisitos e instalación](#requisitos-e-instalación)
9. [Despliegue](#despliegue)
10. [Guía de uso rápido](#guía-de-uso-rápido)
11. [Pruebas](#pruebas)
12. [Limitaciones conocidas](#limitaciones-conocidas)
13. [Documentación adicional](#documentación-adicional)

---

## Características

- **Estructura metodológica completa (4.1–4.12)**: información general, título, índice
  automático, resumen ejecutivo con cifras vinculadas al motor, descripción del negocio,
  aspectos técnico-operativos, análisis financiero, mercado, fuerza de trabajo,
  inversiones y cronograma, beneficios directos al país y conclusiones.
- **Motor de cálculo configurable de dos niveles**:
  - **Nivel A — Parámetros** (23): tasa de impuesto sobre utilidades, tipo de cambio,
    interés del crédito, período de gracia, plazo de amortización, inflación, crecimientos
    de precios/volumen/salarios, porcentajes de administración y mantenimiento, canon,
    públicos, capital de trabajo, aranceles… cada uno con valor, unidad, fuente, fecha de
    referencia y supuestos de demostración marcados.
  - **Nivel B — Reglas** (40): cada partida del estado de resultados es una regla con
    **expresión editable**, expresión de fábrica, historial de cambios, habilitar/deshabilitar
    y auditoría (variables usadas, valores actuales y error si falla).
- **Recálculo en cascada por grafo de dependencias**: al cambiar un parámetro o una fórmula,
  el sistema identifica las partidas afectadas y recalcula subtotales, totales, proyecciones
  plurianuales, flujo de caja, período de recuperación, resumen ejecutivo y exportaciones.
- **Editor de fórmulas seguro** (sin `eval()`): tokenizador, parser de árbol de sintaxis
  abstracta y evaluador propios, con validación en vivo de sintaxis, variables inexistentes,
  divisiones por cero, valores no finitos y dependencias circulares.
- **Plantillas de partida**: ejemplo completo de **Clínica Estomatológica** (datos ficticios
  coherentes) y plantilla **Default** general con ayudas metodológicas textuales de la Gaceta.
- **Exportaciones profesionales**:
  - **PDF** documental con portada, índice paginado, encabezados repetidos y texto seleccionable.
  - **Excel con fórmulas reales y referencias entre hojas** (no valores estáticos): 18 hojas,
    celdas de entrada y fórmulas diferenciadas, y recálculo automático al abrir el libro.
  - **JSON** con esquema versionado para guardar, intercambiar y reabrir proyectos.
- **Persistencia local**: autoguardado en `localStorage`, biblioteca de proyectos y temas
  claro/oscuro persistentes. La aplicación funciona completamente sin conexión.
- **Vistas diferenciadas**: landing de presentación premium, acceso mediante
  contraseña (solo `PLANEX`, sin cuentas), aplicación protegida y previsualización
  documental como vista de página completa (no modal) — ver
  [`docs/ENMIENDA_VISTAS_Y_ACCESO.md`](docs/ENMIENDA_VISTAS_Y_ACCESO.md).
- **Validación y consistencia**: alertas clasificadas (error, inconsistencia, pendiente,
  supuesto, documental, legal) con navegación al apartado afectado; control de capacidad de
  servicios, insuficiencia/exceso de financiación, horizonte ≥ recuperación + 1 año y más.

## Capturas de pantalla

| Landing de presentación | Vista documental dedicada |
|:---:|:---:|
| ![Landing](docs/capturas/landing-escritorio.png) | ![Vista previa](docs/capturas/vista-previa-dedicada.png) |

| Tema claro (editor) | Tema oscuro (editor) |
|:---:|:---:|
| ![Tema claro](docs/capturas/captura-claro.png) | ![Tema oscuro](docs/capturas/captura-oscuro.png) |

*La landing presenta el producto con dirección de arte editorial; la vista documental
(`#/preview`) muestra el plan como documento institucional con fondo neutro; las
capturas del editor corresponden a la sección de análisis financiero del ejemplo
Clínica Estomatológica. También hay una [captura del sitio desplegado en GitHub Pages
](docs/capturas/captura-github-pages.png), de la [vista de acceso](docs/capturas/vista-login.png)
y de la landing en [móvil](docs/capturas/landing-movil.png).*

## Conformidad metodológica GOC-2026-O57

| Epígrafe de la Gaceta | Implementación en PLANEX |
|---|---|
| 4.1 Información general | Formulario con declaración de responsabilidad del elaborador |
| 4.2 Título | Título editable y portada del documento |
| 4.3 Índice | Índice automático en previsualización, PDF y Excel |
| 4.4 Resumen ejecutivo | Cifras vinculadas al motor (no texto libre desactualizable) |
| 4.5 Descripción del negocio | Modalidad, objeto, vínculo PNDES/EDT, inversionistas y tabla de aportaciones con advertencia de derechos reales (Dirección de Patrimonio MFP) |
| 4.6 Aspectos técnico-operativos | Servicios con capacidad, ocupación y alertas de exceso; consumos |
| 4.7 Análisis financiero | Inversión total, financiación con detección de insuficiencia/exceso, proyección por años, impuesto, flujo de caja, recuperación y gráfico |
| 4.8 Mercado | Formulario metodológico del mercado y demanda solvente |
| 4.9 Fuerza de trabajo | Tabla en CUP con subtotales por grupo y entidad contratante |
| 4.10 Inversiones | Relación de inversiones, vehículos y cronograma con barra visual |
| 4.11 Beneficios directos al país | Tabla metodológica con acumulados calculados por el motor |
| 4.12 Conclusiones | Editables, con borrador automático a partir del modelo |

## Motor de cálculo configurable

El motor es **independiente de la interfaz** (`src/lib/planex/engine/`) y constituye la única
fuente de verdad del proyecto: tokenizador → parser (AST) → evaluador, **sin `eval()`** ni
ejecución de código libre.

**Operaciones y funciones admitidas**: `+ − * / ^`, paréntesis, porcentaje, comparaciones,
`AND`, `OR`, `NOT`, `IF` (con cortocircuito), `MIN`, `MAX`, `ABS`, `ROUND`, `SUM`, `POW`,
`LAG(partida, años)` para referencias a años anteriores y sumatorias por tabla
(`SUMA_SERVICIOS`, `SUMA_PERSONAL`, `SUMA_APORTACIONES`, `SUMA_INVERSIONES`).

**Dos capacidades distintas, ambas soportadas y probadas:**

1. **Cambiar un parámetro** — p. ej. la tasa del impuesto sobre utilidades del 35 % al 30 %:
   el impuesto del ejemplo pasa de 129,2 a 110,8 kUSD y toda la cascada (utilidad neta,
   flujo de caja, recuperación, resumen ejecutivo, exportaciones) se recalcula.
2. **Cambiar una fórmula** — p. ej. sustituir la base imponible de utilidades por ingresos:
   `impuesto = MAX(0, utilidad_antes_impuestos × tasa_impuesto_utilidades)` pasa a
   `MAX(0, ingresos_totales × tasa_impuesto_utilidades)` y el resultado es 290,3 kUSD
   (967,8 × 30 %) manteniendo la misma tasa del parámetro.

**Control de errores**: sintaxis inválida, variables inexistentes, división por cero,
valores no finitos, dependencias circulares y reglas deshabilitadas con dependientes.
Nunca se muestra un valor falso: la partida se marca y se explica el error, y las
exportaciones avisan antes de continuar.

## Plantillas incluidas

- **Clínica Estomatológica** — ejemplo completo con datos ficticios coherentes: 9 servicios
  (ingresos año 1 = 967,8 kUSD), inversión de 1.480,0 kUSD (aportaciones 1.180 + crédito 300
  al 8 %, gracia 1, amortización 5), 27 trabajadores en operación, depreciación 117,125
  kUSD/año, horizonte de 10 años ≥ recuperación ≈ 4,0 + 1, y beneficios al país acumulados
  ≈ 4.078 kUSD.
- **Default** — estructura metodológica completa con formularios vacíos, ayudas
  metodológicas por apartado (texto fiel de la GOC-2026-O57) y reglas activas. Sin datos
  emite avisos de pendiente en lugar de presentar resultados con datos inexistentes.

Las plantillas nunca se modifican: cada plan creado es un objeto independiente que puede
restaurar su plantilla de origen en cualquier momento.

## Exportación e intercambio

| Formato | Características |
|---|---|
| **PDF** (jsPDF + autoTable) | 16 páginas en el ejemplo, portada, índice con numeración a doble pasada, encabezados repetidos en tablas, pies paginados, texto seleccionable y advertencia de datos ficticios |
| **Excel** (xlsx-js-style) | 18 hojas con fórmulas reales: el impuesto es `=MAX(0;(D$22*Parametros!$C$3))`; proyecciones referencian Servicios/Personal/Inversiones/Financiacion mediante `SUMIFS`/`SUMPRODUCT`/`SUM`; entradas en ámbar y fórmulas en verde; `fullCalcOnLoad` inyectado para recalcular al abrir; hoja «Reglas» documenta cada traducción y las no traducibles se exportan como valor con aviso explícito |
| **JSON** | Esquema versionado (`planex.schemaVersion` 1.0.0) con validación e importación segura sin ejecución de código del archivo; conserva reglas y parámetros del usuario; las reglas desconocidas quedan deshabilitadas y marcadas |

## Arquitectura del proyecto

```
src/
  app/                       Aplicación Next.js (App Router)
  components/
    planex/                  Shell, secciones 4.1–4.12, configuración, previsualización
    ui/                      Componentes de interfaz (shadcn/ui)
  hooks/                     Hooks compartidos
  lib/
    planex/
      types.ts               Modelo de datos único (proyecto 4.1–4.12, params, reglas, issues)
      engine/                Motor: tokenizer → parser (AST) → evaluator + grafo y orden topológico
      excel/traductor.ts     AST → fórmulas Excel (SUMIFS/SUMPRODUCT/SUM, LAG → columna anterior)
      templates/             reglas.ts (23 parámetros + 40 reglas), clinica.ts, default.ts
      model/                 Normalización/creación y % de cumplimentación
      io/                    jsonio (JSON validado), xlsx (18 hojas), pdf (índice paginado), persistence
      store.ts               Estado global tipado (zustand)
tests/planex/                58 pruebas: motor (35) + XLSX (16) + PDF (7)
docs/                        Informe de implementación, capturas y ejemplos de salida
```

## Requisitos e instalación

**Requisitos**: Node.js 20.9+ (o Bun 1.1+). Las pruebas automatizadas requieren Bun.

```bash
# Clonar
git clone https://github.com/Nardian90/PlanNegocios.git
cd PlanNegocios

# Instalar dependencias (con npm, yarn, pnpm o bun)
npm install        # o: bun install

# Desarrollo (http://localhost:3000)
npm run dev        # o: bun run dev

# Compilación del sitio estático (genera out/)
npm run build

# Servir el sitio compilado localmente (equivalente al despliegue)
npm start

# Pruebas automatizadas (requiere bun)
bun test tests/planex/

# Análisis estático
npm run lint
```

La aplicación es un sitio estático (`output: export`): `npm run build` genera la carpeta
`out/` con HTML/CSS/JS autocontenidos. La ruta base se controla con la variable
`NEXT_PUBLIC_BASE_PATH` (vacía por defecto; el despliegue de GitHub Pages usa
`/PlanNegocios`). Una vez cargada, funciona sin conexión, no requiere servidores externos
y no envía información a ningún servicio remoto (los planes se guardan en `localStorage`
y viajan solo cuando el usuario exporta JSON/PDF/Excel).

## Despliegue

### GitHub Pages (configurado, automático)

El repositorio incluye el workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):
cada push a `main` construye el sitio estático con Bun y lo publica en
**https://nardian90.github.io/PlanNegocios/** mediante GitHub Actions. No se necesita Vercel
ni ningún otro proveedor: la app no requiere servidor, base de datos ni funciones en la nube.
La navegación interna usa rutas por hash (`#/`, `#/login`, `#/app`, `#/preview`), de modo que
ninguna vista produce 404 al recargar y los recursos resuelven bajo la subruta del repo.

Configuración necesaria (ya aplicada en este repositorio):

1. **Settings → Pages → Source**: `GitHub Actions`.
2. El workflow adjunto se dispara en cada push a `main` (también manualmente desde la
   pestaña **Actions → Deploy to GitHub Pages → Run workflow**).

### Otros alojamientos

Al ser un sitio estático, `out/` puede servirse desde cualquier hosting:

- **Vercel** (opcional): importar el repositorio; detecta Next.js automáticamente. No
  requiere configuración adicional. Útil si se desea dominio propio o entornos de vista previa.
- **Netlify / Cloudflare Pages**: comando de build `npm run build`, carpeta a publicar `out/`.
- **Servidor propio**: `npm run build` y copiar `out/` a cualquier servidor web.

## Guía de uso rápido

1. **Landing y acceso**: abra el sitio; explore la presentación («Explorar funcionalidades»)
   y pulse «Acceder a PLANEX». En la pantalla de acceso introduzca la contraseña (solo
   contraseña, sin usuario) y pulse Entrar.
2. **Primer uso en la app**: aparece el selector de plantillas. Elija «Clínica Estomatológica»
   (ejemplo completo) o «Default» (estructura general vacía).
3. **Explorar el modelo**: navegue por las secciones 4.1–4.12 en la barra lateral; las
   celdas calculadas muestran su fórmula al pasar el cursor y enlazan a la regla origen.
4. **Cambiar un parámetro**: abra «Configuración de cálculos», edite la tasa del impuesto
   (35 → 30 %) y observe el recálculo en cascada en la sección 4.7.
5. **Cambiar una fórmula**: en la misma configuración, edite la expresión del impuesto
   (constructor visual o editor de texto) con validación en vivo y prueba con datos actuales.
6. **Previsualizar y exportar**: «Previsualizar plan» abre la vista documental dedicada
   (`#/preview`); desde su barra de acciones exporte PDF (documental), Excel (con fórmulas
   vivas) o JSON, y «Volver a editar» regresa a la misma sección de edición.
7. **Cerrar sesión**: el botón de la barra superior regresa a la landing y limpia la sesión
   sin borrar los proyectos guardados.

## Pruebas

La suite automatizada cubre el motor de cálculo, los exportadores y el intercambio JSON:

| Suite | Casos | Cobertura |
|---|---|---|
| Motor | 35 | Valores esperados manuales, recálculo por parámetro, cambio de fórmula, sintaxis inválida, variables inexistentes, ciclos, división por cero, insuficiencia de financiación, horizonte, capacidad, round-trip JSON |
| Excel | 16 | Fórmulas reales por hoja, referencias entre hojas, coincidencia de valores con el motor, recálculo al cambiar la tasa, sin referencias rotas (926+ fórmulas) |
| PDF | 7 | Contenido, índice, cifras del modelo activo y advertencias |
| Vistas y acceso (enmienda) | 20 | Landing sin sesión, flujo de acceso con contraseña, protección y redirección de vistas, cierre de sesión sin pérdida de datos, previsualización dedicada, sincronización de cifras, Atrás/Adelante, recargas sin 404, subruta, responsive, movimiento reducido, recursos externos y consola — detalle en [`docs/ENMIENDA_VISTAS_Y_ACCESO.md`](docs/ENMIENDA_VISTAS_Y_ACCESO.md) |

Además se verificó de extremo a extremo en navegador: carga de plantillas, edición de
formularios y tablas, cascadas de recálculo, persistencia tras recarga, temas claro/oscuro
y ausencia de errores en consola. El detalle completo está en
[`docs/INFORME_DE_IMPLEMENTACION.md`](docs/INFORME_DE_IMPLEMENTACION.md).

## Limitaciones conocidas

1. **Recálculo en Excel**: se escribe fórmula + valor en caché y se fuerza `fullCalcOnLoad`;
   el recálculo real lo ejecuta Excel/LibreOffice al abrir el libro.
2. El **período de recuperación** se exporta a Excel como valor documentado (su interpolación
   no es portable como fórmula); la parte recurrente (acumulado) sí es fórmula.
3. **Aportes por año**: la tabla metodológica contempla 3 años de aportación (Año 1–3);
   ampliarla requiere reglas nuevas desde el editor.
4. La advertencia de datos ficticios permanece mientras el plan provenga de la plantilla
   «Clínica»; al crear desde «Default» no aparece.
5. Validaciones legales, tributarias, sanitarias y de mercado **pendientes de confirmación
   por el usuario** antes de cualquier uso oficial (tasa de impuesto, tipo de cambio,
   certificaciones del MFP, licencias MINSAP, estudios de demanda).
6. **La contraseña de acceso se verifica en el cliente** y puede eludirse inspeccionando
   el código descargado: es una barrera demostrativa para uso personal, no autenticación
   segura. No sustituye un mecanismo de control de acceso del lado del servidor.

## Documentación adicional

- [`docs/ENMIENDA_VISTAS_Y_ACCESO.md`](docs/ENMIENDA_VISTAS_Y_ACCESO.md) — Enmienda:
  landing premium, acceso mediante contraseña (con su limitación real de seguridad),
  previsualización como vista dedicada y las 20 pruebas adicionales ejecutadas.
- [`docs/INFORME_DE_IMPLEMENTACION.md`](docs/INFORME_DE_IMPLEMENTACION.md) — Informe completo
  de implementación y verificación: funciones, arquitectura, pruebas ejecutadas y resultados.
- [`docs/ejemplos/`](docs/ejemplos/) — Salidas del ejemplo Clínica Estomatológica:
  [Plan de Negocios en PDF](docs/ejemplos/Ejemplo_Clinica_Plan_de_Negocios.pdf) y
  [libro Excel con fórmulas](docs/ejemplos/Ejemplo_Clinica_Libro_con_formulas.xlsx).
- [`docs/capturas/`](docs/capturas/) — Capturas de la interfaz en temas claro y oscuro.

---

<div align="center">

**PLANEX Cuba** — elaborado conforme a la Gaceta Oficial GOC-2026-O57 (09/07/2026),
Ley 118 «De la Inversión Extranjera» y normas complementarias.

Uso con fines de elaboración metodológica. Las cifras del ejemplo son ficticias y los
supuestos tributarios, cambiarios y regulatorios deben validarse antes de cualquier
presentación oficial.

</div>
