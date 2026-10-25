# UX-002 — Entregables: Centro de ayuda Diátaxis, identidad visual y navegación integrada

> **Misión UX-002** (ampliación obligatoria de PLANEX-DOC-001) sobre la rama
> `ux/planex-ux-002`. Además de la misión, este trabajo incorpora la petición
> expresa del propietario: **CI para proteger main**, **tasa de cambio 743
> CUP/USD** (el impuesto se confirma en **35 %**) y las advertencias
> correspondientes en todos los documentos.
>
> **EJEMPLO ILUSTRATIVO CON DATOS FICTICIOS.** Las cifras de las plantillas y
> de la ayuda son didácticas y reproducibles con la tasa vigente; la tasa
> (743 CUP/USD) y el impuesto (35 %) son supuestos **pendientes de validación
> oficial** antes de un uso formal.

---

## 1. Diagnóstico del estado inicial

| # | Hallazgo inicial | Ubicación | Decisión |
|---|---|---|---|
| D1 | La colaboración (historial, actividad, comentarios, conflictos) vivía en **cuatro modales** (`DialogoHistorial`, `DialogoActividad`, `DialogoComentarios`, `DialogoConflictos`) lanzados desde un menú desplegable | `Colaboracion.tsx`, `PlanexApp.tsx` | Vista dedicada `#/colaboracion?plan=…&tab=…` con pestañas URL-sincronizadas; el único diálogo restante es la confirmación breve de restaurar |
| D2 | No existía comparación de versiones: el historial listaba instantáneas, pero no mostraba diferencias | `Colaboracion.tsx` (ausente) | `compararSnapshots()` sobre las instantáneas COMPLETAS ya guardadas (`plan_versions.snapshot.secciones`), agrupada por sección con `diferenciarJSON` (hojas JSON) — módulos puros verificables |
| D3 | El diagnóstico del plan era un modal de hasta 3 columnas | `PlanexApp.tsx` (`Dialog` de alertas) | Panel lateral integrado (cierra con Esc/fondo/botón; el editor queda visible detrás) |
| D4 | El editor de fórmulas (expresión + constructor + prueba) era un modal de 88 vh | `config.tsx` (`EditorFormulas`) | Mismo contenido en panel lateral integrado con cierre por Esc |
| D5 | El favicon era `logo.svg` (una marca ajena al producto), sin ICO, sin apple-touch-icon y sin variantes rasterizadas | `public/logo.svg`, `layout.tsx` | Icono propio (§3) + variantes; `logo.svg` retirado del disco y de los metadatos |
| D6 | No existía ayuda de ninguna clase; los textos metodológicos de 4.x estaban dentro de la propia sección | ausente | Centro de ayuda Diátaxis (§2) con contenido vinculado a la implementación real |
| D7 | La tasa de cambio por defecto era **400 CUP/USD** (fecha 2026-10-01) | `templates/reglas.ts` (`tipo_cambio`) | **743 CUP/USD** (fecha 2026-10-26) con advertencia «PENDIENTE DE VALIDACIÓN OFICIAL» en parámetro, nota documental, plantillas, ayuda, README y docs; todas las expectativas de pruebas recalculadas con las fórmulas exactas |
| D8 | Sin flujo de CI: solo el despliegue (`deploy.yml`) | `.github/workflows/` | `ci.yml` (§7) + protección de rama aplicada vía API |

## 2. Centro de ayuda y guía de trabajo (Diátaxis)

- **Vista pública y permanente** `#/ayuda` (`Ayuda.tsx`), cargada en diferido, accesible
  con o sin sesión; botón «Ayuda» en la barra del editor y enlaces contextuales.
- **Cuatro capas navegables por pestañas** (`Tutoriales`, `Guías prácticas`,
  `Referencia`, `Conceptos`) sincronizadas con la URL (`?capa=…&articulo=…`).
