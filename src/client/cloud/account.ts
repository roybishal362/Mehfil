/**
 * Account actions: Google sign-in (which turns on sync), sign-out, deleting cloud data, and the
 * startup wiring. Nothing here loads Firebase until it is needed: a sign-in, a share link, an AI
 * request on a server that requires an account, or a returning Google user.
 */
import { loadRuntimeConfig, useRuntimeConfig } from '../app/runtime-config';
import { setTokenProvider } from '../lib/api';
import { readText, removeKey, writeText } from '../lib/storage';
import type { PlansStore } from '../state/plans';
import { cloudBackend } from './backend';
import { forgetShareLinks } from './share-links';
import { IDLE_SYNC, setSync, useCloud } from './store';
import { baseKey, startSync, type ConflictChoice, type SyncEngine } from './sync';
import type { CloudBackend, CloudUser } from './types';

/** Set while this browser is signed in with Google, so the next visit resumes sync early. */
export const ACCOUNT_KEY = 'mehfil:account';

interface CloudContext {
  store: PlansStore;
  storage: Storage | null;
}

/** What startup wired in (the plans store and storage) and the signed-in account's sync. */
class CloudConnection {
  private context: CloudContext | null = null;
  private engine: SyncEngine | null = null;

  connect(context: CloudContext): void {
    this.context = context;
  }

  disconnect(): void {
    this.stopSync();
    this.context = null;
  }

  /** Syncs a Google account's plans. Anonymous sessions (for share links) never sync. */
  startSync(cloud: CloudBackend, user: CloudUser): void {
    this.engine?.stop();
    this.engine = null;
    if (!this.context || user.anonymous) return;
    this.engine = startSync({
      backend: cloud,
      store: this.context.store,
      uid: user.uid,
      storage: this.context.storage,
      onChange: setSync,
    });
    void this.engine.syncNow();
  }

  stopSync(): void {
    this.engine?.stop();
    this.engine = null;
    useCloud.setState({ sync: IDLE_SYNC });
  }

  syncNow(): Promise<void> {
    return this.engine?.syncNow() ?? Promise.resolve();
  }

  resolve(id: string, choice: ConflictChoice, copyTitle: string): Promise<void> {
    return this.engine?.resolve(id, choice, copyTitle) ?? Promise.resolve();
  }

  /** Waits until changes made here have been sent. */
  async settle(): Promise<void> {
    await this.engine?.settle();
  }

  /** Without storage, sync resumes the first time a cloud feature is used. */
  rememberGoogle(signedIn: boolean): void {
    if (signedIn) writeText(ACCOUNT_KEY, 'google', this.storage());
    else removeKey(ACCOUNT_KEY, this.storage());
  }

  signedInWithGoogleBefore(): boolean {
    return readText(ACCOUNT_KEY, this.storage()) === 'google';
  }

  /** Forgets which revisions this device last synced, for an account that no longer exists. */
  forgetSyncState(uid: string): void {
    removeKey(baseKey(uid), this.storage());
  }

  private storage(): Storage | null {
    return this.context?.storage ?? null;
  }
}

const connection = new CloudConnection();

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
    connection.rememberGoogle(true);
    useCloud.setState({ user });
    connection.startSync(cloud, user);
  });
}

/** Sends any unsynced changes, then signs out. Plans stay on this device. */
export function signOut(): Promise<void> {
  return withBusy('signout', async () => {
    await connection.settle();
    connection.stopSync();
    await (await cloudBackend()).signOut();
    connection.rememberGoogle(false);
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
    connection.stopSync();
    if (user) await deleteAccount(cloud, user.uid);
    forgetShareLinks();
    connection.rememberGoogle(false);
    useCloud.setState({ user: null });
  });
}

/** The account's synced plans, then its share links, then the account itself. */
async function deleteAccount(cloud: CloudBackend, uid: string): Promise<void> {
  for (const plan of await cloud.listPlans(uid))
    await cloud.deletePlan(uid, plan.id, plan.revision);
  for (const id of await cloud.listShareIds(uid)) await cloud.deleteShare(id);
  await cloud.deleteAccount();
  connection.forgetSyncState(uid);
}

export function syncNow(): Promise<void> {
  return connection.syncNow();
}

export function resolveConflict(id: string, choice: ConflictChoice, copyTitle: string) {
  return connection.resolve(id, choice, copyTitle);
}

async function resumeGoogleSession(): Promise<void> {
  try {
    const cloud = await cloudBackend();
    const user = await cloud.currentUser();
    if (!user || user.anonymous) {
      connection.rememberGoogle(false);
      return;
    }
    useCloud.setState({ user });
    connection.startSync(cloud, user);
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
export function connectCloud(context: CloudContext): void {
  connection.connect(context);
  setTokenProvider(apiToken);
  if (connection.signedInWithGoogleBefore()) whenIdle(() => void resumeGoogleSession());
}

/** Test helper: forget the wiring and any running sync. */
export function disconnectCloudForTests(): void {
  connection.disconnect();
  setTokenProvider(null);
}
