import { Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS } from '../constants';

interface EvidenceImageProps {
  src: string;
  alt: string;
  grow?: number;
}

export function EvidenceImage({ src, alt, grow = 0.018 }: EvidenceImageProps): React.JSX.Element {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const scale = interpolate(frame, [0, durationInFrames], [1, 1 + grow]);

  return (
    <div style={frameStyle} aria-label={alt}>
      <Img
        src={staticFile(src)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top', transform: `scale(${scale})` }}
      />
    </div>
  );
}

const frameStyle: React.CSSProperties = {
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  borderRadius: 14,
  border: `1px solid ${COLORS.rule}`,
  background: COLORS.evidence,
  boxShadow: `0 24px 70px ${COLORS.shadowMedium}`,
};
