import * as z from '../../shared/zod';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventPlan } from '../../shared/schemas/plan';
import { weddingPlan } from '../../shared/test/fixtures';
import { useRuntimeConfig, type RuntimeConfig } from '../app/runtime-config';
import { getJson, postJson } from '../lib/api';
import { createPlansStore, type PlansStore } from '../state/plans';
import { FakeCloud } from '../test/fake-cloud';
import { jsonResponse, mockApi } from '../test/helpers';
import {
  ACCOUNT_KEY,
  connectCloud,
  deleteCloudData,
  disconnectCloudForTests,
  resolveConflict,
  signInWithGoogle,
  signOut,
  syncNow,
} from './account';
import { setCloudBackendForTests } from './backend';
import { createShareLink, useShareLinks } from './shares';
import { useCloud } from './store';
import { baseKey } from './sync';

const CONFIG: RuntimeConfig = {
  ai: { mode: 'gemini', requiresSignIn: true },
  firebase: {
    projectId: 'demo-mehfil',
    apiKey: 'public-web-key',
    authDomain: 'demo-mehfil.firebaseapp.com',
  },
  features: { cloudSync: true },
};
const GOOGLE_UID = 'uid-google';

let cloud: FakeCloud;
let store: PlansStore;
let plan: EventPlan;

beforeEach(() => {
  cloud = new FakeCloud();
  setCloudBackendForTests(cloud);
  store = createPlansStore();
  plan = weddingPlan();
  store.getState().addPlan(plan);
  useCloud.setState({ user: null, busy: null });
  useShareLinks.setState({ links: {} });
  mockApi({ '/api/config': () => jsonResponse(CONFIG) });
  useRuntimeConfig.setState({ config: CONFIG });
});

afterEach(() => {
  disconnectCloudForTests();
  setCloudBackendForTests(null);
});

describe('account', () => {
  it('signs in with Google, uploads the plans on this device and remembers the account', async () => {
    connectCloud({ store, storage: localStorage });
    const signingIn = signInWithGoogle();
    expect(useCloud.getState().busy).toBe('signin');
    await signingIn;
    await syncNow();
    expect(useCloud.getState()).toMatchObject({
      busy: null,
      user: { email: 'asha@example.com', anonymous: false },
      sync: { status: 'idle' },
    });
    expect(cloud.remoteRevision(GOOGLE_UID, plan.id)).toBe(plan.revision);
    expect(localStorage.getItem(ACCOUNT_KEY)).toBe('google');
  });

  it('sends unsynced edits before signing out and keeps the plans on this device', async () => {
    connectCloud({ store, storage: localStorage });
    await signInWithGoogle();
    await syncNow();
    store.getState().transform(plan.id, (current) => ({ ...current, summary: 'Last edit' }));
    await signOut();
    expect(cloud.remoteRevision(GOOGLE_UID, plan.id)).toBe(plan.revision + 1);
    expect(useCloud.getState().user).toBeNull();
    expect(localStorage.getItem(ACCOUNT_KEY)).toBeNull();
    expect(store.getState().plans[plan.id]?.summary).toBe('Last edit');
  });

  it('deletes synced plans, share links and the account, but not the plans on this device', async () => {
    connectCloud({ store, storage: localStorage });
    await signInWithGoogle();
    await syncNow();
    await createShareLink(plan, true);
    expect(cloud.shares.size).toBe(1);

    await deleteCloudData();
    expect(cloud.plans.get(GOOGLE_UID)?.size).toBe(0);
    expect(cloud.shares.size).toBe(0);
    expect(cloud.deletedAccounts).toEqual([GOOGLE_UID]);
    expect(useShareLinks.getState().links).toEqual({});
    expect(localStorage.getItem(baseKey(GOOGLE_UID))).toBeNull();
    expect(store.getState().plans[plan.id]).toBeDefined();
    await syncNow();
    await resolveConflict(plan.id, 'local', 'unused');
  });

  it('signs in anonymously for AI calls when the server requires an account', async () => {
    const { calls } = mockApi({
      '/api/config': () => jsonResponse(CONFIG),
      '/api/ai/echo': () => jsonResponse({ ok: true }),
    });
    connectCloud({ store, storage: localStorage });
    await postJson('/api/ai/echo', {}, z.object({ ok: z.boolean() }));
    expect(calls.at(-1)?.headers.get('Authorization')).toBe('Bearer token-for-uid-anon-1');
    expect(useCloud.getState().user?.anonymous).toBe(true);
    // Public GET endpoints never carry the token.
    await getJson('/api/config', z.unknown());
    expect(calls.at(-1)?.headers.get('Authorization')).toBeNull();
  });

  it('sends no token when the server has no cloud features or the sign-in fails', async () => {
    const { calls } = mockApi({ '/api/ai/echo': () => jsonResponse({ ok: true }) });
    connectCloud({ store, storage: localStorage });
    vi.spyOn(cloud, 'signInAnonymously').mockRejectedValueOnce(new Error('disabled'));
    await postJson('/api/ai/echo', {}, z.object({ ok: z.boolean() }));
    useRuntimeConfig.setState({ config: { ...CONFIG, firebase: null } });
    await postJson('/api/ai/echo', {}, z.object({ ok: z.boolean() }));
    const ai = calls.filter((call) => call.path === '/api/ai/echo');
    expect(ai.map((call) => call.headers.get('Authorization'))).toEqual([null, null]);
  });

  it('resumes syncing for a returning Google user once the page is idle', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    localStorage.setItem(ACCOUNT_KEY, 'google');
    cloud.user = cloud.google;
    const fromPhone = { ...weddingPlan(), id: 'evt_phone', revision: 3 };
    cloud.putRemote(GOOGLE_UID, fromPhone);
    connectCloud({ store, storage: localStorage });
    await vi.advanceTimersByTimeAsync(2000);
    await syncNow();
    expect(store.getState().plans.evt_phone?.revision).toBe(3);
    expect(useCloud.getState().user?.uid).toBe(GOOGLE_UID);
  });

  it('forgets a remembered account whose session has ended', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    localStorage.setItem(ACCOUNT_KEY, 'google');
    connectCloud({ store, storage: localStorage });
    await vi.advanceTimersByTimeAsync(2000);
    expect(localStorage.getItem(ACCOUNT_KEY)).toBeNull();
    expect(useCloud.getState().user).toBeNull();
  });
});
