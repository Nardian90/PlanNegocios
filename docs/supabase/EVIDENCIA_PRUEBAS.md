# PLANEX — Evidencia de las pruebas ejecutadas (misión PLANEX-SUPABASE-001)

> Epígrafe 16 de la misión. Todas las pruebas listadas se ejecutaron **de verdad**
> el 2026-10-25 contra el despliegue estático local (idéntico al de Pages: mismo
> build, servido bajo `/PlanNegocios/`) y el proyecto Supabase real
> `huxxoiifdnmmrxcdxith`. Las pruebas de concurrencia usaron **dos procesos de
> navegador Chromium independientes** (dos sesiones reales, con sus propios
> almacenamientos y JWT), no pestañas de la misma sesión.

Informe maestro de la batería de UI: [`e2e/REPORTE-E2E.txt`](../../e2e/REPORTE-E2E.txt)
(**53/53 comprobaciones, 0 fallas**). Batería RLS/REST: [`e2e/REPORTE-RLS-REST.txt`](../../e2e/REPORTE-RLS-REST.txt)
(28/28). Seguridad: [`e2e/REPORTE-SEGURIDAD.txt`](../../e2e/REPORTE-SEGURIDAD.txt).

Reproducción: `e2e/colaboracion.mjs` (lee las contraseñas de variables de entorno,
nunca del código).

## Mapa de las 23 pruebas de la misión → evidencia

