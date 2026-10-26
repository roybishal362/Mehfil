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

/** Text files small enough to scan; images, fonts and archives cannot hold readable keys. */
const scannable = (file) =>
  !BINARY.test(file) && !SELF.has(file) && existsSync(file) && statSync(file).size <= 2_000_000;

/** Browser code (not its tests) is shipped to everyone, so it must not touch server config. */
const isClientCode = (file) => file.startsWith('src/client/') && !file.includes('.test.');

function problemsIn(file) {
  const text = readFileSync(file, 'utf8');
  const secrets = SECRET_PATTERNS.filter(({ regex }) => regex.test(text)).map(
    ({ name }) => `${file}: possible ${name}`,
  );
  const serverOnly = isClientCode(file)
    ? CLIENT_FORBIDDEN.filter((regex) => regex.test(text)).map(
        (regex) => `${file}: client code must not reference ${regex.source}`,
      )
    : [];
  return [...secrets, ...serverOnly];
}

const problems = listRepoFiles().filter(scannable).flatMap(problemsIn);

if (problems.length > 0) {
  console.error('Secret scan failed:\n' + problems.map((p) => `  - ${p}`).join('\n'));
  process.exit(1);
}
console.log('Secret scan passed: no credentials or server-only config found in publishable files.');
