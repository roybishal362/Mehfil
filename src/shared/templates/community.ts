import type { EventTemplate } from './types';

/** Festivals, pujas, fundraisers and neighbourhood events. Weights sum to 100. */
export const communityTemplate: EventTemplate = {
  type: 'community',
  budget: [
    { category: 'venue_permits', weight: 15, min: 0, max: 30 },
    { category: 'catering', weight: 28, min: 10, max: 45, perGuest: true },
    { category: 'sound_lighting', weight: 12, min: 5, max: 25 },
    { category: 'decor', weight: 10, min: 3, max: 20 },
    { category: 'performers', weight: 10, min: 0, max: 25 },
    { category: 'publicity', weight: 5, min: 2, max: 12 },
    { category: 'safety_cleanup', weight: 6, min: 3, max: 12 },
    { category: 'volunteers', weight: 6, min: 2, max: 12 },
    { category: 'supplies', weight: 4, min: 1, max: 10 },
    { category: 'contingency', weight: 4, min: 2, max: 10 },
  ],
  tasks: [
    {
      key: 'committee',
      title: {
        en: 'Form the organising committee and assign roles',
        hi: 'आयोजन समिति बनाएँ और ज़िम्मेदारियाँ बाँटें',
        bn: 'আয়োজক কমিটি গড়ুন ও দায়িত্ব ভাগ করুন',
      },
      daysBefore: 90,
      priority: 'high',
      category: 'planning',
    },
    {
      key: 'budget',
      title: {
        en: 'Set the budget and a sponsorship plan',
        hi: 'बजट और प्रायोजन योजना तय करें',
        bn: 'বাজেট ও স্পনসরশিপ পরিকল্পনা ঠিক করুন',
      },
      daysBefore: 80,
      priority: 'high',
      category: 'planning',
    },
    {
      key: 'venue',
      title: {
        en: 'Book the venue or pandal site',
        hi: 'वेन्यू या पंडाल की जगह बुक करें',
        bn: 'ভেন্যু বা প্যান্ডেলের জায়গা বুক করুন',
      },
      daysBefore: 75,
      priority: 'high',
      category: 'venue',
    },
    {
      key: 'permits',
      title: {
        en: 'Apply for police and municipal permissions',
        hi: 'पुलिस और नगर निगम की अनुमति के लिए आवेदन करें',
        bn: 'পুলিশ ও পৌরসভার অনুমতির জন্য আবেদন করুন',
      },
      daysBefore: 60,
      priority: 'high',
      category: 'logistics',
    },
    {
      key: 'sound',
      title: {
        en: 'Book sound, lighting and a generator',
        hi: 'साउंड, लाइटिंग और जनरेटर बुक करें',
        bn: 'সাউন্ড, লাইটিং ও জেনারেটর বুক করুন',
      },
      daysBefore: 45,
      priority: 'high',
      category: 'vendors',
    },
    {
      key: 'programme',
      title: {
        en: 'Confirm performers and the cultural programme',
        hi: 'कलाकार और सांस्कृतिक कार्यक्रम पक्का करें',
        bn: 'শিল্পী ও সাংস্কৃতিক অনুষ্ঠান নিশ্চিত করুন',
      },
      daysBefore: 40,
      priority: 'medium',
      category: 'vendors',
    },
    {
      key: 'food',
      title: {
        en: 'Arrange food: caterer or community kitchen',
        hi: 'भोजन की व्यवस्था: कैटरर या सामुदायिक रसोई',
        bn: 'খাবারের ব্যবস্থা: কেটারার বা কমিউনিটি কিচেন',
      },
      daysBefore: 35,
      priority: 'high',
      category: 'vendors',
    },
    {
      key: 'publicity',
      title: {
        en: 'Publicise: posters, WhatsApp groups and social media',
        hi: 'प्रचार: पोस्टर, व्हाट्सऐप ग्रुप और सोशल मीडिया',
        bn: 'প্রচার: পোস্টার, হোয়াটসঅ্যাপ গ্রুপ ও সোশ্যাল মিডিয়া',
      },
      daysBefore: 30,
      priority: 'medium',
      category: 'guests',
    },
    {
      key: 'volunteers',
      title: {
        en: 'Build the volunteer roster and brief everyone',
        hi: 'स्वयंसेवकों की सूची बनाएँ और सबको जानकारी दें',
        bn: 'স্বেচ্ছাসেবকদের তালিকা তৈরি করে সবাইকে বুঝিয়ে দিন',
      },
      daysBefore: 14,
      priority: 'high',
      category: 'logistics',
    },
    {
      key: 'safety',
      title: {
        en: 'Plan safety: first aid, fire safety and crowd flow',
        hi: 'सुरक्षा योजना: प्राथमिक उपचार, अग्नि सुरक्षा और भीड़ प्रबंधन',
        bn: 'নিরাপত্তা পরিকল্পনা: প্রাথমিক চিকিৎসা, অগ্নি-নিরাপত্তা ও ভিড় নিয়ন্ত্রণ',
      },
      daysBefore: 10,
      priority: 'high',
      category: 'logistics',
    },
    {
      key: 'cleanup',
      title: {
        en: 'Plan cleanup and waste segregation',
        hi: 'सफ़ाई और कचरा पृथक्करण की योजना बनाएँ',
        bn: 'পরিচ্ছন্নতা ও বর্জ্য পৃথকীকরণের পরিকল্পনা করুন',
      },
      daysBefore: 7,
      priority: 'medium',
      category: 'logistics',
    },
    {
      key: 'walkthrough',
      title: {
        en: 'Walk through the site with volunteers',
        hi: 'स्वयंसेवकों के साथ जगह का निरीक्षण करें',
        bn: 'স্বেচ্ছাসেবকদের সঙ্গে জায়গাটা ঘুরে দেখুন',
      },
      daysBefore: 1,
      priority: 'high',
      category: 'day_of',
    },
    {
      key: 'accounts',
      title: {
        en: 'Close the accounts and thank sponsors',
        hi: 'हिसाब पूरा करें और प्रायोजकों को धन्यवाद दें',
        bn: 'হিসাব মিটিয়ে স্পনসরদের ধন্যবাদ জানান',
      },
      daysBefore: -7,
      priority: 'medium',
      category: 'after',
    },
  ],
  vendors: [
    { category: 'pandal_tent', priority: 'high', leadDays: 75, budgetCategory: 'venue_permits' },
    {
      category: 'sound_lighting',
      priority: 'high',
      leadDays: 45,
      budgetCategory: 'sound_lighting',
    },
    { category: 'performers', priority: 'medium', leadDays: 40, budgetCategory: 'performers' },
    { category: 'caterer', priority: 'high', leadDays: 35, budgetCategory: 'catering' },
    { category: 'decorator', priority: 'medium', leadDays: 30, budgetCategory: 'decor' },
    {
      category: 'invitations_printer',
      priority: 'low',
      leadDays: 30,
      budgetCategory: 'publicity',
    },
    { category: 'security', priority: 'medium', leadDays: 14, budgetCategory: 'safety_cleanup' },
    { category: 'cleaning', priority: 'medium', leadDays: 7, budgetCategory: 'safety_cleanup' },
  ],
  schedule: [
    {
      dayOffset: 0,
      time: '07:00',
      durationMinutes: 60,
      title: {
        en: 'Volunteer briefing and site check',
        hi: 'स्वयंसेवकों की बैठक और जगह की जाँच',
        bn: 'স্বেচ্ছাসেবকদের ব্রিফিং ও জায়গা পরীক্ষা',
      },
    },
    {
      dayOffset: 0,
      time: '09:00',
      durationMinutes: 60,
      anchor: true,
      title: { en: 'Opening and welcome', hi: 'उद्घाटन और स्वागत', bn: 'উদ্বোধন ও স্বাগত' },
    },
    {
      dayOffset: 0,
      time: '12:30',
      durationMinutes: 90,
      title: {
        en: 'Lunch or prasad distribution',
        hi: 'दोपहर का भोजन या प्रसाद वितरण',
        bn: 'দুপুরের খাবার বা প্রসাদ বিতরণ',
      },
    },
    {
      dayOffset: 0,
      time: '17:00',
      durationMinutes: 180,
      title: { en: 'Cultural programme', hi: 'सांस्कृतिक कार्यक्रम', bn: 'সাংস্কৃতিক অনুষ্ঠান' },
    },
    {
      dayOffset: 0,
      time: '21:00',
      durationMinutes: 60,
      title: { en: 'Closing and cleanup', hi: 'समापन और सफ़ाई', bn: 'সমাপ্তি ও পরিচ্ছন্নতা' },
    },
  ],
};
