// Aplica una migración SQL a la base de datos remota de Supabase (pooler IPv4).
// Uso: bun run scripts/aplicar-migracion.ts <ruta.sql>
// Lee SUPABASE_POOLER_HOST y SUPABASE_DB_PASSWORD de .env.admin.local.
import { readFileSync } from 'node:fs';
import { Client } from 'pg';

const ruta = process.argv[2];
if (!ruta) {
  console.error('Uso: bun run scripts/aplicar-migracion.ts <ruta.sql>');
  process.exit(1);
}

// Carga manual de .env.admin.local (no usa dotenv para no añadir dependencias).
const env: Record<string, string> = {};
for (const linea of readFileSync('.env.admin.local', 'utf8').split('\n')) {
  const m = linea.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2];
}

const host = env.SUPABASE_POOLER_HOST ?? 'aws-0-us-east-2.pooler.supabase.com';
const password = env.SUPABASE_DB_PASSWORD;
if (!password) {
  console.error('SUPABASE_DB_PASSWORD no está definida en .env.admin.local');
  process.exit(1);
}

const sql = readFileSync(ruta, 'utf8');
const cliente = new Client({
  host,
  port: 5432,
  database: 'postgres',
  user: 'postgres.huxxoiifdnmmrxcdxith',
  password,
  ssl: { rejectUnauthorized: false },
});

try {
  await cliente.connect();
  const res = await cliente.query(sql);
  console.log('Migración aplicada:', ruta);
  for (const r of res ?? []) {
    if (r?.command) console.log('  >', r.command, r.rowCount !== undefined ? `(${r.rowCount} filas)` : '');
  }
} catch (e) {
  console.error('ERROR:', (e as Error).message);
  process.exit(1);
} finally {
  await cliente.end();
}
