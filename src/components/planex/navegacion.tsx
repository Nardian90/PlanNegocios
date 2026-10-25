'use client';

// ============================================================================
// PLANEX — navegación por hash compatible con alojamiento estático
// (GitHub Pages en subruta). Cada vista tiene una URL diferenciada:
//
//   #/         → Landing de presentación
//   #/login    → Acceso mediante contraseña
//   #/app      → Aplicación (editor del plan)
//   #/preview  → Vista documental independiente del plan
//
// El fragmento de hash nunca viaja al servidor, por lo que recargar o
// compartir cualquier ruta interna no produce 404, y los botones Atrás /
// Adelante del navegador funcionan de forma nativa.
// ============================================================================

import * as React from 'react';

export type VistaRuta = 'landing' | 'login' | 'app' | 'preview';

export function vistaDesdeHash(hash: string): VistaRuta {
  const ruta = hash.replace(/^#/, '');
  if (ruta === '/login') return 'login';
  if (ruta === '/app' || ruta.startsWith('/app')) return 'app';
  if (ruta === '/preview' || ruta.startsWith('/preview')) return 'preview';
  return 'landing';
}

/**
 * Navega a una ruta interna ('/', '/login', '/app', '/preview').
 * Acepta el destino con o sin '#' inicial (p. ej. un destino guardado como
 * '#/preview') y crea siempre una entrada limpia en el historial.
 */
export function navegar(ruta: string): void {
  const limpia = ruta.replace(/^#+/, '').replace(/^\//, '');
  const destino = `#/${limpia}`;
  if (window.location.hash === destino) {
    // Forzar el evento aunque el hash no cambie (p. ej. re-navegar a la misma vista).
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  window.location.hash = destino;
}

/** Hook: vista activa derivada del hash, con escucha de hashchange (Atrás/Adelante, recargas). */
export function useRuta(): VistaRuta {
  const [vista, setVista] = React.useState<VistaRuta>(() =>
    typeof window === 'undefined' ? 'landing' : vistaDesdeHash(window.location.hash),
  );

  React.useEffect(() => {
    const alCambiar = () => {
      setVista(vistaDesdeHash(window.location.hash));
      // Cada vista es una "página": al cambiar de vista se empieza arriba.
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', alCambiar);
    return () => window.removeEventListener('hashchange', alCambiar);
  }, []);

  return vista;
}

/** ¿El usuario pidió que se respete la preferencia de movimiento reducido? */
export function prefiereMovimientoReducido(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
