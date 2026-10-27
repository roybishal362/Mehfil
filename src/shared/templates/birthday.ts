import { SHARED_TITLES } from './common';
import type { EventTemplate } from './types';

/** Birthdays from first birthdays to milestone parties. Weights sum to 100. */
export const birthdayTemplate: EventTemplate = {
  type: 'birthday',
  budget: [
    { category: 'venue', weight: 20, min: 0, max: 40 },
    { category: 'food_cake', weight: 35, min: 20, max: 55, perGuest: true },
    { category: 'decor', weight: 15, min: 5, max: 25 },
    { category: 'entertainment', weight: 12, min: 0, max: 25 },
    { category: 'return_gifts', weight: 8, min: 0, max: 15, perGuest: true },
    { category: 'photography', weight: 4, min: 0, max: 12 },
    { category: 'invitations', weight: 2, min: 0, max: 6 },
    { category: 'contingency', weight: 4, min: 2, max: 10 },
  ],
  tasks: [
    {
      key: 'budget',
      title: SHARED_TITLES.budget,
      daysBefore: 45,
      priority: 'high',
      category: 'planning',
    },
    {
      key: 'theme',
      title: { en: 'Choose a theme', hi: 'थीम चुनें', bn: 'থিম বেছে নিন' },
      daysBefore: 40,
      priority: 'medium',
      category: 'planning',
    },
    {
      key: 'venue',
      title: {
        en: 'Book the venue or plan the home set-up',
        hi: 'वेन्यू बुक करें या घर पर तैयारी की योजना बनाएँ',
        bn: 'ভেন্যু বুক করুন বা বাড়িতে আয়োজনের পরিকল্পনা করুন',
      },
      daysBefore: 35,
      priority: 'high',
      category: 'venue',
    },
    {
      key: 'invitations',
      title: SHARED_TITLES.invitations,
      daysBefore: 21,
      priority: 'high',
      category: 'guests',
    },
    {
      key: 'entertainment',
      title: { en: 'Book entertainment', hi: 'मनोरंजन बुक करें', bn: 'বিনোদনের ব্যবস্থা বুক করুন' },
      daysBefore: 21,
      priority: 'medium',
      category: 'vendors',
    },
    {
      key: 'cake',
      title: { en: 'Order the cake', hi: 'केक ऑर्डर करें', bn: 'কেক অর্ডার দিন' },
      daysBefore: 10,
      priority: 'high',
      category: 'vendors',
    },
    {
      key: 'decor-gifts',
      title: {
        en: 'Buy decorations and return gifts',
        hi: 'सजावट और रिटर्न गिफ़्ट खरीदें',
        bn: 'সাজসজ্জা ও রিটার্ন গিফট কিনুন',
      },
      daysBefore: 7,
      priority: 'medium',
      category: 'logistics',
    },
    {
      key: 'rsvp',
      title: {
        en: 'Confirm RSVPs and food quantities',
        hi: 'RSVP और खाने की मात्रा पक्की करें',
        bn: 'RSVP ও খাবারের পরিমাণ নিশ্চিত করুন',
      },
      daysBefore: 5,
      priority: 'high',
      category: 'guests',
    },
    {
      key: 'games',
      title: {
        en: 'Plan games and the party schedule',
        hi: 'खेल और पार्टी का कार्यक्रम तय करें',
        bn: 'খেলা ও পার্টির সময়সূচি ঠিক করুন',
      },
      daysBefore: 4,
      priority: 'medium',
      category: 'day_of',
    },
    {
      key: 'camera',
      title: {
        en: 'Charge the camera and prepare a playlist',
        hi: 'कैमरा चार्ज करें और प्लेलिस्ट बनाएँ',
        bn: 'ক্যামেরা চার্জ দিন ও প্লেলিস্ট তৈরি করুন',
      },
      daysBefore: 1,
      priority: 'low',
      category: 'day_of',
    },
    {
      key: 'thanks',
      title: SHARED_TITLES.thanks,
      daysBefore: -3,
      priority: 'low',
      category: 'after',
    },
  ],
  vendors: [
    { category: 'venue', priority: 'high', leadDays: 35, budgetCategory: 'venue' },
    { category: 'cake_baker', priority: 'high', leadDays: 10, budgetCategory: 'food_cake' },
    { category: 'caterer', priority: 'medium', leadDays: 21, budgetCategory: 'food_cake' },
    { category: 'decorator', priority: 'medium', leadDays: 14, budgetCategory: 'decor' },
    { category: 'entertainer', priority: 'medium', leadDays: 21, budgetCategory: 'entertainment' },
    { category: 'photographer', priority: 'low', leadDays: 21, budgetCategory: 'photography' },
  ],
  schedule: [
    {
      dayOffset: 0,
      time: '14:30',
      durationMinutes: 90,
      title: { en: 'Decorate and set up', hi: 'सजावट और तैयारी', bn: 'সাজসজ্জা ও প্রস্তুতি' },
    },
    {
      dayOffset: 0,
      time: '16:00',
      durationMinutes: 30,
      anchor: true,
      title: SHARED_TITLES.guestsArrive,
    },
    {
      dayOffset: 0,
      time: '16:30',
      durationMinutes: 60,
      title: { en: 'Games and activities', hi: 'खेल और गतिविधियाँ', bn: 'খেলা ও নানা আয়োজন' },
    },
    {
      dayOffset: 0,
      time: '17:30',
      durationMinutes: 30,
      title: { en: 'Cake cutting', hi: 'केक काटना', bn: 'কেক কাটা' },
    },
    {
      dayOffset: 0,
      time: '18:00',
      durationMinutes: 45,
      title: { en: 'Food is served', hi: 'भोजन परोसा जाता है', bn: 'খাবার পরিবেশন' },
    },
    {
      dayOffset: 0,
      time: '18:45',
      durationMinutes: 30,
      title: {
        en: 'Return gifts and goodbyes',
        hi: 'रिटर्न गिफ़्ट और विदाई',
        bn: 'রিটার্ন গিফট ও বিদায়',
      },
    },
  ],
};
