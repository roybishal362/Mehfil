/** Titles that several occasions share, so each is written and translated once. */
import type { LocalizedText } from './types';

export const SHARED_TITLES = {
  budget: {
    en: 'Set the budget and guest list',
    hi: 'बजट और मेहमानों की सूची तय करें',
    bn: 'বাজেট ও অতিথি তালিকা ঠিক করুন',
  },
  venue: {
    en: 'Book the venue',
    hi: 'वेन्यू बुक करें',
    bn: 'ভেন্যু বুক করুন',
  },
  invitations: {
    en: 'Send invitations',
    hi: 'निमंत्रण भेजें',
    bn: 'নিমন্ত্রণপত্র পাঠান',
  },
  thanks: {
    en: 'Thank guests and share photos',
    hi: 'मेहमानों को धन्यवाद दें और फ़ोटो साझा करें',
    bn: 'অতিথিদের ধন্যবাদ জানান ও ছবি শেয়ার করুন',
  },
  guestsArrive: {
    en: 'Guests arrive',
    hi: 'मेहमानों का आगमन',
    bn: 'অতিথিদের আগমন',
  },
} as const satisfies Record<string, LocalizedText>;
