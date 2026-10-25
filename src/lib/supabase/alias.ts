// ============================================================================
// PLANEX — Alias de colaborador → cuenta de Supabase Auth.
//
// El usuario introduce un ALIAS («Colaborador1»/«Colaborador2»), nunca su
// correo. El alias se normaliza de forma consistente (recorte, minúsculas,
// sin espacios internos ni diacríticos) y se resuelve al correo interno
// configurado en variables de compilación PÚBLICAS (no secretas).
//
// La contraseña la introduce el usuario y se envía únicamente al endpoint
// estándar de Supabase Auth (correo + contraseña). La comparación la hace
// el SERVIDOR; el cliente no guarda contraseñas ni las compara localmente.
// ============================================================================

const CORREOS: Record<string, string> = {
  colaborador1: process.env.NEXT_PUBLIC_PLANEX_COLABORADOR1_EMAIL ?? '',
  colaborador2: process.env.NEXT_PUBLIC_PLANEX_COLABORADOR2_EMAIL ?? '',
};

/** Normaliza un alias: minúsculas, sin espacios ni diacríticos. */
export function normalizarAlias(entrada: string): string {
  return (entrada ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

export interface AliasResuelto {
  aliasNormalizado: string;
  email: string;
}

/** Devuelve el correo interno del alias, o null si el alias no está admitido. */
export function resolverAlias(entrada: string): AliasResuelto | null {
  const alias = normalizarAlias(entrada);
  const email = CORREOS[alias];
  if (!alias || !email) return null;
  return { aliasNormalizado: alias, email };
}

/** Alias admitidos (para ayudas de la interfaz). */
export function aliasesAdmitidos(): string[] {
  return Object.keys(CORREOS).filter((k) => CORREOS[k]);
}
