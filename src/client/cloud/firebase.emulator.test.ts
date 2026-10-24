/**
 * The Firebase adapter against the Auth and Firestore emulators, under the real security rules
 * (firestore.rules). Run with `npm run test:rules`, which starts the emulators.
 */
import { describe, expect, it } from 'vitest';
import { toShareSnapshot } from '../../shared/export/share';
import { weddingPlan } from '../../shared/test/fixtures';
import { secureToken } from '../../shared/utils/ids';
import { firebaseBackend } from './firebase';
import type { CloudBackend } from './types';

const CONFIG = {
  projectId: 'demo-mehfil',
  apiKey: 'demo-api-key',
  authDomain: 'demo-mehfil.firebaseapp.com',
};
const EMULATORS = {
  auth: 'http://127.0.0.1:9099',
  firestore: { host: '127.0.0.1', port: 8080 },
};

let apps = 0;
/** A separate browser, as far as Firebase is concerned. */
function newDevice(): CloudBackend {
  apps += 1;
  return firebaseBackend(CONFIG, { appName: `device-${String(apps)}`, emulators: EMULATORS });
}

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000);

describe('Firebase adapter (emulators)', () => {
  it('signs in anonymously once and hands out ID tokens', async () => {
    const device = newDevice();
    expect(await device.currentUser()).toBeNull();
    expect(await device.idToken()).toBeNull();
    const user = await device.signInAnonymously();
    expect(user.anonymous).toBe(true);
    expect((await device.signInAnonymously()).uid).toBe(user.uid);
    expect(await device.idToken()).toEqual(expect.any(String));
  });

  it('saves plans only over the revision this device last saw', async () => {
    const device = newDevice();
    const { uid } = await device.signInAnonymously();
    const plan = { ...weddingPlan(), id: `evt_${secureToken(6)}` };
    expect(await device.savePlan(uid, plan, null)).toBe('saved');
    expect(await device.savePlan(uid, plan, null)).toBe('conflict');
    const next = { ...plan, revision: plan.revision + 1, summary: 'Changed' };
    expect(await device.savePlan(uid, next, plan.revision)).toBe('saved');

    const [stored] = await device.listPlans(uid);
    expect(stored?.revision).toBe(next.revision);
    expect(JSON.parse(stored?.json ?? '{}')).toMatchObject({ id: plan.id, summary: 'Changed' });

    expect(await device.deletePlan(uid, plan.id, plan.revision)).toBe('conflict');
    expect(await device.deletePlan(uid, plan.id, next.revision)).toBe('saved');
    expect(await device.listPlans(uid)).toEqual([]);
  });

  it("keeps each account's plans away from other accounts", async () => {
    const owner = newDevice();
    const { uid } = await owner.signInAnonymously();
    await owner.savePlan(uid, { ...weddingPlan(), id: 'evt_private' }, null);
    const stranger = newDevice();
    await stranger.signInAnonymously();
    await expect(stranger.listPlans(uid)).rejects.toMatchObject({ code: 'permission-denied' });
  });

  it('shares a copy that opens without signing in until it is turned off', async () => {
    const owner = newDevice();
    const { uid } = await owner.signInAnonymously();
    const id = secureToken();
    const snapshot = toShareSnapshot(weddingPlan(), {
      includeBudget: true,
      now: new Date().toISOString(),
    });
    await owner.createShare(uid, id, snapshot, inDays(90));
    const reader = newDevice();
    expect(JSON.parse((await reader.getShare(id)) ?? '{}')).toMatchObject({ version: 1 });

    await owner.updateShare(id, { ...snapshot, summary: 'Updated' }, inDays(90));
    expect(await reader.getShare(id)).toContain('Updated');
    expect(await owner.listShareIds(uid)).toEqual([id]);
    await expect(
      owner.createShare(uid, secureToken(), snapshot, inDays(400)),
    ).rejects.toMatchObject({ code: 'permission-denied' });

    await owner.deleteShare(id);
    expect(await reader.getShare(id)).toBeNull();
    expect(await reader.getShare('NoSuchShareLinkHere123')).toBeNull();
  });

  it('deletes the account', async () => {
    const device = newDevice();
    await device.signInAnonymously();
    await device.deleteAccount();
    expect(await device.currentUser()).toBeNull();
    await device.signOut();
  });
});
