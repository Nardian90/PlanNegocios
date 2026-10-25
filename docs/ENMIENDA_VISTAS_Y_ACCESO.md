# Enmienda: landing premium, acceso por contraseña y vista documental independiente

**Ampliación obligatoria de PLANEX Cuba** — publicada en la misma aplicación estática
(https://nardian90.github.io/PlanNegocios/). Este documento describe la nueva arquitectura
de vistas, la verificación ejecutada y las limitaciones reales de seguridad.

---

## 1. Arquitectura de vistas y navegación

La aplicación se organiza en vistas independientes con URL diferenciada por hash
(compatible con despliegue estático en subruta: ninguna ruta interna produce 404 al
recargar, y los botones Atrás/Adelante del navegador funcionan de forma nativa):

| Vista | Ruta | Acceso | Descripción |
|---|---|---|---|
| Landing | `#/` | Público | Presentación del producto (héroe, funcionalidades, metodología, producto, cierre) |
| Login | `#/login` | Público | Acceso mediante contraseña (sin usuario ni registro de cuentas) |
| Aplicación | `#/app` | Protegido | Editor del plan (4.1–4.12) con la configuración de cálculos integrada |
| Previsualización | `#/preview` | Protegido | Vista documental de página completa (no es modal) |

Flujo principal: **Landing → Login → Aplicación → Previsualización → edición**.

- La landing y el login son paquetes ligeros en la carga inicial; el editor (motor,
  plantillas, secciones) y la previsualización se cargan en diferido (`next/dynamic`),
  de modo que la maquinaria de edición financiera no se descarga antes de acceder.
- Las bibliotecas pesadas (jsPDF, xlsx-js-style) se importan en el instante de exportar,
  no en la carga de la vista.
- El estado del proyecto vive en un almacén global (zustand + localStorage): al pasar de
  la edición a la previsualización y regresar **no se recarga el proyecto desde la
  plantilla**; al desmontar el editor se vuelca el estado vigente sincrónicamente, por lo
  que ningún cambio queda sin persistir aunque el autoguardado (debounce 700 ms) esté
  pendiente. La previsualización restaura el proyecto guardado al entrar por recarga
  directa de la URL.
- El retorno desde la previsualización («Volver a editar») conserva la sección de edición
  en la que estaba el usuario.

## 2. Acceso mediante contraseña

- La **única credencial** es una contraseña; no existe campo de usuario, correo ni
  registro de cuentas. La contraseña correcta es `PLANEX`, comparada de forma **exacta
  y sensible a mayúsculas** (`planex` y `Planex` son rechazadas).
- El formulario incluye: marca, título «Acceso a PLANEX», campo oculto, botón de
  mostrar/ocultar, botón «Entrar» (también con Enter), mensaje de error anunciable
  (`role="alert"`, `aria-invalid`), indicador discreto de procesamiento y acceso de
  regreso a la landing. La contraseña no aparece en la ayuda, el placeholder ni los
  mensajes de error, y nunca se almacena.
- **Protección de vistas**: la navegación comprueba la sesión antes de renderizar
  `#/app` y `#/preview`. Sin sesión, el visitante es redirigido al login **conservando
  el destino solicitado**, al que regresa automáticamente tras autenticarse. También se
  comprueba al recargar y ante entradas directas por URL.
- **Sesión**: `sessionStorage` (vive durante la pestaña y sus recargas). El cierre de
  sesión limpia el estado de autenticación y regresa a la landing **sin borrar los
  proyectos guardados** (localStorage).

### Limitación real de seguridad (documentación obligatoria)

**La contraseña verificada en el cliente no constituye autenticación segura.** El código
descargado por el navegador puede inspeccionarse y la comprobación puede eludirse: es
un sitio estático público. No se ofusca la contraseña ni se simula seguridad mediante
hashes públicos o variables de entorno de compilación, porque ninguno de esos recursos
convierte una aplicación estática pública en una protegida. El mecanismo solo ofrece una
**barrera de acceso básica para uso personal o demostrativo**. Para confidencialidad
real debe añadirse autenticación del lado del servidor o de un proveedor de control de
acceso antes de considerar protegidos los datos. No se afirma que el acceso esté
protegido frente a usuarios maliciosos.

## 3. Vista dedicada de previsualización

- La antigua previsualización **modal fue eliminada por completo**: la vista documental
  es una página completa en la ruta `#/preview`, sin diálogo, drawer ni ventana flotante.
- Barra de acciones separada del documento: «Volver a editar», «Guardar proyecto»,
  «Imprimir», «Exportar PDF», «Exportar Excel», indicador del proyecto actual e
  indicador de estado (cambios pendientes / guardado). Si el modelo tiene errores de
  cálculo, una barra los advierte antes de las exportaciones.
- El documento (portada, índice, 4.1–4.12, notas y advertencia de datos ficticios)
  mantiene **fondo neutro claro constante** aunque la interfaz esté en tema Dark, con
  márgenes documentales y tipografía institucional.
- **Sincronización**: el documento se recalcula con el modelo vigente en cada render.
  Al cambiar un precio (25 → 30 USD) el ingreso anual del servicio pasa de 967,8 a
  991,8 kUSD en el documento **sin cifras antiguas**. PDF y Excel se generan con el
  mismo modelo activo (verificado: blob PDF de ~271 KB generado desde la vista con las
  cifras vigentes; la igualdad de contenido PDF-motor está cubierta además por las
  pruebas unitarias de `tests/planex/pdf.test.ts`).

## 4. Landing premium

- Dirección de arte editorial premium: fondo tinta profundo, retícula técnica sutil,
  tipografía serif expresiva (Fraunces, autofijada en el build — sin CDN en ejecución),
  acento cobre coherente con la identidad del producto, composición asimétrica,
  hairlines y espacio negativo deliberado. **No hay tarjetas genéricas redondeadas** ni
  apariencia de plantilla SaaS.
- Contenido real y jerarquía comercial: héroe («De los supuestos a un plan de negocios
  estructurado»), botones «Acceder a PLANEX» y «Explorar funcionalidades», índice
  editorial de 8 funcionalidades reales, metodología de 5 pasos, **capturas reales** de
  la interfaz (corresponden a funciones implementadas; sin maquetas de funciones
  inexistentes), cierre con llamada a la acción y pie discreto con la nota de
  validación de normas y datos.
- Sin testimonios inventados, cifras de clientes, estadísticas sin respaldo ni premios;
  sin afirmaciones de «cumplimiento garantizado» ni «proyecto aprobado».
- Animaciones: trazos SVG que se dibujan una sola vez, aparición progresiva por
  IntersectionObserver y microinteracciones CSS. **Se respeta
  `prefers-reduced-motion`** (animaciones a 0,01 ms, elementos visibles sin transición)
  y el contenido principal aparece inmediatamente, sin pantalla de espera.
- Responsive en escritorio, tableta y móvil (verificado en 1920×1080, 820×1180 y
  390×844 sin desbordamiento horizontal).

## 5. Compatibilidad con GitHub Pages

- Despliegue estático sin servidor ni API; exportación `output: 'export'` con ruta base
  `NEXT_PUBLIC_BASE_PATH=/PlanNegocios` (equivalente a la opción `base` de Vite en esta
  arquitectura Next.js, inspeccionada antes de reutilizarla).
- Navegación por hash: **ninguna vista interna produce 404 al recargar**; los recursos
  (CSS, JS, fuentes autofijadas, imágenes, favicon) resuelven bajo la subruta.
- No hay secretos en variables de entorno del frontend ni dependencias de CDN para
  funciones esenciales; PDF/Excel/JSON y el almacenamiento siguen ejecutándose en el
  navegador.
- El workflow de despliegue existente (`.github/workflows/deploy.yml`) no cambió.

## 6. Pruebas ejecutadas (20 casos de la enmienda)

Método: exportación estática servida bajo `/PlanNegocios/` (equivalente al despliegue de
GitHub Pages) y verificación en navegador real (Chromium headless), además de la suite
unitaria existente (58/58: motor 35 + Excel 16 + PDF 7), lint sin errores y build de
producción.

| # | Prueba | Resultado |
|---|---|---|
| 1 | La landing carga sin iniciar sesión | ✔ Héroe y CTAs visibles; sessionStorage vacía |
| 2 | «Acceder a PLANEX» conduce al login | ✔ URL `#/login` |
| 3 | El login no solicita nombre de usuario | ✔ 1 solo input (password); 0 campos de usuario/correo |
| 4 | La contraseña `PLANEX` permite continuar | ✔ URL `#/app`; sesión `planex.sesion=1`; app abierta con selector de plantillas |
| 5 | Una contraseña incorrecta no autoriza | ✔ `planex` (minúsculas) rechazada; error `role=alert`, `aria-invalid=true`; permanece en el login |
| 6 | Acceso directo a vista protegida sin sesión redirige al login | ✔ `#/preview` → `#/login` con destino guardado; tras `PLANEX` regresa a `#/preview` (limpio) |
| 7 | La aplicación se abre correctamente tras autenticarse | ✔ Ejemplo clínica cargado; cifras del motor visibles |
| 8 | El cierre de sesión impide seguir como autenticado | ✔ URL `#/` (landing); sesión y destino limpiados; `#/app` directo re-dirige al login |
| 9 | Los proyectos guardados no se eliminan al cerrar sesión | ✔ `planex.proyecto.actual` + `planex.proyecto.<id>` + `planex.biblioteca` intactos tras logout |
| 10 | La previsualización es vista dedicada, no modal | ✔ URL `#/preview`; 0 elementos `[role=dialog]`; barra con Volver/PDF/Excel/Guardar; 10 hojas documentales |
| 11 | El retorno a edición mantiene los datos | ✔ Precio 30 persistente al volver; sección de edición conservada (4.6) |
| 12 | El PDF refleja los mismos datos que la previsualización | ✔ Blob PDF (~271 KB) generado desde la vista con el modelo vigente (precio 30 → 991,8 en el documento); igualdad PDF-motor cubierta por 7 pruebas unitarias |
| 13 | Navegación con Atrás y Adelante | ✔ `#/preview` → Atrás → `#/app` → Adelante → `#/preview` |
| 14 | Una recarga en rutas internas no produce 404 | ✔ Recarga en `#/preview`: documento presente; ruta conservada |
| 15 | Rutas y recursos bajo subruta de GitHub Pages | ✔ 200 en capturas, logo, robots y CSS bajo `/PlanNegocios/`; imágenes de la landing cargadas (1440/1280 px) |
| 16 | Landing utilizable en móvil, tableta y escritorio | ✔ 390×844, 820×1180, 1920×1080 sin desbordamiento horizontal; menú adaptado |
| 17 | Efectos respetan el movimiento reducido | ✔ Emulación `prefers-reduced-motion`: `matches=true`, animaciones 0,01 ms, elementos revelados visibles |
| 18 | Sin recursos externos indispensables | ✔ 0 solicitudes a dominios externos durante toda la navegación |
| 19 | Sin errores importantes en consola | ✔ 0 errores de página y 0 mensajes de error/advertencia en consola en landing→login→app→preview |
| 20 | Compilación y despliegue estático funcionan | ✔ `next build` (export) OK; workflow de Pages en verde; verificación en vivo tras el push (commit de la enmienda) |

Errores detectados y corregidos durante la verificación: la navegación al destino
guardado generaba un hash duplicado (`##/preview` → landing). Corregido en `navegar()`
(acepta rutas con o sin `#` inicial) y reverificado (caso 6).

## 7. Limitaciones conocidas de esta ampliación

1. **Seguridad del acceso**: la contraseña en el cliente es una barrera demostrativa, no
   autenticación (sección 2).
2. La protección depende de que el atacante no manipule el código descargado; cualquier
   usuario técnico puede eludirla.
3. La sesión por `sessionStorage` no se comparte entre pestañas (comportamiento
   elegido, no defecto).
4. Las capturas de la sección «Producto» corresponden a la interfaz real de la versión
   anterior a la enmienda para las áreas mostradas (editor 4.7 y tema oscuro); las
   funciones representadas existen y no se muestran como capturas capacidades
   inexistentes.
