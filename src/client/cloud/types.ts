/**
 * The cloud features (Google sign-in, plans synced across devices, share links) reach Firebase
 * through this interface. Firebase itself loads only when one of them is used (firebase.ts), and
 * the sync logic is tested against an in-memory implementation.
 */
import type { SharedPlan } from '../../shared/export/share';
import type { EventPlan } from '../../shared/schemas/plan';

export interface CloudUser {
  uid: string;
  /** Anonymous accounts back AI calls and share links; Google accounts also sync plans. */
  anonymous: boolean;
  name: string | null;
  email: string | null;
}

/** A plan as stored in Firestore. Its JSON is untrusted and validated when read. */
export interface RemotePlan {
  id: string;
  revision: number;
  json: string;
}

/** `conflict`: the stored plan changed since this device last synced it. */
export type SaveResult = 'saved' | 'conflict';

export interface CloudBackend {
  /** The signed-in user, once any saved session has been restored. */
  currentUser(): Promise<CloudUser | null>;
  signInAnonymously(): Promise<CloudUser>;
  /** Google sign-in in a popup. An anonymous user is upgraded in place and keeps its uid. */
  signInWithGoogle(): Promise<CloudUser>;
  signOut(): Promise<void>;
  /** A fresh Firebase ID token for the API, or null when nobody is signed in. */
  idToken(): Promise<string | null>;
  /** Deletes the signed-in account, asking Google to confirm the sign-in again if needed. */
  deleteAccount(): Promise<void>;

  listPlans(uid: string): Promise<RemotePlan[]>;
  /**
   * Saves the plan unless the stored copy's revision differs from `expected`, the revision this
   * device last synced (null when it has never been stored).
   */
  savePlan(uid: string, plan: EventPlan, expected: number | null): Promise<SaveResult>;
  /** Deletes the stored plan unless it changed since `expected` (then it is left alone). */
  deletePlan(uid: string, id: string, expected: number): Promise<SaveResult>;

  /** Creates a share link's snapshot under a new, unguessable ID. */
  createShare(uid: string, id: string, snapshot: SharedPlan, expiresAt: Date): Promise<void>;
  /** Replaces the snapshot of a share link this user created. */
  updateShare(id: string, snapshot: SharedPlan, expiresAt: Date): Promise<void>;
  deleteShare(id: string): Promise<void>;
  /** IDs of every share link the user created (to delete them with the account). */
  listShareIds(uid: string): Promise<string[]>;
  /** A shared snapshot's JSON, or null when the link is unknown, turned off or expired. */
  getShare(id: string): Promise<string | null>;
}

/** Firebase configuration missing on the server: the cloud features are hidden. */
export class CloudUnavailableError extends Error {
  constructor() {
    super('Cloud features are not configured on this server');
    this.name = 'CloudUnavailableError';
  }
}
