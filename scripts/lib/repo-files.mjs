import { execFileSync } from 'node:child_process';

/**
 * Lists every file git would publish: tracked files plus untracked files that are not ignored.
 * Using git's own view means `.gitignore` is respected exactly, before or after the first commit.
 * @returns {string[]} repository-relative paths
 */
export function listRepoFiles() {
  const output = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  return [...new Set(output.split('\0').filter(Boolean))];
}
