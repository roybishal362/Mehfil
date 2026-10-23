/**
 * Fails the build if anything that looks like a credential is about to be published,
 * or if client code references server-only configuration.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { listRepoFiles } from './lib/repo-files.mjs';

const SECRET_PATTERNS = [
  { name: 'Google API key', regex: /AIza[0-9A-Za-z_-]{35}/ },
  { name: 'Private key block', regex: /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/ },
  { name: 'Service-account JSON', regex: /"type"\s*:\s*"service_account"/ },
  // Only spaces/tabs may follow `=`, so an empty `GEMINI_API_KEY=` line is allowed.
  { name: 'Assigned GEMINI_API_KEY', regex: /^[ \t]*GEMINI_API_KEY[ \t]*=[ \t]*[^\s#]+/m },
];

/** Server-only names that must never appear in browser code. */
const CLIENT_FORBIDDEN = [/process\.env/, /GEMINI_API_KEY/];

const BINARY = /\.(png|jpe?g|webp|gif|ico|woff2?|ttf|otf|pdf|zip)$/i;
const SELF = new Set(['scripts/check-secrets.mjs']);

const problems = [];

for (const file of listRepoFiles()) {
  if (BINARY.test(file) || SELF.has(file) || !existsSync(file) || statSync(file).size > 2_000_000)
    continue;
  const text = readFileSync(file, 'utf8');

  for (const { name, regex } of SECRET_PATTERNS) {
    if (regex.test(text)) problems.push(`${file}: possible ${name}`);
  }

  if (file.startsWith('src/client/') && !file.includes('.test.')) {
    for (const regex of CLIENT_FORBIDDEN) {
      if (regex.test(text))
        problems.push(`${file}: client code must not reference ${regex.source}`);
    }
  }
}

if (problems.length > 0) {
  console.error('Secret scan failed:\n' + problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}
console.log('Secret scan passed: no credentials or server-only config found in publishable files.');