| # | Prueba de la misión | Resultado | Dónde quedó probada |
|---|---|---|---|
| 1 | Ingreso correcto de Colaborador1 | ✔ PASA | E2E `1` — login con alias + contraseña de 1 carácter contra Supabase Auth real |
| 2 | Ingreso correcto de Colaborador2 | ✔ PASA | E2E `2` — segundo navegador independiente |
| 3 | Rechazo de contraseñas incorrectas | ✔ PASA | E2E `C1` (alias desconocido, sin llamar al servidor) y `C2` (contraseña errónea: «Usuario o contraseña incorrectos»); REST: login 400 |
| 4 | Cierre de sesión y expiración/restauración | ✔ PASA | E2E `4a` (recarga restaura la sesión persistida por supabase-js), `4b` (logout → landing), `4c` (rutas protegidas vuelven a exigir acceso), `4d` (logout NO borra proyectos) |
| 5 | Acceso al mismo espacio desde dos navegadores | ✔ PASA | E2E `7a/7b` — C1 ve y abre el plan creado por C2; panel con espacio «PLANEX — Espacio compartido» en ambas sesiones |
| 6 | Creación de un proyecto por el primer colaborador | ✔ PASA | E2E `5a/5b` — se crean las 12 secciones + parámetros + reglas en Supabase; actividad `plan_creado` registrada |
| 7 | Apertura del proyecto desde la segunda cuenta | ✔ PASA | E2E `7a` (aparece SIN recargar, Realtime sobre `plans`) y `7b` |
| 8 | Modificación de C1 y recepción por C2 | ✔ PASA | E2E `8a/8b/8c` — C2 recibe «Mercado» en vivo sin recarga y con toast que identifica al autor |
| 9 | Edición simultánea de secciones diferentes | ✔ PASA | E2E `9a/9b` — Mercado (C1) y Conclusiones (C2) se guardan independientemente y se propagan sin conflicto |
| 10 | Edición simultánea de la misma sección y conflicto | ✔ PASA | E2E `10a–10d` — reconexión con versión remota distinta → conflicto detectado; comparación campo a campo; sobrescritura EXPLÍCITA confirmada; C2 recibe la resolución en vivo. REST: escritura con versión caducada → 0 filas (28/28) |
| 11 | Una edición sin guardar no desaparece al recibir un evento remoto | ✔ PASA | E2E `11` — el texto local de C1 permanece íntegro; E2E `14b` — lo mismo sin conexión |
| 12 | Persistencia de parámetros y fórmulas | ✔ PASA | E2E `12a–12c` — tasa 35 → 30 % guardada; C2 ve el impuesto recalculado (110,8) **en vivo**; tras recarga persiste. Excel exportado con tasa 0,3 y fórmula real (`19d/19e`) |
| 13 | Autoguardado y recuperación tras recarga | ✔ PASA | E2E `13` — editar + recarga → el valor sigue del servidor |
| 14 | Reconexión tras una interrupción | ✔ PASA | E2E `14a–14c` (aviso visible, nada se marca como guardado, reintento) + `10a` (detecta la versión remota creada durante el corte y pide resolución) |
| 15 | Funcionamiento de las políticas RLS | ✔ PASA | REST 28/28 con JWT reales de ambos colaboradores (visibilidad, concurrencia optimista y denegaciones) + 21 políticas vigentes verificadas en el catálogo (`REPORTE-SEGURIDAD.txt`) |
| 16 | Denegación a usuarios no autorizados | ✔ PASA | Cuenta tercera creada SIN membresía: token válido, 0 planes, 0 espacios, INSERT denegado por WITH CHECK (HTTP 403). Cuenta eliminada tras la prueba |
| 17 | Claves secretas fuera del código compilado | ✔ PASA | Barrido de `out/` (todos los chunks): sin `sb_secret_` (valor), sin `service_role` (JWT ni literal), sin contraseña de PostgreSQL, sin cadenas de conexión. El texto «sb_secret_» aparece solo como clasificador interno de supabase-js (que rechaza claves secretas), sin el valor |
| 18 | Historial y restauración de una versión anterior | ✔ PASA | E2E `18a–18e` — instantáneas con autoría; restauración con copia de seguridad automática; el contenido activo revierte; el historial conserva la versión posterior |
| 19 | Exportación PDF y Excel del estado compartido | ✔ PASA | E2E `19a–19e` — desde `#/preview` (vista completa, no modal): PDF válido (263 kB), Excel con hoja Parametros (tasa 0,3) y fórmula real del impuesto `=IF(…MAX(0,…))`; exportaciones precedidas de confirmación de pendientes |
| 20 | Importación/exportación JSON con reglas | ✔ PASA | E2E `20a–20c` — JSON con 40 reglas y 24 parámetros (tasa 0,3 del modelo = 30 %); importado como plan compartido nuevo y abierto |
| 21 | Verificación del despliegue estático | ✔ PASA | Toda la batería corrió contra el export estático bajo `/PlanNegocios/` (sin servidor); E2E `21a–21c` (Atrás/Adelante/recarga sin 404), `21d` (375 px sin desbordamiento), `21e` (prefers-reduced-motion) |
| 22 | Errores de consola y respuestas de Supabase | ✔ PASA | E2E `22` — 0 errores relevantes en ambas sesiones; solo 2 entradas benignas de red durante la simulación deliberada de desconexión (y el 400 del intento de contraseña errónea) |
| 23 | Revisión de políticas RLS y permisos | ✔ PASA | `REPORTE-SEGURIDAD.txt`: 9 tablas con RLS activado, 21 políticas listadas con roles/USING/WITH CHECK; Realtime con REPLICA IDENTITY FULL |

## Cobertura adicional (enmienda de vistas de la entrega anterior)

Landing sin sesión (E2E `A1–A3`), guardia de rutas con destino guardado (`B1/B2`),
login accesible con mostrar/ocultar contraseña, vista previa como página completa
y no modal (`19a`), navegación con Atrás/Adelante (`21a/21b`), recarga sin 404 bajo
subruta (`21c`), responsive 375 px (`21d`) y `prefers-reduced-motion` (`21e`).

## Cómo reproducir

```bash
# 1) servir el export estático bajo /PlanNegocios (igual que Pages)
bun run build && cp -r out ../e2e-root/PlanNegocios
python3 -m http.server 4173 --directory ../e2e-root

# 2) ejecutar la batería (contraseñas por entorno, nunca en el código)
E2E_C1_PASSWORD=… E2E_C2_PASSWORD=… node e2e/colaboracion.mjs
```

La batería crea sus propios planes de prueba y el informe queda en
`e2e/REPORTE-E2E.txt`. Los planes residuales pueden eliminarse desde el panel SQL
(sin tocar cuentas ni membresías).

## Pruebas unitarias del motor y exportadores

`bun test tests/planex/` — **58/58** (motor 35, Excel 16, PDF 7): la integración de
colaboración no rompió ninguna funcionalidad previa (motor configurable, editor
seguro de fórmulas, plantillas, exportaciones, temas).
