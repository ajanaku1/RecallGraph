import type { Caption } from '@remotion/captions';
import { useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORS } from '../constants';
import { BODY_FONT } from '../fonts';

interface SubtitlesProps {
  entries: Caption[];
}

export function Subtitles({ entries }: SubtitlesProps): React.JSX.Element | null {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const timeMs = frame * 1000 / fps;
  const active = entries.find((entry) => timeMs >= entry.startMs && timeMs < entry.endMs);
  if (!active) return null;

  return (
    <div style={containerStyle}>
      <div style={captionStyle}>{active.text}</div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 34,
  left: 120,
  right: 120,
  display: 'flex',
  justifyContent: 'center',
  zIndex: 50,
};

const captionStyle: React.CSSProperties = {
  maxWidth: 1380,
  padding: '12px 24px',
  borderRadius: 8,
  background: COLORS.captionBackdrop,
  color: COLORS.evidence,
  fontFamily: BODY_FONT,
  fontSize: 27,
  fontWeight: 600,
  lineHeight: 1.35,
  textAlign: 'center',
  boxShadow: `0 10px 30px ${COLORS.shadowMedium}`,
};
