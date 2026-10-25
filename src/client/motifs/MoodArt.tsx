/**
 * The decorations a plan's header takes on for its mood: a red border and a toran of marigolds
 * for a wedding, falling shiuli for Durga Puja, a sunburst for Ganpati, bunting for a birthday,
 * lights and hanging lanterns for Diwali, a toran for other festivals and alpana corners for
 * anything else. Each mood also has a small cluster of 3D objects drifting beside the title.
 */
import type { Mood } from '../../shared/domain/mood';
import type { ArtName } from '../art';
import { Art } from '../art/Art';
import { AlpanaCorner, Bunting, Garland, ShiuliRain, StringLights, Sunburst } from './festive';

const CLUSTERS: Readonly<Record<Mood, readonly ArtName[]>> = {
  wedding: ['bouquet', 'ring', 'marigold'],
  durga: ['lotus', 'hibiscus', 'marigold'],
  ganpati: ['elephant', 'marigold', 'coconut'],
  birthday: ['balloon', 'balloon', 'balloon', 'cake'],
  diwali: ['diya', 'sparkles'],
  utsav: ['kite', 'marigold', 'lantern'],
  neutral: ['gift', 'sparkles'],
};

/** A few 3D objects beside the title, each drifting on its own (positions in plan.css). */
function Cluster({ mood }: { mood: Mood }) {
  return (
    <div className={`art-cluster art-cluster--${mood}`}>
      {CLUSTERS[mood].map((name, index) => (
        // The same picture may appear more than once (balloons), so the position is the key.
        <span key={index} className="art-cluster-item motion">
          <Art name={name} size={96} />
        </span>
      ))}
    </div>
  );
}

/** Three lanterns on cords of different lengths, swaying. */
function HangingLanterns() {
  return (
    <div className="art-lanterns">
      {[0, 1, 2].map((index) => (
        <span key={index} className="hang motion">
          <Art name="lantern" size={96} />
        </span>
      ))}
    </div>
  );
}

function Decoration({ mood }: { mood: Mood }) {
  switch (mood) {
    case 'wedding':
    case 'utsav':
      return <Garland className="art-top" />;
    case 'durga':
      return <ShiuliRain />;
    case 'ganpati':
      return (
        <>
          <Sunburst className="art-sun" />
          <Garland className="art-top" />
        </>
      );
    case 'birthday':
      return <Bunting className="art-top" />;
    case 'diwali':
      return (
        <>
          <StringLights className="art-top" />
          <HangingLanterns />
        </>
      );
    case 'neutral':
      return (
        <>
          <AlpanaCorner className="art-corner art-corner--start" />
          <AlpanaCorner className="art-corner art-corner--end" />
        </>
      );
  }
}

export function MoodArt({ mood }: { mood: Mood }) {
  return (
    <>
      <Decoration mood={mood} />
      <Cluster mood={mood} />
    </>
  );
}
