// Reports locations and types, never secret values. No network or rotation.
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../../', import.meta.url));
const findings = [];
const seen = new Set();
function flag(label, contents, offset, type) {
  const line = contents.slice(0, offset).split('\n').length;
  const key = `${label}:${line}:${type}`;
  if (!seen.has(key)) { findings.push({ location: label, line, type }); seen.add(key); }
}
function inspect(label, contents) {
  const patterns = [
    ['private-key', /-----BEGIN (?:EC |RSA |OPENSSH )?PRIVATE KEY-----/g],
    ['supabase-secret', /sb_secret_[A-Za-z0-9_-]{20,}/g],
    ['google-api-key', /AIza[0-9A-Za-z_-]{35}/g],
    ['aws-access-key', /AKIA[0-9A-Z]{16}/g],
  ];
  for (const [type, pattern] of patterns) {
    for (const match of contents.matchAll(pattern)) flag(label, contents, match.index, type);
  }
  for (const match of contents.matchAll(/eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
    try {
      const payload = JSON.parse(Buffer.from(match[0].split('.')[1], 'base64url').toString('utf8'));
      if (payload.role === 'service_role') flag(label, contents, match.index, 'supabase-service-jwt');
    } catch { /* Not a JWT. */ }
  }
  for (const match of contents.matchAll(/(?:SUPABASE_SERVICE_ROLE_KEY|GOOGLE_PLACES_API_KEY|APPLE_CLIENT_SECRET|DATABASE_URL)\s*[=:]\s*["']([^"'\n]+)["']/g)) {
    if (match[1].length >= 16 && !/process\.env|example|placeholder|your[-_]|replace|development|test[-_]/i.test(match[1])) flag(label, contents, match.index, 'assigned-server-secret');
  }
}
const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['pipe','pipe','pipe'] });
const paths = git(['ls-files','--cached','--others','--exclude-standard','-z']).split('\0').filter(Boolean);
for (const name of paths) {
  const absolute = path.join(root, name);
  if (existsSync(absolute) && statSync(absolute).size <= 8 * 1024 * 1024) inspect(name, readFileSync(absolute, 'utf8'));
}
// Optional history audit walks distinct Git blobs, not every repeated snapshot.
let historyBlobs = 0;
let skippedLargeBlobs = 0;
if (process.argv.includes('--history')) {
  const objects = git(['rev-list','--objects','--all']).trim().split('\n');
  for (const object of objects) {
    const space = object.indexOf(' '); if (space < 0) continue;
    const hash = object.slice(0,space); const name = object.slice(space+1);
    if (git(['cat-file','-t',hash]).trim() !== 'blob') continue;
    if (Number(git(['cat-file','-s',hash])) > 8 * 1024 * 1024) { skippedLargeBlobs++; continue; }
    inspect(`git:${hash.slice(0,12)}:${name}`, git(['cat-file','blob',hash])); historyBlobs++;
  }
}
const clientRoot = path.join(root,'.next/static');
let browserFiles = 0;
const literalSecrets = [];
if (existsSync(path.join(root,'.env.local'))) {
  const env = readFileSync(path.join(root,'.env.local'),'utf8');
  for (const match of env.matchAll(/^(?:SUPABASE_SERVICE_ROLE_KEY|GOOGLE_PLACES_API_KEY|APPLE_CLIENT_SECRET|CRON_SECRET|SECURITY_RATE_LIMIT_SECRET)=(.*)$/gm)) {
    const value=match[1].trim().replace(/^["']|["']$/g,''); if(value.length>=16) literalSecrets.push(value);
  }
}
function visit(directory) {
  for (const entry of readdirSync(directory,{withFileTypes:true})) {
    const absolute=path.join(directory,entry.name);
    if(entry.isDirectory())visit(absolute);
    else if(/\.(?:js|json|map)$/.test(entry.name)) {
      const contents=readFileSync(absolute,'utf8'); const label=path.relative(root,absolute); browserFiles++; inspect(label,contents);
      for(const value of literalSecrets) { const index=contents.indexOf(value); if(index>=0)flag(label,contents,index,'configured-server-secret-in-browser'); }
    }
  }
}
if(existsSync(clientRoot))visit(clientRoot);
process.stdout.write(JSON.stringify({workingTreeFiles:paths.length,historyBlobs,skippedLargeBlobs,browserFiles,findings},null,2)+'\n');
process.exitCode = findings.length ? 1 : 0;
