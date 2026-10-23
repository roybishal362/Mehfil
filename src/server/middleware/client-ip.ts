/**
 * Client address for rate limiting. On Vercel the platform sets `x-real-ip` itself, so it can be
 * trusted; anywhere else forwarded headers can be forged, so the socket address is used.
 */
import { getConnInfo } from '@hono/node-server/conninfo';
import type { Context } from 'hono';

export function clientIp(c: Context, mode: 'vercel' | 'socket'): string {
  if (mode === 'vercel') {
    return (
      c.req.header('x-real-ip') ??
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      'unknown'
    );
  }
  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    // In-process requests (tests) have no socket.
    return 'local';
  }
}
