/**
 * An in-memory CloudBackend for tests: Auth and Firestore as plain maps that follow the same
 * rules as the real ones (revision checks, share expiry), with a switch for going offline.
 */
import type { SharedPlan } from '../../shared/export/share';
import type { EventPlan } from '../../shared/schemas/plan';
import type { CloudBackend, CloudUser, RemotePlan, SaveResult } from '../cloud/types';

interface StoredShare {
  owner: string;
  json: string;
  expiresAt: Date;
}

export class FakeCloud implements CloudBackend {
  user: CloudUser | null = null;
  /** Documents by uid, then plan ID. */
  readonly plans = new Map<string, Map<string, RemotePlan>>();
  readonly shares = new Map<string, StoredShare>();
  offline = false;
  deletedAccounts: string[] = [];
  now = () => new Date();
  /** The Google account the sign-in popup "chooses". */
  google: CloudUser = {
    uid: 'uid-google',
    anonymous: false,
    name: 'Asha',
    email: 'asha@example.com',
  };
  private anonymousCount = 0;

  private online(): void {
    if (this.offline) throw Object.assign(new Error('offline'), { code: 'unavailable' });
  }

  private docs(uid: string): Map<string, RemotePlan> {
    let docs = this.plans.get(uid);
    if (!docs) {
      docs = new Map();
      this.plans.set(uid, docs);
    }
    return docs;
  }

  /** Writes a plan as if another device had saved it. */
  putRemote(uid: string, plan: EventPlan): void {
    this.docs(uid).set(plan.id, {
      id: plan.id,
      revision: plan.revision,
      json: JSON.stringify(plan),
    });
  }

  remoteRevision(uid: string, id: string): number | undefined {
    return this.plans.get(uid)?.get(id)?.revision;
  }

  currentUser(): Promise<CloudUser | null> {
    return Promise.resolve(this.user);
  }

  signInAnonymously(): Promise<CloudUser> {
    this.online();
    this.anonymousCount += 1;
    this.user = {
      uid: `uid-anon-${String(this.anonymousCount)}`,
      anonymous: true,
      name: null,
      email: null,
    };
    return Promise.resolve(this.user);
  }

  signInWithGoogle(): Promise<CloudUser> {
    this.online();
    // Linking keeps an anonymous user's uid, as Firebase does.
    this.user = this.user?.anonymous ? { ...this.google, uid: this.user.uid } : this.google;
    return Promise.resolve(this.user);
  }

  signOut(): Promise<void> {
    this.user = null;
    return Promise.resolve();
  }

  idToken(): Promise<string | null> {
    return Promise.resolve(this.user ? `token-for-${this.user.uid}` : null);
  }

  deleteAccount(): Promise<void> {
    this.online();
    if (this.user) this.deletedAccounts.push(this.user.uid);
    this.user = null;
    return Promise.resolve();
  }

  listPlans(uid: string): Promise<RemotePlan[]> {
    this.online();
    return Promise.resolve([...this.docs(uid).values()]);
  }

  savePlan(uid: string, plan: EventPlan, expected: number | null): Promise<SaveResult> {
    this.online();
    const stored = this.docs(uid).get(plan.id)?.revision ?? null;
    if (stored !== expected) return Promise.resolve('conflict');
    this.putRemote(uid, plan);
    return Promise.resolve('saved');
  }

  deletePlan(uid: string, id: string, expected: number): Promise<SaveResult> {
    this.online();
    const stored = this.docs(uid).get(id);
    if (stored && stored.revision !== expected) return Promise.resolve('conflict');
    this.docs(uid).delete(id);
    return Promise.resolve('saved');
  }

  createShare(uid: string, id: string, snapshot: SharedPlan, expiresAt: Date): Promise<void> {
    this.online();
    if (this.shares.has(id)) throw new Error('share exists');
    this.shares.set(id, { owner: uid, json: JSON.stringify(snapshot), expiresAt });
    return Promise.resolve();
  }

  updateShare(id: string, snapshot: SharedPlan, expiresAt: Date): Promise<void> {
    this.online();
    const share = this.shares.get(id);
    if (!share || share.owner !== this.user?.uid) {
      throw Object.assign(new Error('denied'), { code: 'permission-denied' });
    }
    this.shares.set(id, { ...share, json: JSON.stringify(snapshot), expiresAt });
    return Promise.resolve();
  }

  deleteShare(id: string): Promise<void> {
    this.online();
    this.shares.delete(id);
    return Promise.resolve();
  }

  listShareIds(uid: string): Promise<string[]> {
    this.online();
    return Promise.resolve(
      [...this.shares].filter(([, share]) => share.owner === uid).map(([id]) => id),
    );
  }

  getShare(id: string): Promise<string | null> {
    this.online();
    const share = this.shares.get(id);
    return Promise.resolve(share && share.expiresAt > this.now() ? share.json : null);
  }
}
