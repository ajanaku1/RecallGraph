import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { ASSETS, CAPTIONS, COLORS, CONTENT } from '../constants';
import { DISPLAY_FONT } from '../fonts';
import { EvidenceImage } from '../components/EvidenceImage';
import { SceneShell } from '../components/SceneShell';
import { Subtitles } from '../components/Subtitles';

export function ImpactScene(): React.JSX.Element {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reveal = spring({ frame: frame - 20, fps, from: 0, to: 1, config: { damping: 28, stiffness: 90 } });

  return (
    <SceneShell kicker={CONTENT.impact.kicker}>
      <AbsoluteFill style={layoutStyle}>
        <div style={copyStyle}>
          <h1 style={headingStyle}>{CONTENT.impact.title}</h1>
          <div style={statStyle}>{CONTENT.impact.stat}</div>
          <div style={labelStyle}>{CONTENT.impact.label}</div>
        </div>
        <div
          style={{ ...imageWrap, opacity: reveal, transform: `translateY(${(1 - reveal) * 24}px)` }}
        >
          <EvidenceImage src={ASSETS.landing} alt={CONTENT.impact.title} />
        </div>
      </AbsoluteFill>
      <Subtitles entries={CAPTIONS.impact} />
    </SceneShell>
  );
}

const layoutStyle: React.CSSProperties = {
  padding: '142px 92px 128px',
  display: 'grid',
  gridTemplateColumns: '420px 1fr',
  gap: 50,
  alignItems: 'center',
};
const copyStyle: React.CSSProperties = { paddingLeft: 30 };
const headingStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: DISPLAY_FONT,
  fontSize: 62,
  lineHeight: 1.1,
  fontWeight: 400,
};
const statStyle: React.CSSProperties = {
  marginTop: 38,
  paddingTop: 28,
  borderTop: `2px solid ${COLORS.oxide}`,
  color: COLORS.petrol,
  fontSize: 28,
  fontWeight: 800,
  lineHeight: 1.35,
};
const labelStyle: React.CSSProperties = {
  display: 'inline-flex',
  marginTop: 24,
  padding: '10px 14px',
  borderRadius: 4,
  background: COLORS.selection,
  color: COLORS.petrol,
  fontSize: 16,
  fontWeight: 800,
  textTransform: 'uppercase',
  letterSpacing: 1.5,
};
const imageWrap: React.CSSProperties = { height: 770 };
