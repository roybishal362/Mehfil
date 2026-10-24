/** Stable keys for budget lines and vendor categories. Labels live in the UI dictionaries. */
import * as z from '../zod';

export const BUDGET_CATEGORIES = [
  'venue',
  'catering',
  'decor',
  'photography',
  'attire_beauty',
  'entertainment',
  'invitations_favors',
  'rituals',
  'transport',
  'accommodation',
  'food_cake',
  'return_gifts',
  'invitations',
  'gifts_favors',
  'venue_permits',
  'sound_lighting',
  'performers',
  'publicity',
  'safety_cleanup',
  'volunteers',
  'supplies',
  'contingency',
  'custom',
] as const;
export const BudgetCategory = z.enum(BUDGET_CATEGORIES);
export type BudgetCategory = z.infer<typeof BudgetCategory>;

export const VENDOR_CATEGORIES = [
  'venue',
  'caterer',
  'photographer',
  'decorator',
  'officiant',
  'makeup_artist',
  'mehendi_artist',
  'music_dj',
  'invitations_printer',
  'transport',
  'cake_baker',
  'entertainer',
  'pandal_tent',
  'sound_lighting',
  'performers',
  'security',
  'cleaning',
  'custom',
] as const;
export const VendorCategory = z.enum(VENDOR_CATEGORIES);
export type VendorCategory = z.infer<typeof VendorCategory>;