- **Contenido** (`src/lib/planex/ayuda/contenido.ts`, 29 artículos):
  - *Tutorial integral* (8 etapas con **dónde/acción/resultado/errores a evitar**)
    usando la plantilla de clínica estomatológica.
  - *12 guías* («Cómo cambiar la tasa», «presentar en CUP o USD», «supuesto configurable»,
    «comprobar que el plan está financiado», «diferencia resumen↔tabla», «advertencia de
    capacidad», «fórmulas de impuestos/amortización/recuperación», «generar y descargar
    PDF», «exportar Word», «consultar y comparar versiones», «restaurar versión»,
    «compartir y permisos»), cada una con objetivo, requisitos, pasos, resultado esperado
    y errores frecuentes.
  - *8 fichas de referencia*: secciones 4.1–4.12, parámetros Nivel A, monedas y unidades,
    fórmulas con variables/unidades/ejemplo numérico, indicadores, estados y validaciones,
    colaboración y versiones, formatos de exportación y limitaciones.
  - *8 conceptos*: inversión vs gasto vs capital de trabajo, financiación, ingresos vs
    resultado vs caja, precios/volúmenes/costos, recuperación, «proyección correcta ≠
    viabilidad», advertencia vs incumplimiento normativo, límites de las plantillas demo.
- **Búsqueda** tolerante a acentos/caja con puntuación por título/resumen/cuerpo,
  fragmentos del hallazgo y estado vacío útil; cambiar de capa limpia la búsqueda.
- **Ejemplos numéricos reproducibles** con la tasa 743 (p. ej. 15 312 000 CUP / 743 / 1000
  = 20,61 kUSD de costo laboral; 1 480 × 743 = 1 099 640,0 kCUP) y rótulo visible:
  «Ejemplo didáctico: cifras hipotéticas, no verificadas…».
- **Enlaces contextuales reales** (`EnlaceAyuda`): 4.4, 4.6, 4.7, 4.9, 4.10, 4.11,
  configuración de cálculos, visor documental, panel de proyectos y vista de Colaboración.
  Abren **otra pestaña** directa al artículo (no a la portada) para no perder el contexto
  de edición; el componente se oculta si el artículo no existe (sin interrogaciones vacías).
- **Integridad verificada por pruebas**: `auditarContenido()` comprueba ids únicos,
  capas válidas, enlaces internos resueltos, estructura completa de cada guía y coherencia
  de filas/encabezados en las tablas.

## 3. Identidad visual: icono propio

- **Diseño**: documento (el plan) con barras ascendentes (el análisis financiero) sobre
  un squircle con degradado diagonal pizarra→verde azulado; la barra destacada en
  verde azulado (`#2DD4BF`). Trazos gruesos (4/64) para legibilidad a 16×16; contraste
  en pestañas claras y oscuras; sin banderas, símbolos políticos, emojis ni imitaciones.
- **Activos** (generados por `scripts/generar-icono-planex.py`, misma geometría del SVG,
  supermuestreo 1024 + LANCZOS):
  - `public/icon.svg` (vectorial, favicon principal)
  - `public/favicon.ico` (16/32/48 embebidos)
  - `public/icon-192.png` y `public/icon-512.png`
  - `public/apple-touch-icon.png` (180×180, opaco a sangre completa: iOS recorta solo)
- **Metadatos** (`layout.tsx`): `icon` = [SVG + ICO con tamaños declarados],
  `shortcut`, `apple`; **`logo.svg` eliminado** del disco y de las referencias.
- **Verificación**: pruebas unitarias de existencia/formato (cabeceras ICO/PNG), el CI
  comprueba que los iconos están en `out/`, y el E2E comprueba `fetch('icon.svg') === 200`
  y que los `<link rel=…icon>` referencian el icono nuevo (sin el antiguo).
- El logotipo dentro de la interfaz (badge «PX» del editor) NO se tocó: es otro uso.

## 4. Navegación integrada (estilo GitHub) y política de modales

- **Vista `#/colaboracion?plan=…&tab=…`** (`VistaColaboracion.tsx`, protegida):
  - *Resumen y actividad*: estado del plan, sincronización real, última versión,
    atención requerida y registro append-only con autoría.
  - *Historial de versiones*: guardar con descripción, detalles de cada instantánea
    (formato, generación, secciones incluidas), restauración con confirmación explícita
    y copia de seguridad automática previa (trazabilidad íntegra).
  - *Comparar versiones*: selección A/B (selects con versión/fecha/autor), intercambio,
    **diferencias reales por sección y campo** (ruta, valor A, valor B), contador de
    cambios y URL reproducible (`?a=…&b=…`, con recarga verificada por E2E).
  - *Comentarios* por sección (sin alterar cifras).
  - *Colaboradores*: miembros del espacio con rol real (perfiles resueltos con una segunda
    consulta permitida por RLS: `workspace_members.user_id` referencia a `auth.users`, no
    a `profiles`) y explicación de permisos/aislamiento.
  - *Conflictos* (solo cuando existen): comparación local↔remota y las tres resoluciones
    explícitas; el banner del editor navega aquí con `?tab=conflictos`.
