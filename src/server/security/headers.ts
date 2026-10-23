/**
 * The single security-header policy. The Hono app applies it to every response, and the Vercel
 * build writes the same headers into the deployment's routing config, so local, Docker and
 * Vercel deployments behave identically.
 */

/** Google origins that Firebase Authentication (Google sign-in) and Firestore need. */
export const FIREBASE_ORIGINS = {
  scripts: ['https://apis.google.com'],
  connect: [
    'https://identitytoolkit.googleapis.com',
    'https://securetoken.googleapis.com',
    'https://firestore.googleapis.com',
  ],
  frames: ['https://*.firebaseapp.com', 'https://accounts.google.com'],
} as const;

export interface PolicyOptions {
  /** Development relaxes HSTS and allows the Vite dev server's websocket. */
  production: boolean;
}

export function contentSecurityPolicy({ production }: PolicyOptions): string {
  const directives: [string, ...string[]][] = [
    ['default-src', "'self'"],
    ['script-src', "'self'", ...FIREBASE_ORIGINS.scripts],
    ['style-src', "'self'"],
    ['img-src', "'self'", 'data:', 'blob:'],
    ['font-src', "'self'"],
    [
      'connect-src',
      "'self'",
      ...FIREBASE_ORIGINS.connect,
      ...(production ? [] : ['ws://localhost:*']),
    ],
    ['frame-src', ...FIREBASE_ORIGINS.frames],
    ['worker-src', "'self'", 'blob:'],
    ['manifest-src', "'self'"],
    ['object-src', "'none'"],
    ['base-uri', "'self'"],
    ['form-action', "'self'"],
    ['frame-ancestors', "'none'"],
  ];
  if (production) directives.push(['upgrade-insecure-requests']);
  return directives.map((parts) => parts.join(' ')).join('; ');
}

/** Headers for every response (HTML, assets and API). */
export function securityHeaders(options: PolicyOptions): Record<string, string> {
  return {
    'Content-Security-Policy': contentSecurityPolicy(options),
    ...(options.production
      ? { 'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload' }
      : {}),
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy':
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
    // Google sign-in opens a popup that must message back to this window.
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'Origin-Agent-Cluster': '?1',
  };
}

/** Caching rules shared by the Node server and the Vercel routing config. */
export const CACHE_RULES = {
  /** Hashed build assets never change. */
  immutable: 'public, max-age=31536000, immutable',
  /** The HTML shell must always be revalidated so new deployments show up. */
  document: 'no-cache',
  /** API responses are personal or time-sensitive. */
  api: 'no-store',
} as const;
