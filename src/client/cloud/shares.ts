/**
 * Share links: a read-only copy of a plan without personal details (see shared/export/share.ts)
 * that anyone with the link can open for 90 days without signing in. The link's ID is 128
 * random bits, so it cannot be guessed; the owner can refresh the copy or turn the link off.
 * Which plans are shared is remembered on this device (share-links.ts).
 */
export { SHARES_KEY, useShareLinks, type ShareLink } from './share-links';
import { SHARE_TTL_DAYS, SharedPlan, ShareId, toShareSnapshot } from '../../shared/export/share';
import type { EventPlan } from '../../shared/schemas/plan';
import { omitKey } from '../../shared/utils/collections';
import { secureToken } from '../../shared/utils/ids';
import { cloudBackend, ensureUser } from './backend';
import { useShareLinks, writeLinks, type ShareLink } from './share-links';
import { CloudUnavailableError } from './types';

export function shareUrl(id: string): string {
  return `${window.location.origin}/s/${id}`;
}

const snapshotOf = (plan: EventPlan, includeBudget: boolean, now: Date): SharedPlan =>
  // Parsing again guarantees nothing outside the shared shape can slip into the copy.
  SharedPlan.parse(toShareSnapshot(plan, { includeBudget, now: now.toISOString() }));

const expiryFrom = (now: Date) => new Date(now.getTime() + SHARE_TTL_DAYS * 86_400_000);

export async function createShareLink(
  plan: EventPlan,
  includeBudget: boolean,
  now = new Date(),
): Promise<ShareLink> {
  const { cloud, user } = await ensureUser();
  const id = secureToken();
  const expiresAt = expiryFrom(now);
  await cloud.createShare(user.uid, id, snapshotOf(plan, includeBudget, now), expiresAt);
  const link: ShareLink = {
    id,
    includeBudget,
    revision: plan.revision,
    sharedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
  writeLinks({ ...useShareLinks.getState().links, [plan.id]: link });
  return link;
}

/** Replaces the shared copy with the plan as it is now, and restarts the 90 days. */
export async function refreshShareLink(
  plan: EventPlan,
  includeBudget: boolean,
  now = new Date(),
): Promise<ShareLink> {
  const current = useShareLinks.getState().links[plan.id];
  if (!current) return createShareLink(plan, includeBudget, now);
  const { cloud } = await ensureUser();
  const expiresAt = expiryFrom(now);
  await cloud.updateShare(current.id, snapshotOf(plan, includeBudget, now), expiresAt);
  const link: ShareLink = {
    ...current,
    includeBudget,
    revision: plan.revision,
    sharedAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
  writeLinks({ ...useShareLinks.getState().links, [plan.id]: link });
  return link;
}

export async function stopSharing(planId: string): Promise<void> {
  const current = useShareLinks.getState().links[planId];
  if (!current) return;
  const cloud = await cloudBackend();
  await cloud.deleteShare(current.id);
  writeLinks(omitKey(useShareLinks.getState().links, planId));
}

export type SharedPlanResult =
  { kind: 'plan'; plan: SharedPlan } | { kind: 'not_found' } | { kind: 'unavailable' };

/** Opens a share link. Anything that is not a valid snapshot counts as not found. */
export async function loadSharedPlan(id: string): Promise<SharedPlanResult> {
  if (!ShareId.safeParse(id).success) return { kind: 'not_found' };
  let json: string | null;
  try {
    json = await (await cloudBackend()).getShare(id);
  } catch (error) {
    if (error instanceof CloudUnavailableError) return { kind: 'unavailable' };
    throw error;
  }
  if (json === null) return { kind: 'not_found' };
  try {
    const parsed = SharedPlan.safeParse(JSON.parse(json));
    return parsed.success ? { kind: 'plan', plan: parsed.data } : { kind: 'not_found' };
  } catch {
    return { kind: 'not_found' };
  }
}