- **Pestañas** con estado activo reconocible, orden estable, `overflow-x` en pantallas
  estrechas y sincronización por `history.replaceState` (Atrás/Adelante limpios).
- **Editor**: el menú «Colaboración» pasa a ser un botón directo a la vista; el aviso de
  conflictos navega a la pestaña correspondiente.
- **Modales restantes intencionales**: confirmación de restauración y creación de plan
  (acción breve y acotada que navega al editor al confirmar). Documentado como decisión,
  no como omisión.
- **El `Toaster` se monta en la vista de Colaboración** (bug real detectado por E2E:
  los avisos no se mostraban porque el editor no está montado en esa vista).

## 5. Tasa 743 e impuesto 35 % (petición del propietario)

- `tipo_cambio = 743` CUP/USD, `fechaRef 2026-10-26`, fuente y descripción con
  «PENDIENTE DE VALIDACIÓN OFICIAL» (`templates/reglas.ts`); impuesto confirmado en 0,35.
- Partidas dependientes del template Centro actualizadas con la conversión documentada
  (66 000 kCUP / 743 ≈ 88,8 kUSD; inversión total 2 188,8 kUSD = financiación).
- 21 expectativas de pruebas recalculadas con **expresiones exactas** (p. ej.
  `15312000 / 743 / 1000`), no con números mágicos; UAI 386,9 → impuesto 135,4 → UDI
  251,5 → FCFF 392,6; recuperaciones 3,4/3,2 años (clínica) y 4,5 (centro).
- La nota documental del PDF/Word declara la tasa aplicada, fecha, fuente y advertencia;
  README y docs históricos actualizados con la nota de validación pendiente.
- El PDF de ejemplo (`docs/ejemplos/`) regenerado con la tasa vigente.

## 6. Pruebas ejecutadas (todas reales, sin simulaciones)

| Suite | Resultado | Notas |
|---|---|---|
| Unitarias/integración (`bun test tests/planex/`) | **246/246** | 222 previas (recalculadas a 743) + 24 nuevas UX-002 |
| tsc --noEmit | **0 errores** | src + tests (se corrigió un `toMatch` previo no tipado) |
| eslint | **0** | |
| Build estático (`NEXT_PUBLIC_BASE_PATH=/PlanNegocios`) | **OK** | iconos presentes en `out/` |
| E2E colaboración (2 navegadores reales + Supabase real) | **63/63** | incluye 10 comprobaciones nuevas de UX-002 (§23/§24) |
| E2E documental (navegador real) | **19/19** | valores a tasa 743 (1.099.640,0 kCUP) |
| RLS/REST con JWT reales | (sin cambios) | 28/28 en la misión previa; sin tocar políticas |
| Base de datos tras las pruebas | **prístina** | 0 planes, 0 versiones huérfanas (limpieza ejecutada) |

Fallas intermedias reales detectadas y corregidas durante el E2E: Toaster ausente en la
vista de colaboración; búsqueda de la ayuda no se limpiaba al cambiar de capa; carreras de
conteo en el propio E2E; y el embed `profiles` imposible por el esquema (resuelto con dos
consultas). Todos los fallos quedaron cerrados con la evidencia de las suites en verde.

## 7. CI de protección de main

- [`.github/workflows/ci.yml`](../.github/workflows/ci.yml): en cada pull_request a main
  y cada push a main ejecuta tsc, lint, las 246 pruebas (con tolerancia documentada al
  runner de bun que a veces no termina tras emitir resultados, aceptando solo si el
  resumen reporta 0 fallos) y el build de producción, y comprueba que los iconos estén
  en `out/`.
- **Protección de rama aplicada vía API** (verificado por GET):
  - check requerido «Verificación completa (tipos, lint, pruebas y build)», strict;
  - pull request obligatorio para fusionar;
  - force pushes y borrados prohibidos;
  - `enforce_admins` desactivado (el propietario conserva el control total).

