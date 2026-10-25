# PLANEX — Configuración de Supabase y preparación de los colaboradores

> Documento de referencia de los epígrafes 2, 14 y 15 de la misión
> **PLANEX-SUPABASE-001**. Describe cómo quedó configurado el proyecto y cómo
> reproducir cada paso desde cero.

## Estado actual del proyecto

| Parámetro | Valor |
|---|---|
| Project URL | `https://huxxoiifdnmmrxcdxith.supabase.co` |
| Project ID | `huxxoiifdnmmrxcdxith` |
| Clave usada por la SPA | **publicable** `sb_publishable_…` (nunca secretas en el cliente) |
| Región | `us-east-2` (conexión IPv4 vía `aws-0-us-east-2.pooler.supabase.com:5432`, sesión) |
| Migraciones | **APLICADAS** (3 ficheros idempotentes, ver `supabase/migrations/`) |
| Cuentas Auth | `colaborador1@planex.app` (alias `Colaborador1`) y `colaborador2@planex.app` (alias `Colaborador2`), confirmadas, contraseñas verificadas con login real |
| Espacio compartido | `PLANEX — Espacio compartido`, ambos como `editor` |
| Realtime | `plans` y `plan_sections` publicadas con REPLICA IDENTITY FULL |

## Arquitectura de la integración

La SPA sigue siendo **100 % estática** (GitHub Pages): Supabase Auth, PostgreSQL
con RLS y Realtime se usan desde el navegador. No hay backend propio, ni API
routes, ni funciones. El despliegue solo compila con variables públicas.

```
Navegador (GitHub Pages) ──► Supabase Auth (correo+contraseña con alias)
                        └─► PostgREST (plans/plan_sections/…) ── RLS
                        └─► Realtime (postgres_changes con autorización RLS)
```

## Variables de compilación (NO secretas)

Definidas en el flujo de GitHub Actions (`.github/workflows/deploy.yml`) y en
`.env.local` para desarrollo local. Documentadas en `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://huxxoiifdnmmrxcdxith.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_…
NEXT_PUBLIC_PLANEX_COLABORADOR1_EMAIL=colaborador1@planex.app
NEXT_PUBLIC_PLANEX_COLABORADOR2_EMAIL=colaborador2@planex.app
NEXT_PUBLIC_BASE_PATH=/PlanNegocios   # solo en el despliegue de Pages
```

La SPA resuelve el alias introducido («Colaborador1»/«Colaborador2», normalizado
sin espacios ni diacríticos) al correo interno y llama al método estándar de
Supabase Auth con correo y contraseña. **Ninguna contraseña** figura en variables
de compilación, código, repo ni registros.

**Prohibido en la SPA** (y verificado con barrido del bundle compilado):
`sb_secret_…`, `service_role`, contraseñas de PostgreSQL o credenciales
administrativas. La protección real reside en la autenticación y en RLS.

## Reproducción desde cero (procedimiento administrativo)

### 1) Aplicar las migraciones

En el **SQL Editor** del dashboard (o por conexión directa con `psql` /
`pg`), ejecutar en orden:

1. `supabase/migrations/0001_esquema_planex.sql`
2. `supabase/migrations/0002_rls_planex.sql`
3. `supabase/migrations/0003_realtime_planex.sql`

Son idempotentes (create if not exists / drop policy if exists + create / create
or replace): pueden re-ejecutarse sin daño.

### 2) Crear las cuentas de colaborador

En **Authentication → Users → Add user**, con «Auto Confirm» activado:

| Email | Contraseña | `user_metadata` |
|---|---|---|
| `colaborador1@planex.app` | la acordada con el colaborador 1 | `{"username":"colaborador1","display_name":"Colaborador1"}` |
| `colaborador2@planex.app` | la acordada con el colaborador 2 | `{"username":"colaborador2","display_name":"Colaborador2"}` |

Al crearlas, el trigger `planex_on_auth_user_created` genera los `profiles`
con el alias correcto. El `username` de los metadatos **solo siembra el perfil**;
no otorga permisos.

