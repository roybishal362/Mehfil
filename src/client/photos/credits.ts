/**
 * Who took each photograph and under which licence, exactly as the source page gives it. The
 * footer lists these, and CREDITS.md says the same for people reading the code. The photos
 * here are cropped, resized and colour-graded versions of the originals.
 */
export interface PhotoCredit {
  /** Which file(s) this covers, by the name used in index.ts. */
  photo: string;
  title: string;
  author: string;
  license: 'CC BY-SA 4.0' | 'CC BY-SA 2.0' | 'CC BY 2.0' | 'CC0 1.0';
  licenseUrl: string;
  source: string;
}

const BY_SA_4 = 'https://creativecommons.org/licenses/by-sa/4.0/';

export const PHOTO_CREDITS: readonly PhotoCredit[] = [
  {
    photo: 'wedding',
    title: 'Bride offering her respects to God through a traditional gesture known as Namaskaram',
    author: 'I.Mahesh (derivative work by Cart)',
    license: 'CC BY-SA 4.0',
    licenseUrl: BY_SA_4,
    source:
      'https://commons.wikimedia.org/wiki/File:Bride_offering_her_respects_to_God_through_a_traditional_gesture_known_as_Namaskaram_(01)-1.jpg',
  },
  {
    photo: 'wedding-moment',
    title: 'Hindu wedding, Saptapadi ritual before Agni Yajna',
    author: 'Symphoney Symphoney',
    license: 'CC BY 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
    source:
      'https://commons.wikimedia.org/wiki/File:(A)_Hindu_wedding,_Saptapadi_ritual_before_Agni_Yajna.jpg',
  },
  {
    photo: 'durga',
    title: 'Durga, AE Block (part 2), Salt Lake, Kolkata',
    author: 'Subhrajyoti07',
    license: 'CC BY-SA 4.0',
    licenseUrl: BY_SA_4,
    source:
      'https://commons.wikimedia.org/wiki/File:%E0%A6%AC%E0%A7%8D%E0%A6%B2%E0%A6%95_-_%E0%A6%8F._%E0%A6%87._(%E0%A6%A6%E0%A7%8D%E0%A6%AC%E0%A6%BF%E0%A6%A4%E0%A7%80%E0%A6%AF%E0%A6%BC_%E0%A6%85%E0%A6%82%E0%A6%B6),_%E0%A6%B2%E0%A6%AC%E0%A6%A8_%E0%A6%B9%E0%A7%8D%E0%A6%B0%E0%A6%A6,_%E0%A6%95%E0%A6%B2%E0%A6%BF%E0%A6%95%E0%A6%BE%E0%A6%A4%E0%A6%BE_(%E0%A6%AE%E0%A7%81%E0%A6%96%E0%A7%8D%E0%A6%AF_%E0%A6%A6%E0%A7%82%E0%A6%B0%E0%A7%8D%E0%A6%97%E0%A6%BE_%E0%A6%AA%E0%A7%8D%E0%A6%B0%E0%A6%A4%E0%A6%BF%E0%A6%AE%E0%A6%BE%E0%A6%B0_%E0%A6%85%E0%A6%A4%E0%A6%BF%E0%A6%A8%E0%A6%BF%E0%A6%95%E0%A6%9F_%E0%A6%9A%E0%A6%BF%E0%A6%A4%E0%A7%8D%E0%A6%B0).jpg',
  },
  {
    photo: 'durga-moment',
    title: 'Dhakis 2024',
    author: 'Aditi Singh 7',
    license: 'CC BY-SA 4.0',
    licenseUrl: BY_SA_4,
    source: 'https://commons.wikimedia.org/wiki/File:Dhakis_2024.jpg',
  },
  {
    photo: 'diwali, diwali-moment',
    title: 'Woman lighting the candles for the Festival of Lights in India',
    author: 'AjoyDutta1997 (derivative work by Aristeas)',
    license: 'CC BY-SA 4.0',
    licenseUrl: BY_SA_4,
    source:
      'https://commons.wikimedia.org/wiki/File:Woman_lighting_the_candles_for_the_Festival_of_Lights_in_India_(cropped).jpg',
  },
  {
    photo: 'ganpati, ganpati-moment',
    title: 'Ganesh Chaturthi 2012',
    author: 'iwhosee',
    license: 'CC BY 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
    source: 'https://www.flickr.com/photos/28946056@N06/8810038059',
  },
  {
    photo: 'birthday, birthday-moment',
    title: 'Birthday Cake Candles, Harvey Family Summer Birthday Celebration 2010',
    author: 'Ryan Harvey',
    license: 'CC BY-SA 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
    source: 'https://www.flickr.com/photos/87933807@N00/4939561910',
  },
  {
    photo: 'utsav',
    title: 'Spirit of colors celebration',
    author: 'TAPAS KUMAR HALDER',
    license: 'CC BY-SA 4.0',
    licenseUrl: BY_SA_4,
    source: 'https://commons.wikimedia.org/wiki/File:Spirit_of_colors_celebration.jpg',
  },
  {
    photo: 'utsav-moment',
    title: 'Celebrating the festival of colors 09',
    author: 'Azimronnie',
    license: 'CC BY-SA 4.0',
    licenseUrl: BY_SA_4,
    source: 'https://commons.wikimedia.org/wiki/File:Celebrating_the_festival_of_colors_09.jpg',
  },
  {
    photo: 'neutral, flame',
    title: 'Diwali Diya - Small Bowl-like Lamps Made of Mud',
    author: 'onejeet',
    license: 'CC0 1.0',
    licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
    source: 'https://www.flickr.com/photos/143413219@N06/44911090145',
  },
];