## 8. Archivos relevantes

| Archivo | Cambio |
|---|---|
| `src/lib/planex/ayuda/contenido.ts` | NUEVO: contenido Diátaxis + búsqueda + auditoría de integridad |
| `src/components/planex/Ayuda.tsx` | NUEVO: vista `#/ayuda` (pestañas, búsqueda, enlaces profundos) |
| `src/components/planex/VistaColaboracion.tsx` | NUEVO: vista `#/colaboracion` con 6 pestañas |
| `src/lib/supabase/comparar-versiones.ts` | NUEVO: comparación pura de instantáneas |
| `src/lib/planex/diferencias.ts` | NUEVO: `diferenciarJSON` extraído como módulo puro (reexportado por `sync.ts`) |
| `src/lib/supabase/datos.ts` | `listarMiembrosWorkspace` (dos consultas: membresías + perfiles) |
| `src/components/planex/Colaboracion.tsx` | Reducido al indicador de sincronización (modales retirados) |
| `src/components/planex/PlanexApp.tsx` | Botón Colaboración + botón Ayuda + panel lateral de diagnóstico (sin modales) |
| `src/components/planex/config.tsx` | Editor de fórmulas como panel lateral + chip de ayuda |
| `src/components/planex/comunes.tsx` | `EnlaceAyuda` contextual (abre otra pestaña) |
| `src/components/planex/navegacion.tsx` | Rutas `ayuda`/`colaboracion`, `urlAyuda`, `abrirAyuda`, `irAColaboracion` |
| `src/components/planex/Vistas.tsx` | Vistas nuevas (colaboración protegida; ayuda pública) |
| `src/components/planex/secciones/secciones1-3.tsx`, `VistaPreviaDoc.tsx`, `Proyectos.tsx` | Chips de ayuda contextuales |
| `src/app/layout.tsx` | Metadatos de iconos (SVG+ICO+Apple, sin `logo.svg`) |
| `public/icon.svg`, `favicon.ico`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` | NUEVOS; `public/logo.svg` ELIMINADO |
| `scripts/generar-icono-planex.py` | NUEVO: generador de variantes desde la geometría del SVG |
| `.github/workflows/ci.yml` | NUEVO: CI de protección |
| `src/lib/planex/templates/reglas.ts`, `centro.ts` | Tasa 743 + advertencias + partidas del Centro |
| `tests/planex/ux002.test.ts` | NUEVO: 24 pruebas |
| `tests/planex/*.test.ts` (7 archivos) | Expectativas recalculadas a 743 con expresiones exactas |
| `e2e/colaboracion.mjs` | Flujos actualizados a la vista integrada + §23/§24 (63 comprobaciones) |
| `e2e/doc.mjs` | Valores a tasa 743 |
| `README.md`, `docs/*.md`, `docs/ejemplos/*.pdf` | Documentación y ejemplo actualizados |

## 9. Limitaciones y riesgos conocidos

1. **Tasa e impuesto siguen siendo supuestos**: 743 CUP/USD y 35 % están advertidos como
   pendientes de validación oficial en parámetros, documentos, ayuda y README. No
   sustituyen fuentes oficiales.
2. **La protección de rama exige el check del CI**: hasta que este PR se fusione, `main`
   ya está protegido; el propio PR ejecutará el workflow al abrirse.
3. **Comparación de versiones limitada a instantáneas guardadas**: solo compara versiones
   explícitas (y copias automáticas de restauración); no crea versiones automáticas en
   cada guardado de sección (decisión de diseño previa, documentada).
4. **Ayuda estática**: el contenido describe la implementación vigente; si cambian
   fórmulas, campos o flujos, debe actualizarse junto con el código (la suite UX-002
   verifica la integridad interna, no la correspondencia semántica futura).
5. **El diálogo de «Crear plan» se conserva** como modal deliberadamente (acción breve
   de dos campos que navega al editor al confirmar). Si se prefiere vista dedicada, es
   un cambio pequeño y aislado.
6. **El índice Word sigue requiriendo «Actualizar campos»** al abrir (limitación de
   formato, documentada en la ayuda).
7. **Icono PWA/manifest**: la aplicación no es PWA, así que no se añadió manifest;
   `icon-192/512` quedan listos si algún día se decide instalarla.
