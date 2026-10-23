import type { EventTemplate } from './types';

/** Anniversaries, baby showers, housewarmings and other celebrations. Weights sum to 100. */
export const otherTemplate: EventTemplate = {
  type: 'other',
  budget: [
    { category: 'venue', weight: 25, min: 0, max: 40 },
    { category: 'catering', weight: 35, min: 20, max: 55, perGuest: true },
    { category: 'decor', weight: 12, min: 3, max: 25 },
    { category: 'entertainment', weight: 8, min: 0, max: 20 },
    { category: 'photography', weight: 6, min: 0, max: 12 },
    { category: 'gifts_favors', weight: 6, min: 0, max: 12, perGuest: true },
    { category: 'invitations', weight: 3, min: 0, max: 6 },
    { category: 'contingency', weight: 5, min: 2, max: 10 },
  ],
  tasks: [
    {
      key: 'budget',
      title: {
        en: 'Set the budget and guest list',
        hi: 'बजट और मेहमानों की सूची तय करें',
        bn: 'বাজেট ও অতিথি তালিকা ঠিক করুন',
      },
      daysBefore: 60,
      priority: 'high',
      category: 'planning',
    },
    {
      key: 'venue',
      title: { en: 'Book the venue', hi: 'वेन्यू बुक करें', bn: 'ভেন্যু বুক করুন' },
      daysBefore: 45,
      priority: 'high',
      category: 'venue',
    },
    {
      key: 'food',
      title: {
        en: 'Arrange food and drinks',
        hi: 'खाने-पीने की व्यवस्था करें',
        bn: 'খাবার ও পানীয়ের ব্যবস্থা করুন',
      },
      daysBefore: 30,
      priority: 'high',
      category: 'vendors',
    },
    {
      key: 'invitations',
      title: { en: 'Send invitations', hi: 'निमंत्रण भेजें', bn: 'নিমন্ত্রণপত্র পাঠান' },
      daysBefore: 25,
      priority: 'high',
      category: 'guests',
    },
    {
      key: 'decor',
      title: {
        en: 'Plan the decor',
        hi: 'सजावट की योजना बनाएँ',
        bn: 'সাজসজ্জার পরিকল্পনা করুন',
      },
      daysBefore: 20,
      priority: 'medium',
      category: 'vendors',
    },
    {
      key: 'photographer',
      title: { en: 'Book a photographer', hi: 'फ़ोटोग्राफ़र बुक करें', bn: 'ফটোগ্রাফার বুক করুন' },
      daysBefore: 20,
      priority: 'medium',
      category: 'vendors',
    },
    {
      key: 'rsvp',
      title: {
        en: 'Confirm RSVPs and the final headcount',
        hi: 'RSVP और अंतिम संख्या पक्की करें',
        bn: 'RSVP ও চূড়ান্ত অতিথি সংখ্যা নিশ্চিত করুন',
      },
      daysBefore: 5,
      priority: 'high',
      category: 'guests',
    },
    {
      key: 'run-sheet',
      title: {
        en: 'Plan the event-day schedule',
        hi: 'कार्यक्रम के दिन का शेड्यूल बनाएँ',
        bn: 'অনুষ্ঠানের দিনের সময়সূচি তৈরি করুন',
      },
      daysBefore: 3,
      priority: 'medium',
      category: 'day_of',
    },
    {
      key: 'thanks',
      title: {
        en: 'Thank guests and share photos',
        hi: 'मेहमानों को धन्यवाद दें और फ़ोटो साझा करें',
        bn: 'অতিথিদের ধন্যবাদ জানান ও ছবি শেয়ার করুন',
      },
      daysBefore: -3,
      priority: 'low',
      category: 'after',
    },
  ],
  vendors: [
    { category: 'venue', priority: 'high', leadDays: 45, budgetCategory: 'venue' },
    { category: 'caterer', priority: 'high', leadDays: 30, budgetCategory: 'catering' },
    { category: 'decorator', priority: 'medium', leadDays: 20, budgetCategory: 'decor' },
    { category: 'photographer', priority: 'low', leadDays: 20, budgetCategory: 'photography' },
    { category: 'entertainer', priority: 'low', leadDays: 20, budgetCategory: 'entertainment' },
  ],
  schedule: [
    {
      dayOffset: 0,
      time: '17:00',
      durationMinutes: 60,
      title: { en: 'Set-up', hi: 'तैयारी', bn: 'প্রস্তুতি' },
    },
    {
      dayOffset: 0,
      time: '18:30',
      durationMinutes: 30,
      anchor: true,
      title: { en: 'Guests arrive', hi: 'मेहमानों का आगमन', bn: 'অতিথিদের আগমন' },
    },
    {
      dayOffset: 0,
      time: '19:00',
      durationMinutes: 60,
      title: { en: 'Main celebration', hi: 'मुख्य उत्सव', bn: 'মূল উদযাপন' },
    },
    {
      dayOffset: 0,
      time: '20:00',
      durationMinutes: 90,
      title: { en: 'Dinner', hi: 'रात्रिभोज', bn: 'নৈশভোজ' },
    },
    {
      dayOffset: 0,
      time: '21:30',
      durationMinutes: 30,
      title: {
        en: 'Thank-you and goodbyes',
        hi: 'धन्यवाद और विदाई',
        bn: 'ধন্যবাদ ও বিদায়',
      },
    },
  ],
};