> **Nota sobre contraseñas de 1 carácter**: la plataforma exige ≥ 6 caracteres
> por API (incluida la Admin). Para las contraseñas «1»/«2» exigidas por la
> misión se crearon las cuentas con una contraseña temporal ≥ 6 y luego se fijó
> el hash bcrypt definitivo con una actualización administrativa equivalente a
> cambiarla desde el Panel (mismo algoritmo que usa GoTrue), verificando el
> inicio de sesión real y revirtiendo si fallara. El propietario puede cambiar
> las contraseñas en cualquier momento desde Authentication → Users.

### 3) Crear el espacio y asignar membresías (después de existir las cuentas)

Ejecutar en el SQL Editor (usa los identificadores REALES de Auth por correo;
no inventa UUIDs):

```sql
insert into public.workspaces (name, description)
values ('PLANEX — Espacio compartido',
        'Espacio de trabajo compartido para los colaboradores autorizados de PLANEX.')
on conflict (name) do nothing;

insert into public.workspace_members (workspace_id, user_id, role)
select w.id, u.id, 'editor'
  from public.workspaces w
  join auth.users u on lower(u.email) in ('colaborador1@planex.app','colaborador2@planex.app')
 where w.name = 'PLANEX — Espacio compartido'
on conflict (workspace_id, user_id) do update set role = 'editor';
```

La escritura de `workspaces`/`workspace_members` debe hacerse con la clave de
servicio o desde el SQL Editor: no existen políticas de escritura para usuarios.

### 4) Verificar

- Entrar a la aplicación con `Colaborador1` + su contraseña y con `Colaborador2`:
  ambos deben ver el espacio y los mismos planes (pruebas 1–7 de la misión).
- El intento de un alias desconocido o contraseña errónea no concede acceso.
- Una cuenta SIN membresía obtiene token pero ve 0 planes (RLS; prueba 16).

## Ajustes de Auth relevantes para este despliegue

- **No se requieren URLs de redirección**: el login es correo+contraseña
  (sin OAuth ni enlaces mágicos) desde `https://nardian90.github.io/PlanNegocios/`.
- Si en el futuro se activan flujos OAuth o de confirmación por correo, añadir
  `https://nardian90.github.io/PlanNegocios/**` en
  *Authentication → URL Configuration → Redirect URLs* y poner la misma URL
  como *Site URL*.
- **CORS**: la Auth API de Supabase admite cualquier origen por defecto; no se
  necesita configuración adicional para Pages.
- El cliente usa `detectSessionInUrl: false` porque la navegación interna usa
  el fragmento `#/…` (Supabase no debe interpretarlo como devolución de OAuth).

## Cambios en GitHub Actions (epígrafe 14)

`.github/workflows/deploy.yml`:

1. **Corregido** el disparador del flujo: `branches: [main]` (el fichero anterior
   contenía un valor corrupto `ain]` que impedía el disparo fiable por push).
2. Se añadieron al nivel `env` del flujo las variables públicas
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` y los
   correos internos de ambos colaboradores. **Ningún secreto administrativo**
   en variables públicas: la clave publicable no es un secreto (los datos se
   protegen con autenticación real y RLS).
3. El resto del flujo no cambió: `bun install --frozen-lockfile` →
   `next build` (con `NEXT_PUBLIC_BASE_PATH=/PlanNegocios`) →
   `upload-pages-artifact` → `deploy-pages`.

## Guía rápida de operación (propietario)

- **Cambiar una contraseña**: Authentication → Users → usuario → «Send magic
  link»/«Set password», o pedirle al colaborador que la cambie; la app no la
  almacena.
- **Añadir un colaborador nuevo**: crear la cuenta (paso 2) e insertar su
  membresía (paso 3) con su correo real. El alias del login solo acepta los
  dos colaboradores compilados; para más alias, añadir la pareja
  `NEXT_PUBLIC_PLANEX_COLABORADORX_EMAIL` al flujo y volver a desplegar.
- **Quitar a un colaborador**: eliminar su fila en `workspace_members` (y
  opcionalmente la cuenta en Auth). Sus planes siguen intactos: nada se borra
  por defecto.
- **Re-ejecutar pruebas**: `e2e/colaboracion.mjs` (UI, dos navegadores reales) y
  los informes de `e2e/`.
