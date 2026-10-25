# PLANEX — Esquema de datos de colaboración (Supabase / PostgreSQL)

> Documento de referencia del epígrafe 5 de la misión **PLANEX-SUPABASE-001**.
> Las definiciones canónicas viven en [`supabase/migrations/`](../../supabase/migrations/)
> (versionadas e idempotentes) y en [`src/lib/supabase/base-de-datos.ts`](../../src/lib/supabase/base-de-datos.ts)
> (tipos del cliente).

## Visión general

PLANEX proyecta cada `PlanexProject` (el modelo de la app, estructura 4.1–4.12 de la
GOC-2026-O57) en **12 secciones sincronizables** con versionado independiente, más
los metadatos del plan. Así, dos colaboradores pueden editar apartados distintos en
paralelo sin pisarse, y los parámetros y reglas de cálculo —de alto impacto— viven
en secciones propias bajo control de concurrencia estricta.

```
auth.users ──1:1── profiles ──N:M── workspace_members ──N:1── workspaces
                                                        │
                                                        └──1:N── plans ──1:N── plan_sections (12 por plan)
                                                                     ├──1:N── plan_versions      (historial inmutable)
                                                                     ├──1:N── plan_activity_log (append-only)
                                                                     ├──1:N── plan_comments
                                                                     └──1:N── plan_section_assignments
```

## Tablas

### `profiles`
Perfiles ligados a `auth.users`, **sin contraseñas ni permisos**.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | = `auth.users.id` (FK `on delete cascade`) |
| `username` | text UNIQUE | Alias de inicio de sesión (`colaborador1` / `colaborador2`), **inmutable por API** (trigger) |
| `display_name` | text | Nombre visible en autoría |
| `created_at` / `updated_at` | timestamptz | `updated_at` automático por trigger |

Se crea automáticamente al registrar cada usuario de Auth (trigger
`planex_on_auth_user_created`, patrón documentado de Supabase). El `username` se
siembra desde `user_metadata` **solo como dato inicial**; nunca es fuente de
autorización (los permisos viven en `workspace_members`).

### `workspaces`
El espacio de trabajo compartido. Escritura **solo administrativa** (no hay
políticas INSERT/UPDATE/DELETE para usuarios): un colaborador no puede crear
espacios ni autoinvitarse.

### `workspace_members`
Pertenencia (`workspace_id`, `user_id`, `role ∈ {owner, editor, viewer}`).
Es la **única fuente de autorización**; su escritura es exclusivamente
administrativa (la clave de servicio pasa por encima de RLS; los usuarios no
tienen políticas de escritura). Ambos colaboradores iniciales son `editor`.

### `plans`
Metadatos de cada plan.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | Identificador del plan (aparece en la URL `#/editor?plan=…`) |
| `workspace_id` | uuid FK | **Inmutable por API** (trigger) |
| `title` | text | Editable; dispara el incremento de `revision` |
| `template_key` | `clinica` \| `default` | Plantilla de origen |
| `status` | `borrador` \| `en_revision` \| `finalizado` | Estado de elaboración |
| `created_by` / `updated_by` | uuid | Sellados por el servidor (triggers, nunca por el cliente) |
| `updated_by_name` | text | Desnormalizado para autoría visible |
| `created_at` / `updated_at` | timestamptz | `updated_at` se refresca también al guardar secciones (trigger `planex_sections_touch_plan`) |
| `schema_version` | text | Versión del esquema de datos (`1.0.0`) |
| `revision` | integer | +1 solo cuando cambian metadatos reales (título/estado/plantilla) |

### `plan_sections`
El contenido del plan, **una fila por sección** con control de concurrencia optimista.

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `plan_id` | uuid FK | **Inmutable** (trigger: no se puede mover a otro plan) |
| `section_key` | text | Clave estable, CHECK con las 12 admitidas |
| `content` | jsonb | Subconjunto de `PlanexProject` correspondiente a la sección |
| `section_version` | integer | **+1 en cada escritura, por trigger**; el cliente escribe indicando la versión esperada → detección de conflictos |
| `updated_by` / `updated_by_name` / `updated_at` | | Sellados por el servidor |

**Claves estables de sección** (mapping con `PlanexProject`, véase
`src/lib/planex/secciones-sync.ts`):

| `section_key` | Campos de `PlanexProject` | Epígrafe |
|---|---|---|
| `identificacion` | `general`, `titulo`, `resumen` | 4.1–4.4 |
| `descripcion` | `negocio`, `inversionistaExtranjero`, `inversionistaNacional` | 4.5 |
| `tecnico` | `tecnico`, `consumos` | 4.6 |
| `produccion` | `servicios` | 4.6/4.7 |
| `inversiones` | `aportaciones`, `financiero` | 4.5/4.7/4.10 |
| `mercado` | `mercado` | 4.8 |
| `fuerza` | `fuerza`, `personal` | 4.9 |
| `cronograma` | `cronograma` | 4.10 |
| `conclusiones` | `conclusiones` | 4.12 |
| `parametros` | `parametros` (Nivel A) | transversal |
| `reglas` | `reglas` (Nivel B, fórmulas) | transversal |
| `meta` | `ajustes` (horizonte) | transversal |

