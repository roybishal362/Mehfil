/** Hono context typing shared by the app, middleware and routes. */
export interface AppEnv {
  Variables: {
    requestId: string;
    /** Firebase user ID when the request carried a valid ID token. */
    uid?: string;
  };
}
