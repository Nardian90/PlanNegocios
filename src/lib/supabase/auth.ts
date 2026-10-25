'use client';

// ============================================================================
// PLANEX — Autenticación real con Supabase Auth (correo interno + contraseña)
// a partir de un ALIAS de colaborador, y sesión gestionada por Supabase.
//
//   - La sesión la gestiona supabase-js (persistencia + refresco de token);
//     aquí solo se refleja su estado en un almacén zustand para la UI.
//   - El alias se resuelve al correo interno (variable de compilación
//     pública) y se verifica en el SERVIDOR con correo+contraseña.
//   - Tras autenticar se comprueba que la cuenta tenga perfil y pertenencia
//     al espacio compartido (workspace_members, protegida por RLS).
//   - Las contraseñas nunca se almacenan (ni aquí ni en ningún sitio del
//     cliente); este módolo no compara contraseñas localmente.
// ============================================================================

import { create } from 'zustand';
import { supabase, supabaseConfigurado } from './cliente';
import { resolverAlias, normalizarAlias } from './alias';
import type { PerfilRow, MembresiaRow } from './tipos';

export type EstadoAuth = 'cargando' | 'anonimo' | 'autenticado' | 'no_configurado';

export interface UsuarioPlanex {
  id: string;
  email: string;
  alias: string;
  perfil: PerfilRow | null;
  membresia: MembresiaRow | null;
}

interface EstadoAuthStore {
  estado: EstadoAuth;
  usuario: UsuarioPlanex | null;
  errorPendiente: string | null;
  iniciar: () => Promise<void>;
  entrar: (alias: string, contrasena: string) => Promise<{ ok: boolean; error?: string }>;
  salir: () => Promise<void>;
}

export const useAuth = create<EstadoAuthStore>((set, get) => ({
  estado: supabaseConfigurado() ? 'cargando' : 'no_configurado',
  usuario: null,
  errorPendiente: null,

  // Restaura la sesión persistida por supabase-js (recarga de la pestaña).
  iniciar: async () => {
    if (!supabaseConfigurado()) {
      set({ estado: 'no_configurado' });
      return;
    }
    try {
      const { data } = await supabase().auth.getSession();
      if (!data.session) {
        set({ estado: 'anonimo', usuario: null });
        return;
      }
      const ok = await verificarPerfilYSesion(data.session.user.id, data.session.user.email ?? '', set);
      if (!ok) {
        await supabase().auth.signOut();
        set({ estado: 'anonimo', usuario: null });
        return;
      }
    } catch {
      // Error de red al restaurar: no hay sesión fiable.
      set({ estado: 'anonimo', usuario: null });
    }

    // Reaccionar a cierres de sesión/revocaciones iniciados en otras capas.
    supabase().auth.onAuthStateChange((evento) => {
      if (evento === 'SIGNED_OUT' && get().estado === 'autenticado') {
        set({ estado: 'anonimo', usuario: null });
      }
    });
  },

  entrar: async (alias, contrasena) => {
    if (!supabaseConfigurado()) {
      return { ok: false, error: 'La aplicación no está configurada para la colaboración en línea (faltan las variables de compilación de Supabase).' };
    }
    const resuelto = resolverAlias(alias);
    if (!resuelto) {
      return { ok: false, error: 'Usuario no reconocido. Use uno de los alias de colaborador autorizados.' };
    }
    try {
      const { data, error } = await supabase().auth.signInWithPassword({
        email: resuelto.email,
        password: contrasena,
      });
      if (error || !data.session) {
        return { ok: false, error: 'Usuario o contraseña incorrectos. Vuelva a intentarlo.' };
      }
      const ok = await verificarPerfilYSesion(data.session.user.id, data.session.user.email ?? '', set);
      if (!ok) {
        await supabase().auth.signOut();
        return { ok: false, error: 'La cuenta no tiene perfil o no pertenece al espacio de trabajo autorizado. Contacte al administrador.' };
      }
      return { ok: true };
    } catch (e) {
      return { ok: false, error: `No se pudo contactar el servicio de autenticación: ${(e as Error).message}` };
    }
  },

  salir: async () => {
    try {
      await supabase().auth.signOut();
    } catch {
      /* la sesión local se limpia de todos modos */
    }
    set({ estado: 'anonimo', usuario: null });
  },
}));

/** Carga perfil y pertenencia del usuario autenticado; false si no son válidos. */
async function verificarPerfilYSesion(userId: string, email: string, set: (p: Partial<EstadoAuthStore>) => void): Promise<boolean> {
  const sb = supabase();
  const { data: perfil } = await sb.from('profiles').select('id,username,display_name,created_at,updated_at').eq('id', userId).maybeSingle<PerfilRow>();
  const { data: membresia } = await sb
    .from('workspace_members')
    .select('workspace_id,user_id,role,created_at,workspaces(id,name,description)')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle<MembresiaRow>();

  if (!perfil || !membresia) return false;

  set({
    estado: 'autenticado',
    usuario: {
      id: userId,
      email,
      alias: perfil.username ?? normalizarAlias(email.split('@')[0] ?? ''),
      perfil,
      membresia,
    },
    errorPendiente: null,
  });
  return true;
}

// ----------------------------------------------------------------------------
// Destino de navegación guardado (vuelve a la vista pedida tras autenticar).
// ----------------------------------------------------------------------------

const CLAVE_DESTINO = 'planex.destino';

export function guardarDestino(hash: string): void {
  try {
    if (hash === '#/proyectos' || hash.startsWith('#/editor') || hash.startsWith('#/preview') || hash === '#/app') {
      window.sessionStorage.setItem(CLAVE_DESTINO, hash);
    }
  } catch {
    /* sin almacenamiento: el acceso irá a los proyectos */
  }
}

export function consumirDestino(): string | null {
  try {
    const d = window.sessionStorage.getItem(CLAVE_DESTINO);
    window.sessionStorage.removeItem(CLAVE_DESTINO);
    return d;
  } catch {
    return null;
  }
}
