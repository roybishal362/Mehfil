/**
 * Keeps the public repository well under the PromptWars 10 MB limit.
 * Budget: 5 MB total, and no single file over 500 KB (the lockfile is allowed 2 MB).
 */
import { existsSync, statSync } from 'node:fs';
import { listRepoFiles } from './lib/repo-files.mjs';

const TOTAL_BUDGET = 5 * 1024 * 1024;
const FILE_BUDGET = 500 * 1024;
const LOCKFILE_BUDGET = 2 * 1024 * 1024;

let total = 0;
const oversized = [];

for (const file of listRepoFiles()) {
  if (!existsSync(file)) continue;
  const size = statSync(file).size;
  total += size;
  const limit = file === 'package-lock.json' ? LOCKFILE_BUDGET : FILE_BUDGET;
  if (size > limit) oversized.push(`${file} (${(size / 1024).toFixed(0)} KB)`);
}

const mb = (total / 1024 / 1024).toFixed(2);
if (total > TOTAL_BUDGET || oversized.length > 0) {
  console.error(`Repository size check failed: ${mb} MB total.`);
  for (const file of oversized) console.error(`  - oversized: ${file}`);
  process.exit(1);
}
console.log(`Repository size OK: ${mb} MB (budget 5 MB, PromptWars limit 10 MB).`);
