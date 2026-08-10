import { Audio } from '@remotion/media';
import { interpolate, staticFile, useVideoConfig } from 'remotion';
import { FPS } from '../constants';

interface SceneAudioProps {
  src: string;
  audioDuration: number;
}

export function SceneAudio({ src, audioDuration }: SceneAudioProps): React.JSX.Element {
  const { durationInFrames } = useVideoConfig();

  return (
    <Audio
      src={staticFile(src)}
      trimAfter={audioDuration}
      volume={(frame) => {
        const fadeIn = interpolate(frame, [0, 9], [0, 1], clamp());
        const fadeOut = interpolate(frame, [audioDuration - FPS, audioDuration], [1, 0], clamp());
        return Math.min(fadeIn, fadeOut, durationInFrames > 0 ? 1 : 0);
      }}
    />
  );
}

function clamp(): { extrapolateLeft: 'clamp'; extrapolateRight: 'clamp' } {
  return { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };
}
