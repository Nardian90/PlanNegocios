// ============================================================================
// Formato numérico y documental (español; kUSD con un decimal per metodología)
//
// NOTA: el ICU de este entorno NO inserta el separador de miles es-ES
// («2265,0» en vez de «2.265,0»), por lo que el agrupado se aplica de forma
// manual y determinista. La Gaceta (GOC-2026-O57) publica los importes en
// miles con un decimal y agrupación de miles con punto (p. ej. «1.480,0»).
// ============================================================================

/** Agrupa la parte entera con puntos de miles (es-ES manual y determinista). */
function grupoEs(n: number): string {
  const abs = Math.abs(n);
  const entero = Math.floor(abs).toString();
  let salida = '';
  for (let i = 0; i < entero.length; i++) {
    const digito = entero[entero.length - 1 - i];
    if (i > 0 && i % 3 === 0) salida += '.';
    salida += digito;
  }
  return (n < 0 ? '-' : '') + salida.split('').reverse().join('');
}

/** Formato es-ES con un número dado de decimales y agrupación manual de miles. */
function esES(n: number, decimales: number): string {
  if (!Number.isFinite(n)) return '—';
  const f = Math.pow(10, decimales);
  const redondeado = Math.round(Math.abs(n) * f) / f;
  const parte = redondeado.toFixed(decimales);
  const [ent, dec] = parte.split('.');
  const entero = grupoEs(Number(ent));
  const coma = decimales > 0 ? `,${dec}` : '';
  return `${n < 0 ? '-' : ''}${entero}${coma}`;
}

export function fmtK(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return esES(n, 1);
}

export function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return esES(n, 0);
}

export function fmtCUP(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return `${esES(n, 0)} CUP`;
}

export function fmtPct(n: number | null | undefined, decimales = 1): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return `${esES(n * 100, decimales)} %`;
}

export function fmtUsd(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return `${esES(n, 2)} USD`;
}

export function fmtAnios(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return `${esES(n, 1)} años`;
}

export function fechaLarga(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function mesAnio(ym: string): string {
  if (!ym) return '—';
  const [y, m] = ym.split('-');
  const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const idx = Number(m) - 1;
  if (!y || idx < 0 || idx > 11) return ym;
  return `${meses[idx]} ${y}`;
}

/** ¿Está el campo VACÍO o marcado expresamente como PENDIENTE de completar?
 *  Misión DOC-002 §3.4: los campos obligatorios sin completar se muestran
 *  como pendientes con un rótulo profesional («[Pendiente: …]») y NUNCA
 *  deben interpretarse como completados. */
export function esValorPendiente(v: string | number | undefined | null): boolean {
  if (v === undefined || v === null) return true;
  if (typeof v === 'number') return !Number.isFinite(v);
  const t = v.trim();
  if (!t || t === '—' || t === '-') return true;
  return /^\[?\s*pendiente\b/i.test(t) || /^pendiente\b/i.test(t);
}

/** ¿Declara una referencia documental IDENTIFICABLE (no una mera hipótesis
 *  ficticia de demostración)? Misión DOC-002 §5: un campo «con referencia
 *  documental» exige una referencia identificable; un supuesto ficticio NO
 *  cuenta como fuente validada. */
export function esReferenciaHipotesis(v: string | undefined | null): boolean {
  if (!v?.trim()) return true;
  return /fictici|ilustrativ|supuesto|demostraci|pendiente|proforma|hipot|a validar|sin verificar/i.test(v);
}
