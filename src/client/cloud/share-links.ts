/**
 * Which plans this device has shared, and the link for each. Kept apart from the sharing code
 * (shares.ts) so the account features can clear it without loading that code.
 */
import { create } from 'zustand';
import { readJson, writeText } from '../lib/storage';

export interface ShareLink {
  id: string;
  includeBudget: boolean;
  /** The plan revision the shared copy was made from. */
  revision: number;
  sharedAt: string;
  expiresAt: string;
}

export const SHARES_KEY = 'mehfil:shares';
/** The shape of a share link ID (128 random bits in base64url). */
const SHARE_ID = /^[A-Za-z0-9_-]{22}$/;

function isShareLink(value: unknown): value is ShareLink {
  if (typeof value !== 'object' || value === null) return false;
  const link = value as Record<string, unknown>;
  return (
    typeof link.id === 'string' &&
    SHARE_ID.test(link.id) &&
    typeof link.includeBudget === 'boolean' &&
    Number.isInteger(link.revision) &&
    typeof link.sharedAt === 'string' &&
    typeof link.expiresAt === 'string'
  );
}

/** The links saved on this device; anything malformed is dropped. */
function readLinks(): Record<string, ShareLink> {
  const stored = readJson(SHARES_KEY);
  if (typeof stored !== 'object' || stored === null) return {};
  return Object.fromEntries(Object.entries(stored).filter(([, link]) => isShareLink(link)));
}

export function writeLinks(links: Record<string, ShareLink>): void {
  useShareLinks.setState({ links });
  // Without storage the link still works; this device just forgets it was shared.
  writeText(SHARES_KEY, JSON.stringify(links));
}

/** Share links by plan ID. */
export const useShareLinks = create<{ links: Record<string, ShareLink> }>()(() => ({
  links: readLinks(),
}));

/** Forgets every share link on this device (after the cloud data was deleted). */
export function forgetShareLinks(): void {
  writeLinks({});
}
