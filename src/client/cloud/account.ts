/**
 * Account actions: Google sign-in (which turns on sync), sign-out, deleting cloud data, and the
 * startup wiring. Nothing here loads Firebase until it is needed: a sign-in, a share link, an AI
 * request on a server that requires an account, or a returning Google user.
 */
import { loadRuntimeConfig, useRuntimeConfig } from '../app/runtime-config';
import { setTokenProvider } from '../lib/api';
import type { PlansStore } from '../state/plans';
import { cloudBackend } from './backend';
import { forgetShareLinks } from './share-links';
import { IDLE_SYNC, setSync, useCloud } from './store';
import { baseKey, startSync, type ConflictChoice, type SyncEngine } from './sync';
import type { CloudBackend, CloudUser } from './types';

/** Set while this browser is signed in with Google, so the next visit resumes sync early. */
export const ACCOUNT_KEY = 'mehfil:account';

let engine: SyncEngine | null = null;
let context: { store: PlansStore; storage: Storage | null } | null = null;

function rememberGoogle(signedIn: boolean): void {
  try {
    if (signedIn) context?.storage?.setItem(ACCOUNT_KEY, 'google');
    else context?.storage?.removeItem(ACCOUNT_KEY);
  } catch {
    // Without storage, sync resumes the first time a cloud feature is used.
  }
}

function startEngine(cloud: CloudBackend, user: CloudUser): void {
  engine?.stop();
  engine = null;
  if (!context || user.anonymous) return;
  engine = startSync({
    backend: cloud,
    store: context.store,
    uid: user.uid,
    storage: context.storage,
    onChange: setSync,
  });
  void engine.syncNow();
}

function stopEngine(): void {
  engine?.stop();
  engine = null;
  useCloud.setState({ sync: IDLE_SYNC });
}

async function withBusy<T>(busy: 'signin' | 'signout' | 'delete', task: () => Promise<T>) {
  useCloud.setState({ busy });
  try {
    return await task();
  } finally {
    useCloud.setState({ busy: null });
  }
}

/** Signs in with Google in a popup and starts syncing this device's plans with the account. */
export function signInWithGoogle(): Promise<void> {
  return withBusy('signin', async () => {
    const cloud = await cloudBackend();
    const user = await cloud.signInWithGoogle();
    rememberGoogle(true);
    useCloud.setState({ user });
    startEngine(cloud, user);
  });
}

/** Sends any unsynced changes, then signs out. Plans stay on this device. */
export function signOut(): Promise<void> {
  return withBusy('signout', async () => {
    await engine?.settle();
    stopEngine();
    await (await cloudBackend()).signOut();
    rememberGoogle(false);
    useCloud.setState({ user: null });
  });
}

/**
 * Deletes everything this account keeps in the cloud (synced plans and share links) and then
 * the account itself. Plans on this device are kept.
 */
export function deleteCloudData(): Promise<void> {
  return withBusy('delete', async () => {
    const cloud = await cloudBackend();
    const user = await cloud.currentUser();
    stopEngine();
    if (user) {
      for (const plan of await cloud.listPlans(user.uid)) {
        await cloud.deletePlan(user.uid, plan.id, plan.revision);
      }
      for (const id of await cloud.listShareIds(user.uid)) await cloud.deleteShare(id);
      await cloud.deleteAccount();
      try {
        context?.storage?.removeItem(baseKey(user.uid));
      } catch {
        // Nothing else to clean up.
      }
    }
    forgetShareLinks();
    rememberGoogle(false);
    useCloud.setState({ user: null });
  });
}

export function syncNow(): Promise<void> {
  return engine?.syncNow() ?? Promise.resolve();
}

export function resolveConflict(id: string, choice: ConflictChoice, copyTitle: string) {
  return engine?.resolve(id, choice, copyTitle) ?? Promise.resolve();
}

async function resumeGoogleSession(): Promise<void> {
  try {
    const cloud = await cloudBackend();
    const user = await cloud.currentUser();
    if (!user || user.anonymous) {
      rememberGoogle(false);
      return;
    }
    useCloud.setState({ user });
    startEngine(cloud, user);
  } catch {
    // The cloud is unreachable or not configured: keep working locally.
  }
}

/** The ID token for API calls; signs in anonymously first when the server requires an account. */
async function apiToken(): Promise<string | null> {
  await loadRuntimeConfig();
  const config = useRuntimeConfig.getState().config;
  if (!config?.firebase) return null;
  try {
    const cloud = await cloudBackend();
    let user = await cloud.currentUser();
    if (!user && config.ai.requiresSignIn) user = await cloud.signInAnonymously();
    if (!user) return null;
    if (useCloud.getState().user?.uid !== user.uid) useCloud.setState({ user });
    return await cloud.idToken();
  } catch {
    // The server answers 401 with a clear message, and the AI features say so.
    return null;
  }
}

function whenIdle(task: () => void): void {
  if ('requestIdleCallback' in window) window.requestIdleCallback(task, { timeout: 4000 });
  else setTimeout(task, 1500);
}

/**
 * Connects the cloud features at startup: API calls carry an ID token when someone is signed
 * in, and a returning Google user's sync resumes once the page is idle.
 */
export function connectCloud(options: { store: PlansStore; storage: Storage | null }): void {
  context = options;
  setTokenProvider(apiToken);
  if (signedInWithGoogleBefore(options.storage)) whenIdle(() => void resumeGoogleSession());
}

function signedInWithGoogleBefore(storage: Storage | null): boolean {
  try {
    return storage?.getItem(ACCOUNT_KEY) === 'google';
  } catch {
    return false;
  }
}

/** Test helper: forget the wiring and any running sync. */
export function disconnectCloudForTests(): void {
  stopEngine();
  context = null;
  setTokenProvider(null);
}
