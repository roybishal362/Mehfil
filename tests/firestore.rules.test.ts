/**
 * Firestore Security Rules (firestore.rules) against the Firestore emulator:
 * `npm run test:rules` starts the emulator and runs these.
 */
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-mehfil',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});

afterAll(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
});

const as = (uid: string): Firestore => modular(env.authenticatedContext(uid).firestore());
const anyone = (): Firestore => modular(env.unauthenticatedContext().firestore());
/**
 * The test contexts hand out Firebase's compat Firestore; the modular functions accept it at
 * runtime (they unwrap it), but its type differs.
 */
const modular = (db: unknown) => db as Firestore;
const inDays = (days: number) => Timestamp.fromMillis(Date.now() + days * 86_400_000);
const SHARE_ID = 'AbCdEfGhIjKlMnOpQrSt_-';

const planFields = (overrides: Record<string, unknown> = {}) => ({
  json: '{"id":"evt_1"}',
  revision: 1,
  updatedAt: serverTimestamp(),
  v: 1,
  ...overrides,
});

const shareFields = (owner: string, overrides: Record<string, unknown> = {}) => ({
  owner,
  json: '{"version":1}',
  createdAt: serverTimestamp(),
  expiresAt: inDays(90),
  v: 1,
  ...overrides,
});

/** Writes data as it already stands, bypassing the rules. */
async function seed(path: string, data: Record<string, unknown>) {
  await env.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(modular(context.firestore()), path), data);
  });
}

describe('synced plans', () => {
  it('belong to their owner, who can write, read, list and delete them', async () => {
    const db = as('alice');
    const ref = doc(db, 'users/alice/plans/evt_1');
    await assertSucceeds(setDoc(ref, planFields()));
    await assertSucceeds(getDoc(ref));
    await assertSucceeds(getDocs(collection(db, 'users/alice/plans')));
    await assertSucceeds(setDoc(ref, planFields({ revision: 2 })));
    await assertSucceeds(deleteDoc(ref));
  });

  it('are closed to everyone else, signed in or not', async () => {
    await seed('users/alice/plans/evt_1', {
      json: '{}',
      revision: 1,
      updatedAt: Timestamp.now(),
      v: 1,
    });
    const path = 'users/alice/plans/evt_1';
    await assertFails(getDoc(doc(as('bob'), path)));
    await assertFails(getDocs(collection(as('bob'), 'users/alice/plans')));
    await assertFails(setDoc(doc(as('bob'), 'users/alice/plans/evt_2'), planFields()));
    await assertFails(deleteDoc(doc(as('bob'), path)));
    await assertFails(getDoc(doc(anyone(), path)));
    await assertFails(setDoc(doc(anyone(), 'users/anyone/plans/evt_1'), planFields()));
  });

  it('must have exactly the expected fields, types and sizes', async () => {
    const ref = doc(as('alice'), 'users/alice/plans/evt_1');
    await assertFails(setDoc(ref, planFields({ extra: true })));
    await assertFails(setDoc(ref, { json: '{}', revision: 1, v: 1 }));
    await assertFails(setDoc(ref, planFields({ json: 42 })));
    await assertFails(setDoc(ref, planFields({ json: '' })));
    await assertFails(setDoc(ref, planFields({ json: 'x'.repeat(700_001) })));
    await assertFails(setDoc(ref, planFields({ revision: -1 })));
    await assertFails(setDoc(ref, planFields({ revision: 1.5 })));
    await assertFails(setDoc(ref, planFields({ updatedAt: Timestamp.fromMillis(0) })));
    await assertFails(setDoc(ref, planFields({ v: 2 })));
    await assertFails(setDoc(doc(as('alice'), 'users/alice/plans/evt bad'), planFields()));
  });
});

describe('share links', () => {
  it('can be read by anyone holding the link until they expire', async () => {
    await seed(`shares/${SHARE_ID}`, { ...shareFields('alice'), createdAt: Timestamp.now() });
    await assertSucceeds(getDoc(doc(anyone(), `shares/${SHARE_ID}`)));
    await assertSucceeds(getDoc(doc(as('bob'), `shares/${SHARE_ID}`)));

    await seed(`shares/${SHARE_ID}`, {
      ...shareFields('alice'),
      createdAt: Timestamp.now(),
      expiresAt: inDays(-1),
    });
    await assertFails(getDoc(doc(anyone(), `shares/${SHARE_ID}`)));
    await assertFails(getDoc(doc(anyone(), 'shares/NoSuchShareLinkHere123')));
  });

  it('cannot be listed, except an owner listing their own', async () => {
    await seed(`shares/${SHARE_ID}`, { ...shareFields('alice'), createdAt: Timestamp.now() });
    await assertFails(getDocs(collection(anyone(), 'shares')));
    await assertFails(getDocs(collection(as('bob'), 'shares')));
    const alice = as('alice');
    await assertSucceeds(
      getDocs(query(collection(alice, 'shares'), where('owner', '==', 'alice'))),
    );
    await assertFails(getDocs(query(collection(alice, 'shares'), where('owner', '==', 'bob'))));
  });

  it('are created only by a signed-in owner, with a valid ID, shape and expiry', async () => {
    const alice = as('alice');
    const ref = doc(alice, `shares/${SHARE_ID}`);
    await assertFails(setDoc(doc(anyone(), `shares/${SHARE_ID}`), shareFields('alice')));
    await assertFails(setDoc(ref, shareFields('bob')));
    await assertFails(setDoc(doc(alice, 'shares/too-short'), shareFields('alice')));
    await assertFails(setDoc(ref, shareFields('alice', { expiresAt: inDays(120) })));
    await assertFails(setDoc(ref, shareFields('alice', { expiresAt: inDays(-1) })));
    await assertFails(setDoc(ref, shareFields('alice', { createdAt: Timestamp.fromMillis(0) })));
    await assertFails(setDoc(ref, shareFields('alice', { json: 'x'.repeat(200_001) })));
    await assertFails(setDoc(ref, shareFields('alice', { guests: ['Meera'] })));
    await assertSucceeds(setDoc(ref, shareFields('alice')));
  });

  it('are changed or deleted only by their owner, and keep their creation time', async () => {
    const ref = (db: Firestore) => doc(db, `shares/${SHARE_ID}`);
    await assertSucceeds(setDoc(ref(as('alice')), shareFields('alice')));
    await assertFails(updateDoc(ref(as('bob')), { json: '{"version":1,"x":1}' }));
    await assertFails(deleteDoc(ref(as('bob'))));
    await assertFails(deleteDoc(ref(anyone())));
    await assertSucceeds(
      updateDoc(ref(as('alice')), { json: '{"version":1,"title":"New"}', expiresAt: inDays(90) }),
    );
    await assertFails(updateDoc(ref(as('alice')), { createdAt: Timestamp.fromMillis(0) }));
    await assertFails(updateDoc(ref(as('alice')), { owner: 'bob' }));
    await assertSucceeds(deleteDoc(ref(as('alice'))));
  });
});

describe('everything else', () => {
  it('is denied', async () => {
    const alice = as('alice');
    await assertFails(getDoc(doc(alice, 'users/alice')));
    await assertFails(setDoc(doc(alice, 'users/alice'), { name: 'Alice' }));
    await assertFails(setDoc(doc(alice, 'anything/else'), { a: 1 }));
    await assertFails(getDocs(collection(alice, 'users')));
  });
});
