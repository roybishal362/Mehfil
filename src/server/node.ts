import { serve } from '@hono/node-server';
import { createApp } from './app';

const port = Number(process.env.PORT ?? '8787');

serve({ fetch: createApp().fetch, port }, (info) => {
  process.stdout.write(`Mehfil API listening on http://localhost:${String(info.port)}\n`);
});
