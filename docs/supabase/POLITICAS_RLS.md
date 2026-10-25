# PLANEX — Políticas RLS y su justificación

> Documento de referencia del epígrafe 6 de la misión **PLANEX-SUPABASE-001**.
> Definición canónica: [`supabase/migrations/0002_rls_planex.sql`](../../supabase/migrations/0002_rls_planex.sql).
> Verificación real: [`e2e/REPORTE-RLS-REST.txt`](../../e2e/REPORTE-RLS-REST.txt) y
> [`e2e/REPORTE-SEGURIDAD.txt`](../../e2e/REPORTE-SEGURIDAD.txt).

## Principios aplicados

1. **Ninguna tabla es accesible para anónimos**: todas las políticas son
   `TO authenticated` y cada una añade una condición **real** de autorización.
   `TO authenticated` por sí solo no protege nada: aquí siempre se exige
   pertenencia al espacio de trabajo correspondiente.
2. **La pertenencia se comprueba en el servidor** con la función auxiliar
   `public.planex_es_miembro(workspace, rol_mínimo)` (STABLE, `search_path`
   fijo, EXECUTE restringido a `authenticated`).
3. **Función auxiliar `SECURITY DEFINER` mínima y justificada**: la misión exige
   evitar políticas recursivas o ambiguas. Con `planex_es_miembro` como INVOKER,
   la política de `workspace_members` consultaría la misma tabla que la invoca y
   provocaría recursión («stack depth limit exceeded», verificado empíricamente).
   Como DEFINER (propietario `postgres`, sin FORCE RLS) la consulta interna se
   resuelve sin re-evaluar políticas. Contramedidas: `search_path = public`
   fijo, solo lectura (`SELECT EXISTS`), la identidad proviene **siempre** de
   `auth.uid()` (JWT del solicitante, no de parámetros) y EXECUTE revocado de
   `public`/`anon`. Es el único helper privilegiado del esquema junto al trigger
   de creación de perfiles (patrón documentado de Supabase).
4. **Escrituras con doble verificación**: `USING` filtra lo modificable y
   `WITH CHECK` revalida el resultado (impide eludir permisos cambiando
   relaciones). Además, triggers de inmutabilidad bloquean mover `plans` a otro
   espacio, secciones a otro plan, renombrar claves de sección y cambiar el
   alias del perfil.
5. **Mínimo privileio por tabla**: solo las operaciones que la aplicación usa;
   p. ej. no existen políticas DELETE para `plans`, `plan_sections`,
   `plan_versions` ni `plan_activity_log` (eliminación irreversible excluida por
   diseño; el historial es append-only).

## Políticas por tabla

### `profiles`
| Política | Operación | Regla |
|---|---|---|
| `profiles_select` | SELECT | Propio perfil **o** perfiles de compañeros de espacio (`EXISTS` sobre `workspace_members` + `planex_es_miembro`) |
| `profiles_update` | UPDATE | `id = auth.uid()` (el trigger impide tocar el alias) |

Sin INSERT/DELETE: los perfiles nacen con el usuario de Auth.

### `workspaces`
| `workspaces_select` | SELECT | `planex_es_miembro(workspaces.id)` |

Sin escritura para usuarios: crear espacios o autoinvitarse es imposible.

### `workspace_members`
| `members_select` | SELECT | Filas propias **o** de espacios donde soy miembro |

Sin INSERT/UPDATE/DELETE: **nadie puede autoconcederse membresías ni roles**,
incluido `owner`.

### `plans`
| Política | Operación | Regla |
|---|---|---|
| `plans_select` | SELECT | Miembro del espacio del plan |
| `plans_insert` | INSERT | WITH CHECK: miembro **editor** y `created_by = auth.uid()` (además el trigger lo sella) |
| `plans_update` | UPDATE | Miembro editor; WITH CHECK revalida el espacio (y el trigger impide cambiar `workspace_id`/`created_by`) |
| — | DELETE | **No existe**: eliminación solo administrativa |

### `plan_sections`
| Política | Operación | Regla |
|---|---|---|
| `sections_select` | SELECT | Miembro del espacio del plan contenedor |
| `sections_insert` | INSERT | Miembro editor del plan contenedor |
| `sections_update` | UPDATE | Miembro editor; WITH CHECK revalida el plan destino (el trigger impide mover la fila) |
| — | DELETE | **No existe** |

### `plan_versions` (historial inmutable)
| Política | Operación | Regla |
|---|---|---|
| `versions_select` | SELECT | Miembro |
| `versions_insert` | INSERT | Miembro editor y `created_by = auth.uid()` |
| — | UPDATE / DELETE | **No existen**: el historial no se manipula desde la API |

### `plan_activity_log` (append-only)
| Política | Operación | Regla |
|---|---|---|
| `activity_select` | SELECT | Miembro |
| `activity_insert` | INSERT | Miembro editor y `user_id = auth.uid()` (el trigger lo sella igualmente) |
| — | UPDATE / DELETE | **No existen** |

### `plan_comments`
Lectura por miembros; creación con autoría propia; edición/eliminación **solo del
propio comentario** (`user_id = auth.uid()` en USING y WITH CHECK).

### `plan_section_assignments`
Lectura por miembros; creación/eliminación por editores del espacio.

## Resultados de la verificación REAL (2026-10-25)

Batería REST con JWT de ambos colaboradores (`e2e/REPORTE-RLS-REST.txt`, 28/28):

- Perfil propio legible; espacio compartido visible; los 2 miembros visibles.
- Plan y secciones creados por C1 visibles para C2 (espacio compartido).
- Escritura con versión correcta aplica (+1); **escritura con versión caducada → 0 filas**
  (conflicto detectado, nada se sobrescribe).
- Denegaciones verificadas (filas afectadas `*/0` o HTTP 403/400):
  anónimo sin acceso; autoconcesión de membresía (403); creación de espacios (403);
  PATCH al perfil ajeno (0 filas); cambio del propio alias (400 por trigger);
  mover una sección a otro plan (400 por trigger); borrado del historial (0 filas).
- Cuenta **sin membresía** (tercero): token válido pero 0 planes, 0 espacios y
  CREATE PLAN denegado por WITH CHECK (`e2e/REPORTE-SEGURIDAD.txt`, prueba 16).

## Limitaciones declaradas con honestidad

- Las políticas protegen contra cualquier usuario autenticado **sin membresía del
  espacio** y contra anónimos. No protegen contra la filtración de las credenciales
  de un colaborador autorizado (esa es una responsabilidad de gestión de cuentas).
- Las contraseñas de los colaboradores iniciales («1»/«2») fueron exigidas por la
  misión y son deliberadamente débiles; el propietario puede cambiarlas en
  `Authentication → Users` cuando lo desee (la app no las guarda en ningún sitio).
- La clave `service_role`/`sb_secret_` NO está en el frontend ni en el repo
  (verificado con barrido del bundle compilado, prueba 17); todo acceso
  administrativo se realiza desde fuera de la SPA.
