// ============================================================================
// PLANEX — control de acceso de la interfaz (solo contraseña).
//
// ⚠️ LIMITACIÓN DE SEGURIDAD DOCUMENTADA (requisito de la enmienda, epígrafe
// 3.4). La contraseña se verifica EN EL CLIENTE, en un despliegue estático
// público (GitHub Pages). Esto NO constituye autenticación segura:
//
//   - El código JavaScript descargado por el navegador puede inspeccionarse
//     y la comprobación puede eludirse.
//   - Ninguna contraseña, hash público u variable de entorno de compilación
//     convierte una aplicación estática pública en una protegida; por eso
//     aquí NO se ofusca ni se simula seguridad.
//
// El mecanismo solo ofrece una barrera de acceso básica para uso personal o
// demostrativo. Para confidencialidad real debe añadirse autenticación del
// lado del servidor o de un proveedor de control de acceso antes de
// considerar protegidos los datos.
//
// La sesión se mantiene en sessionStorage (vive durante la pestaña y sus
// recargas; no se comparte entre pestañas). Nunca se almacena la contraseña
// introducida.
// ============================================================================

/** Contraseña de acceso (comparación exacta y sensible a mayúsculas). */
export const CONTRASENA_ACCESO = 'PLANEX';

const CLAVE_SESION = 'planex.sesion';
const CLAVE_DESTINO = 'planex.destino';

export function sesionActiva(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(CLAVE_SESION) === '1';
  } catch {
    return false;
  }
}

export function iniciarSesion(): void {
  try {
    window.sessionStorage.setItem(CLAVE_SESION, '1');
  } catch {
    /* almacenamiento no disponible: la navegación protegida degradará al login */
  }
}

/** Limpia la sesión SIN tocar localStorage: los proyectos guardados se conservan. */
export function cerrarSesion(): void {
  try {
    window.sessionStorage.removeItem(CLAVE_SESION);
    window.sessionStorage.removeItem(CLAVE_DESTINO);
  } catch {
    /* nada que limpiar */
  }
}

/** Guarda la ruta protegida solicitada para volver a ella tras autenticarse. */
export function guardarDestino(hash: string): void {
  try {
    // Solo destinos internos válidos; nunca guardar basura.
    if (hash === '#/app' || hash === '#/preview' || hash.startsWith('#/app') || hash.startsWith('#/preview')) {
      window.sessionStorage.setItem(CLAVE_DESTINO, hash);
    }
  } catch {
    /* sin almacenamiento: el acceso irá a la aplicación */
  }
}

/** Devuelve y limpia la ruta protegida pendiente (si existe). */
export function consumirDestino(): string | null {
  try {
    const d = window.sessionStorage.getItem(CLAVE_DESTINO);
    window.sessionStorage.removeItem(CLAVE_DESTINO);
    return d;
  } catch {
    return null;
  }
}

/**
 * Comparación exacta y sensible a mayúsculas/minúsculas.
 * 'PLANEX' es válida; 'planex' y 'Planex' no lo son.
 */
export function contrasenaCorrecta(introducida: string): boolean {
  return introducida === CONTRASENA_ACCESO;
}
