/**
 * Zod, as the rest of the code uses it: `import * as z from '…/shared/zod'`.
 *
 * Zod compiles fast object parsers with `new Function`, which the Content-Security-Policy
 * (script-src 'self', no 'unsafe-eval') forbids; even Zod's guarded probe for it is reported as
 * a violation. The setting is read as each schema is defined, so it must run before any schema
 * module. Importing Zod only through this file guarantees that whatever order the bundler loads
 * chunks in, because a module's imports always run before the module itself. A lint rule
 * (eslint.config.js) keeps every other file from importing 'zod' directly.
 */
import { config } from 'zod';

config({ jitless: true });

export * from 'zod';
