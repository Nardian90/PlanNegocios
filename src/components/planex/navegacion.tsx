'use client';

// ============================================================================
// PLANEX — navegación por hash compatible con alojamiento estático
// (GitHub Pages en subruta). Cada vista tiene una URL diferenciada:
//
//   #/               → Landing de presentación        (pública)
//   #/login          → Acceso con alias+contraseña     (pública)
//   #/proyectos    → Panel de proyectos compartidos (protegida)
//   #/editor?plan= → Editor del plan                  (protegida)
//   #/preview?plan=→ Vista documental independiente (protegida)
//   #/colaboracion?plan=&tab= → Colaboración, historial y versiones (protegida)
//   #/ayuda?capa=&articulo=    → Centro de ayuda Diátaxis (pública)
//
// El fragmento de hash nunca viaja al servidor: recargar o compartir
// cualquiera de estas rutas no produce 404 y Atrás/Adelante funcionan de
// forma nativa, incluso bajo la subruta /PlanNegocios de GitHub Pages.
// ============================================================================

import * as React from 'react';

export type VistaRuta = 'landing' | 'login' | 'proyectos' | 'editor' | 'preview' | 'colaboracion' | 'ayuda';

export function rutaDeHash(hash: string): string {
  const ruta = hash.replace(/^#/, '');
  const sinQuery = ruta.split('?')[0] || '/';
  return sinQuery;
}

export function vistaDesdeHash(hash: string): VistaRuta {
  const ruta = rutaDeHash(hash);
  if (ruta === '/login') return 'login';
  if (ruta === '/proyectos' || ruta.startsWith('/proyectos')) return 'proyectos';
  // '/app' se conserva como alias histórico del editor.
  if (ruta === '/app' || ruta === '/editor' || ruta.startsWith('/app') || ruta.startsWith('/editor')) return 'editor';
  if (ruta === '/preview' || ruta.startsWith('/preview')) return 'preview';
  if (ruta === '/colaboracion' || ruta.startsWith('/colaboracion')) return 'colaboracion';
  if (ruta === '/ayuda' || ruta.startsWith('/ayuda')) return 'ayuda';
  return 'landing';
}

/** Parámetros de consulta transportados en el hash (p. ej. ?plan=<uuid>). */
export function parametrosDesdeHash(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const query = window.location.hash.replace(/^#/, '').split('?')[1] ?? '';
  const salida: Record<string, string> = {};
  for (const par of query.split('&')) {
    if (!par) continue;
    const [k, v = ''] = par.split('=');
    if (k) salida[decodeURIComponent(k)] = decodeURIComponent(v);
  }
  return salida;
}

/**
 * Navega a una ruta interna ('/', '/login', '/proyectos', '/editor?plan=x',
 * '/preview?plan=x'). Acepta el destino con o sin '#' inicial y crea siempre
 * una entrada limpia en el historial.
 */
export function navegar(ruta: string): void {
  const limpia = ruta.replace(/^#+/, '').replace(/^\//, '');
  const destino = `#/${limpia}`;
  if (window.location.hash === destino) {
    // Forzar el evento aunque el hash no cambie (re-navegación a la misma vista).
    window.dispatchEvent(new HashChangeEvent('hashchange'));
    return;
  }
  window.location.hash = destino;
}

/** Hook: vista activa derivada del hash (Atrás/Adelante, recargas, entradas directas). */
export function useRuta(): VistaRuta {
  const [vista, setVista] = React.useState<VistaRuta>(() =>
    typeof window === 'undefined' ? 'landing' : vistaDesdeHash(window.location.hash),
  );

  React.useEffect(() => {
    const alCambiar = () => {
      setVista(vistaDesdeHash(window.location.hash));
      // Cada vista es una «página»: al cambiar de vista se empieza arriba.
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

// ----------------------------------------------------------------------------
// Ayuda y vistas con pestañas: URL con parámetros reproducibles
// ----------------------------------------------------------------------------

/** Construye la URL hash interna de un artículo del Centro de ayuda. */
export function urlAyuda(capa?: string, articulo?: string): string {
  const params = new URLSearchParams();
  if (capa) params.set('capa', capa);
  if (articulo) params.set('articulo', articulo);
  const q = params.toString();
  return `#/ayuda${q ? `?${q}` : ''}`;
}

/**
 * Abre el Centro de ayuda EN OTRA PESTAÑA del navegador, directo al artículo
 * solicitado. Así el contexto de edición nunca se pierde: el formulario y los
 * cambios sin guardar permanecen intactos en la pestaña de trabajo y la
 * vuelta a la tarea es cerrar la pestaña (o cambiar de una a otra).
 */
export function abrirAyuda(capa?: string, articulo?: string): void {
  if (typeof window === 'undefined') return;
  const base = `${window.location.origin}${window.location.pathname}`;
  window.open(`${base}${urlAyuda(capa, articulo)}`, '_blank', 'noopener');
}

/** Navega en ESTA pestaña a la vista de colaboración del plan activo. */
export function irAColaboracion(planId: string, tab?: string): void {
  const t = tab ? `&tab=${encodeURIComponent(tab)}` : '';
  navegar(`/colaboracion?plan=${encodeURIComponent(planId)}${t}`);
}
