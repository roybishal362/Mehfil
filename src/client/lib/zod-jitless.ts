/**
 * Zod compiles fast object parsers with `new Function`, which the Content-Security-Policy
 * (script-src 'self', no 'unsafe-eval') forbids; even Zod's guarded probe for it is reported as
 * a violation. The setting is read as each schema is defined, so main.tsx imports this first.
 */
import * as z from 'zod';

z.config({ jitless: true });
