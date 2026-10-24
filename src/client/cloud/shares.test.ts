import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventPlan } from '../../shared/schemas/plan';
import { weddingPlan } from '../../shared/test/fixtures';
import { FakeCloud } from '../test/fake-cloud';
import { mockApi } from '../test/helpers';
import { setCloudBackendForTests } from './backend';
import {
  SHARES_KEY,
  createShareLink,
  loadSharedPlan,
  refreshShareLink,
  shareUrl,
  stopSharing,
  useShareLinks,
} from './shares';

const NOW = new Date('2026-10-24T10:00:00Z');
let cloud: FakeCloud;
let plan: EventPlan;

beforeEach(() => {
  cloud = new FakeCloud();
  cloud.now = () => NOW;
  setCloudBackendForTests(cloud);
  useShareLinks.setState({ links: {} });
  plan = {
    ...weddingPlan(),
    guests: [
      {
        id: 'guest_1',
        name: 'Meera Sen',
        partySize: 2,
        rsvp: 'yes',
        contact: '+91 98300 12345',
        notes: 'Cousin from Delhi',
      },
    ],
  };
});

afterEach(() => {
  setCloudBackendForTests(null);
});

describe('share links', () => {
  it('shares a read-only copy without personal details, for 90 days', async () => {
    const link = await createShareLink(plan, false, NOW);
    expect(link.id).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(link.expiresAt).toBe('2027-01-22T10:00:00.000Z');
    const stored = cloud.shares.get(link.id);
    expect(stored?.owner).toBe('uid-anon-1');
    expect(stored?.json).not.toMatch(/Meera|98300|Cousin/);
    expect(JSON.parse(stored?.json ?? '{}')).not.toHaveProperty('budget');
    expect(useShareLinks.getState().links[plan.id]).toEqual(link);
    expect(JSON.parse(localStorage.getItem(SHARES_KEY) ?? '{}')).toEqual({ [plan.id]: link });
    expect(shareUrl(link.id)).toBe(`${window.location.origin}/s/${link.id}`);
  });

  it('opens a shared plan from its link', async () => {
    const link = await createShareLink(plan, true, NOW);
    const result = await loadSharedPlan(link.id);
    expect(result.kind).toBe('plan');
    if (result.kind === 'plan') {
      expect(result.plan.title).toBe(plan.brief.title);
      expect(result.plan.budget?.total).toBe(plan.budget.total);
      expect(result.plan.guests.confirmed).toBe(2);
    }
  });

  it('refreshes the shared copy under the same link, and creates one if needed', async () => {
    const link = await createShareLink(plan, false, NOW);
    const later = new Date('2026-11-01T10:00:00Z');
    const edited = { ...plan, revision: plan.revision + 3, summary: 'Mehendi moved to Friday' };
    const refreshed = await refreshShareLink(edited, true, later);
    expect(refreshed).toMatchObject({
      id: link.id,
      revision: edited.revision,
      includeBudget: true,
    });
    expect(cloud.shares.get(link.id)?.json).toContain('Mehendi moved to Friday');
    const other = { ...plan, id: 'evt_other' };
    expect((await refreshShareLink(other, false, later)).id).not.toBe(link.id);
  });

  it('turns a link off for everyone', async () => {
    const link = await createShareLink(plan, false, NOW);
    await stopSharing(plan.id);
    expect(cloud.shares.has(link.id)).toBe(false);
    expect(useShareLinks.getState().links).toEqual({});
    expect(await loadSharedPlan(link.id)).toEqual({ kind: 'not_found' });
    await stopSharing('evt_never_shared');
  });

  it('treats unknown, expired, malformed and damaged links as not found', async () => {
    expect(await loadSharedPlan('not-a-share-id')).toEqual({ kind: 'not_found' });
    const link = await createShareLink(plan, false, NOW);
    cloud.now = () => new Date('2027-02-01T00:00:00Z');
    expect(await loadSharedPlan(link.id)).toEqual({ kind: 'not_found' });
    cloud.now = () => NOW;
    const stored = cloud.shares.get(link.id);
    if (stored) cloud.shares.set(link.id, { ...stored, json: '{"version":1,"title":"<script>"}' });
    expect(await loadSharedPlan(link.id)).toEqual({ kind: 'not_found' });
    if (stored) cloud.shares.set(link.id, { ...stored, json: '{broken' });
    expect(await loadSharedPlan(link.id)).toEqual({ kind: 'not_found' });
  });

  it('says so when this server has no cloud features, and passes other errors on', async () => {
    mockApi({});
    setCloudBackendForTests(null);
    expect(await loadSharedPlan('AAAAAAAAAAAAAAAAAAAAAA')).toEqual({ kind: 'unavailable' });
    cloud.offline = true;
    setCloudBackendForTests(cloud);
    await expect(loadSharedPlan('AAAAAAAAAAAAAAAAAAAAAA')).rejects.toThrow('offline');
  });

  it('ignores damaged share records saved on this device', async () => {
    localStorage.setItem(
      SHARES_KEY,
      JSON.stringify({ evt_a: { id: 'short' }, evt_b: 'nonsense', evt_c: null }),
    );
    vi.resetModules();
    const fresh = await import('./shares');
    expect(fresh.useShareLinks.getState().links).toEqual({});
  });
});
