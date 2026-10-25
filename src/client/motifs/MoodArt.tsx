/**
 * The decorations a plan's header takes on for its mood: a red border and toran for a wedding,
 * falling shiuli and the dhak for Durga Puja, a sunburst and modaks for Ganpati, bunting and
 * balloons for a birthday, lights and kandils for Diwali, a toran for other festivals and
 * alpana corners for anything else.
 */
import type { Mood } from '../../shared/domain/mood';
import {
  AlpanaCorner,
  Balloons,
  Bunting,
  Dhak,
  Garland,
  Kandils,
  ModakStack,
  ShiuliRain,
  StringLights,
  Sunburst,
} from './festive';

export function MoodArt({ mood }: { mood: Mood }) {
  switch (mood) {
    case 'wedding':
      return <Garland className="art-top" />;
    case 'durga':
      return (
        <>
          <ShiuliRain />
          <Dhak className="art-dhak" />
        </>
      );
    case 'ganpati':
      return (
        <>
          <Sunburst className="art-sun" />
          <Garland className="art-top" />
          <ModakStack className="art-modaks" />
        </>
      );
    case 'birthday':
      return (
        <>
          <Bunting className="art-top" />
          <Balloons className="art-balloons" />
        </>
      );
    case 'diwali':
      return (
        <>
          <StringLights className="art-top" />
          <Kandils className="art-kandils" />
        </>
      );
    case 'utsav':
      return <Garland className="art-top" />;
    case 'neutral':
      return (
        <>
          <AlpanaCorner className="art-corner art-corner--start" />
          <AlpanaCorner className="art-corner art-corner--end" />
        </>
      );
  }
}
