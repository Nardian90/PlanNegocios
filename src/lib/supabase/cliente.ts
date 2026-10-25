// ============================================================================
// PLANEX — Cliente Supabase de la SPA.
//
// La SPA desplegada en GitHub Pages usa EXCLUSIVAMENTE la clave publicable
// (sb_publishable_…). NUNCA se incluye aquí (ni en ningún módulo del cliente)
// una clave sb_secret_, service_role, contraseña de base de datos o
// credencial administrativa: la protección de los datos reside en la
// autenticación real (Supabase Auth) y en las políticas RLS del servidor.
//
// detectSessionInUrl = false: la navegación interna usa el fragmento de hash
// (#/…), que Supabase no debe interpretar como devolución de OAuth.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import type { Database } from './base-de-datos';

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

/** ¿Están definidas las variables de compilación mínimas? */
export function supabaseConfigurado(): boolean {
  return SUPABASE_URL.startsWith('https://') && SUPABASE_PUBLISHABLE_KEY.length > 20;
}

let instancia: ReturnType<typeof crearCliente> | null = null;

function crearCliente() {
  return createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // La app no usa flujos OAuth: no consumir el hash de la URL.
      detectSessionInUrl: false,
      storageKey: 'planex.sb.sesion',
      storage: {
        getItem: (k) => {
          try { return globalThis.localStorage?.getItem(k) ?? null; } catch { return null; }
        },
        setItem: (k, v) => {
          try { globalThis.localStorage?.setItem(k, v); } catch { /* sin almacenamiento */ }
        },
        removeItem: (k) => {
          try { globalThis.localStorage?.removeItem(k); } catch { /* sin almacenamiento */ }
        },
      },
    },
    realtime: { params: { eventsPerSecond: 8 } },
  });
}

export function supabase() {
  if (!instancia) instancia = crearCliente();
  return instancia;
}
