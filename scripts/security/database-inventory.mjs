// Repository-only inventory: no database connection, credentials or user rows.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../../', import.meta.url));
export async function databaseInventory() {
  const files = (await readdir(path.join(root, 'supabase/migrations'))).filter(name => name.endsWith('.sql')).sort();
  const migrations = [];
  for (const file of files) {
    const sql = await readFile(path.join(root, 'supabase/migrations', file), 'utf8');
    migrations.push({
      file, sha256: createHash('sha256').update(sql).digest('hex'),
      tables: [...sql.matchAll(/create table public\.(\w+)/gi)].map(match => match[1]),
      rlsEnabled: [...sql.matchAll(/alter table public\.(\w+) enable row level security/gi)].map(match => match[1]),
      // Include complete definitions so every predicate and grant is reviewable.
      policies: [...sql.matchAll(/(?:create|drop) policy[^;]*;/gi)].map(match => match[0]),
      grants: [...sql.matchAll(/(?:^|\n)((?:grant|revoke|alter default privileges) [\s\S]*?;)/gi)].map(match => match[1]),
      functions: [...sql.matchAll(/create (?:or replace )?function public\.(\w+)[\s\S]*?\$\$;/gi)].map(match => ({ name: match[1], sql: match[0] })),
      views: [...sql.matchAll(/create (?:or replace )?view public\.(\w+)[\s\S]*?;/gi)].map(match => match[0]),
      authForeignKeys: [...sql.matchAll(/\w+ uuid[^,;\n]*references (?:auth\.users|public\.(?:profiles|profile_identities))\([^\n]*/gi)].map(match => match[0]),
    });
  }
  return { schemaVersion: 1, scope: 'Repository SQL only; run live-drift.sql to verify deployed state.', migrations };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const inventory = await databaseInventory();
  const destination = process.argv[2];
  if (destination) await writeFile(destination, `${JSON.stringify(inventory, null, 2)}\n`);
  else process.stdout.write(`${JSON.stringify(inventory, null, 2)}\n`);
}
