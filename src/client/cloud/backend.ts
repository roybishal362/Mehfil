/**
 * Loads the cloud backend on first use. Firebase is a separate download that only happens when
 * a cloud feature is used, and never when the server has no Firebase configuration.
 */
import { loadRuntimeConfig, useRuntimeConfig } from '../app/runtime-config';
import { useCloud } from './store';
import { CloudUnavailableError, type CloudBackend, type CloudUser } from './types';

async function loadFirebase(): Promise<CloudBackend> {
  await loadRuntimeConfig();
  const config = useRuntimeConfig.getState().config?.firebase;
  if (!config) throw new CloudUnavailableError();
  const { firebaseBackend } = await import('./firebase');
  return firebaseBackend(config);
}

let pending: Promise<CloudBackend> | null = null;

/** The cloud backend, loading Firebase the first time it is needed. */
export function cloudBackend(): Promise<CloudBackend> {
  pending ??= loadFirebase().catch((error: unknown) => {
    pending = null; // try again next time (for example after a failed chunk download)
    throw error;
  });
  return pending;
}

/** Tests use an in-memory backend instead of Firebase. */
export function setCloudBackendForTests(backend: CloudBackend | null): void {
  pending = backend ? Promise.resolve(backend) : null;
}

/** The signed-in user, signing in anonymously when nobody is (share links need an owner). */
export async function ensureUser(): Promise<{ cloud: CloudBackend; user: CloudUser }> {
  const cloud = await cloudBackend();
  const user = (await cloud.currentUser()) ?? (await cloud.signInAnonymously());
  useCloud.setState({ user });
  return { cloud, user };
}

/** True when this server offers the cloud features (Firebase is configured). */
export function useCloudAvailable(): boolean {
  return useRuntimeConfig((state) => Boolean(state.config?.firebase));
}