`nombre`, `id`, fechas y el bloque `planex` del proyecto NO viven en secciones:
provienen de la fila `plans`.

**Control de concurrencia**: cada escritura es
`UPDATE … WHERE plan_id = $ AND section_key = $ AND section_version = $esperada`.
Si otro colaborador guardó antes, la condición no coincide → **0 filas → conflicto
explícito**, nunca una sobrescritura silenciosa (epígrafes 9–10 de la misión).

### `plan_versions`
Instantáneas recuperables e **inmutables**: `plan_id`, `version_number` (único por
plan), `created_by(_name)`, `description`, `snapshot` (jsonb con las 12 secciones +
metadatos, formato `planex.version.1`), `created_at`. No hay políticas
UPDATE/DELETE: el historial no se manipula desde la API. Restaurar una versión
inserta primero una copia de seguridad automática del estado activo.

### `plan_activity_log`
Registro **append-only** (`plan_id`, `section_key`, `operation`, `field_path`,
`old_value`, `new_value`, `user_id(_name)`, `created_at`). Las escrituras de
secciones las registra el propio servidor (trigger `planex_sections_log`, con
contenido previo y nuevo); los eventos de ciclo de vida (plan creado, versión
guardada/restaurada, metadatos) se insertan desde el cliente con autoría sellada
por trigger. Nunca contiene contraseñas, tokens ni secretos.

### `plan_comments`
Observaciones por plan/sección (`content` CHECK no vacío, `user_id`, `section_key`
opcional). No alteran datos financieros ni disparan recálculos. Cada usuario
puede editar/borrar **solo los suyos**.

### `plan_section_assignments`
Apartados asignados a un colaborador (`plan_id`, `section_key` únicos por plan,
`user_id`). Gestión editorial (editores del espacio).

## Disparadores (triggers)

| Trigger | Tabla | Efecto |
|---|---|---|
| `planex_on_auth_user_created` | `auth.users` | Crea `profiles` al registrar cada usuario (SECURITY DEFINER mínimo, `search_path` fijo) |
| `planex_profiles_guard` | `profiles` | Impide cambiar el alias; actualiza `updated_at` |
| `planex_plans_stamp` | `plans` | Sella autoría/fecha; inmutabilidad de `workspace_id`/`created_by`; `revision`+1 solo con cambios reales de metadatos; registra actividad |
| `planex_sections_stamp` | `plan_sections` | `section_version`+1 por escritura; inmutabilidad de `plan_id`/`section_key`; sella autoría |
| `planex_sections_log` | `plan_sections` | Registro de actividad automático (INSERT/UPDATE) |
| `planex_sections_touch_plan` | `plan_sections` | Refresca `plans.updated_at/by(_name)` al guardar una sección |
| `planex_activity_stamp` / `planex_versions_stamp` / `planex_comments_stamp` / `planex_assignments_stamp` | varias | Identidad y nombre tomados SIEMPRE de `auth.uid()` + `profiles` (nunca del cliente) |

## Realtime

`plans` y `plan_sections` están publicadas en `supabase_realtime` con
`REPLICA IDENTITY FULL` (los eventos UPDATE incluyen el registro previo y habilitan
la autorización RLS de la suscripción — WalRus). Cada sesión se suscribe al canal
de su plan; un mensaje de Realtime **no** es prueba de autorización: lecturas y
escrituras siguen protegidas por RLS en el servidor (epígrafe 8 de la misión).

## Modelo de sincronización de la SPA

- **Autoguardado**: cada mutación recalcula el modelo (grafo de dependencias del
  motor) y programa el envío con *debounce* (1,4 s) solo de las secciones cuya
  huella canónica cambió respecto a la última confirmada.
- **Huellas canónicas**: comparación con claves ordenadas en todos los niveles
  (independiente del orden de `jsonb` en el servidor), calculadas sobre la forma
  normalizada del modelo para evitar guardados espurios.
- **Estados por sección**: `limpio / sucio / guardando / error / conflicto`, más
  `conectado` global. La UI nunca presenta un cambio como guardado si Supabase no
  lo confirmó.
- **Sin conexión**: cambios pendientes conservados (caché local de recuperación por
  plan), aviso visible y reintento controlado; al volver, el reintento detecta
  versiones remotas nuevas y pide resolución de conflictos.
- **Ecos y eventos retrasados**: los ecos propios se detectan por `updated_by`;
  los eventos con `section_version ≤` la conocida se descartan (guarda de
  antigüedad) para no reabrir conflictos con fotogramas amortiguados durante una
  desconexión.
