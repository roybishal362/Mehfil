/**
 * The cloud features on Firebase: Authentication (anonymous and Google sign-in) and Cloud
 * Firestore through the lightweight `firestore/lite` SDK (plain HTTPS requests, no realtime
 * channel). Only ever loaded with a dynamic import, so the SDK is not part of the first
 * download. Who may read or write what is enforced by Firestore Security Rules
 * (firestore.rules); this code follows them.
 *
 * Firestore layout (plans and snapshots are stored as JSON text and validated when read):
 *   users/{uid}/plans/{planId}  { json, revision, updatedAt, v }
 *   shares/{shareId}            { owner, json, createdAt, expiresAt, v }
 */
import { FirebaseError, initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  connectAuthEmulator,
  deleteUser,
  getAuth,
  linkWithPopup,
  reauthenticateWithPopup,
  signInAnonymously,
  signInWithCredential,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  Timestamp,
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  deleteDoc,
} from 'firebase/firestore/lite';
import type { SharedPlan } from '../../shared/export/share';
import type { EventPlan } from '../../shared/schemas/plan';
import type { RuntimeConfig } from '../app/runtime-config';
import type { CloudBackend, CloudUser, RemotePlan, SaveResult } from './types';

type WebConfig = NonNullable<RuntimeConfig['firebase']>;

/** Version of the stored document layout. */
const DOC_VERSION = 1;

const toCloudUser = (user: User): CloudUser => ({
  uid: user.uid,
  anonymous: user.isAnonymous,
  name: user.displayName,
  email: user.email,
});

function googleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

const codeOf = (error: unknown) => (error instanceof FirebaseError ? error.code : undefined);

export interface BackendOptions {
  /** Firebase app name; tests use several apps side by side. */
  appName?: string;
  /** Local emulators instead of the real services (tests only). */
  emulators?: { auth: string; firestore: { host: string; port: number } };
}

export function firebaseBackend(config: WebConfig, options: BackendOptions = {}): CloudBackend {
  const app = initializeApp(
    {
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      ...(config.appId ? { appId: config.appId } : {}),
    },
    options.appName,
  );
  const auth = getAuth(app);
  const db = getFirestore(app);
  if (options.emulators) {
    connectAuthEmulator(auth, options.emulators.auth, { disableWarnings: true });
    connectFirestoreEmulator(
      db,
      options.emulators.firestore.host,
      options.emulators.firestore.port,
    );
  }
  // Resolves once a session saved by an earlier visit has been restored.
  const ready = auth.authStateReady();
  const planDoc = (uid: string, id: string) => doc(db, 'users', uid, 'plans', id);
  const shareDoc = (id: string) => doc(db, 'shares', id);

  return {
    async currentUser() {
      await ready;
      return auth.currentUser ? toCloudUser(auth.currentUser) : null;
    },

    async signInAnonymously() {
      await ready;
      if (auth.currentUser) return toCloudUser(auth.currentUser);
      return toCloudUser((await signInAnonymously(auth)).user);
    },

    async signInWithGoogle() {
      await ready;
      const current = auth.currentUser;
      if (!current?.isAnonymous)
        return toCloudUser((await signInWithPopup(auth, googleProvider())).user);
      try {
        // Upgrading keeps the uid, so share links made so far stay editable.
        return toCloudUser((await linkWithPopup(current, googleProvider())).user);
      } catch (error) {
        // That Google account already has its own account here: switch to it.
        const credential =
          codeOf(error) === 'auth/credential-already-in-use' && error instanceof FirebaseError
            ? GoogleAuthProvider.credentialFromError(error)
            : null;
        if (!credential) throw error;
        return toCloudUser((await signInWithCredential(auth, credential)).user);
      }
    },

    async signOut() {
      await signOut(auth);
    },

    async idToken() {
      await ready;
      return auth.currentUser ? auth.currentUser.getIdToken() : null;
    },

    async deleteAccount() {
      await ready;
      const user = auth.currentUser;
      if (!user) return;
      try {
        await deleteUser(user);
      } catch (error) {
        if (codeOf(error) !== 'auth/requires-recent-login' || user.isAnonymous) throw error;
        await reauthenticateWithPopup(user, googleProvider());
        await deleteUser(user);
      }
    },

    async listPlans(uid) {
      const snapshot = await getDocs(collection(db, 'users', uid, 'plans'));
      return snapshot.docs.map((entry): RemotePlan => {
        const data = entry.data();
        const revision = Number.isInteger(data.revision) ? Number(data.revision) : -1;
        return { id: entry.id, revision, json: typeof data.json === 'string' ? data.json : '' };
      });
    },

    savePlan(uid: string, plan: EventPlan, expected: number | null) {
      return runTransaction(db, async (transaction): Promise<SaveResult> => {
        const ref = planDoc(uid, plan.id);
        const stored = await transaction.get(ref);
        const revision = stored.exists() ? Number(stored.data().revision) : null;
        if (revision !== expected) return 'conflict';
        transaction.set(ref, {
          json: JSON.stringify(plan),
          revision: plan.revision,
          updatedAt: serverTimestamp(),
          v: DOC_VERSION,
        });
        return 'saved';
      });
    },

    deletePlan(uid: string, id: string, expected: number) {
      return runTransaction(db, async (transaction): Promise<SaveResult> => {
        const ref = planDoc(uid, id);
        const stored = await transaction.get(ref);
        if (stored.exists() && Number(stored.data().revision) !== expected) return 'conflict';
        transaction.delete(ref);
        return 'saved';
      });
    },

    async createShare(uid: string, id: string, snapshot: SharedPlan, expiresAt: Date) {
      await setDoc(shareDoc(id), {
        owner: uid,
        json: JSON.stringify(snapshot),
        createdAt: serverTimestamp(),
        expiresAt: Timestamp.fromDate(expiresAt),
        v: DOC_VERSION,
      });
    },

    async updateShare(id: string, snapshot: SharedPlan, expiresAt: Date) {
      await updateDoc(shareDoc(id), {
        json: JSON.stringify(snapshot),
        expiresAt: Timestamp.fromDate(expiresAt),
      });
    },

    async deleteShare(id: string) {
      await deleteDoc(shareDoc(id));
    },

    async listShareIds(uid: string) {
      const snapshot = await getDocs(query(collection(db, 'shares'), where('owner', '==', uid)));
      return snapshot.docs.map((entry) => entry.id);
    },

    async getShare(id: string) {
      try {
        const json: unknown = (await getDoc(shareDoc(id))).data()?.json;
        return typeof json === 'string' ? json : null;
      } catch (error) {
        // Unknown, expired and deleted links all look the same: the rules deny the read.
        if (codeOf(error) === 'permission-denied') return null;
        throw error;
      }
    },
  };
}
