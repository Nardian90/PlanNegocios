// Elimina los planes de verificación de la base compartida (entrega prístina).
// Uso: bun run scripts/limpiar-planes-prueba.ts
import { readFileSync } from 'node:fs';
import { Client } from 'pg';

const env: Record<string, string> = {};
for (const linea of readFileSync('.env.admin.local', 'utf8').split('\n')) {
  const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2];
}
const c = new Client({
  host: env.SUPABASE_POOLER_HOST,
  port: 5432,
  database: 'postgres',
  user: 'postgres.huxxoiifdnmmrxcdxith',
  password: env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});
await c.connect();
const antes = await c.query('select id, title from public.plans order by created_at');
console.log('Planes antes:', antes.rows.map((r: { id: string; title: string }) => `${r.id.slice(0, 8)} ${r.title}`).join(' | ') || '(ninguno)');
const borra = await c.query('delete from public.plans');
console.log('Planes eliminados:', borra.rowCount);
const despues = await c.query('select count(*)::int as n from public.plans');
console.log('Planes después:', despues.rows[0].n);
const hist = await c.query("select count(*)::int as n from public.plan_versions");
console.log('Versiones huérfanas:', hist.rows[0].n);
await c.end();
