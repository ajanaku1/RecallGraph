import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { ASSETS, CAPTIONS, COLORS, CONTENT } from '../constants';
import { DISPLAY_FONT } from '../fonts';
import { SceneShell } from '../components/SceneShell';
import { Subtitles } from '../components/Subtitles';

export function CloseScene(): React.JSX.Element {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const enter = spring({ frame: frame - 12, fps, from: 0, to: 1, config: { damping: 28, stiffness: 90 } });
  const exit = interpolate(frame, [durationInFrames - 60, durationInFrames], [1, 0], clamp());

  return (
    <SceneShell kicker={CONTENT.close.kicker}>
      <AbsoluteFill style={{ ...layoutStyle, opacity: exit }}>
        <Img
          src={staticFile(ASSETS.logoSvg)}
          style={{ ...logoStyle, opacity: enter, transform: `scale(${0.93 + enter * 0.07})` }}
        />
        <h1 style={headingStyle}>{CONTENT.close.title}</h1>
        <div style={statsStyle}>
          {CONTENT.close.stats.map((stat) => (
            <span key={stat} style={statStyle}>{stat}</span>
          ))}
        </div>
        <div style={linksStyle}>
          <span>{CONTENT.close.live}</span>
          <span>{CONTENT.close.repo}</span>
        </div>
      </AbsoluteFill>
      <Subtitles entries={CAPTIONS.close} />
    </SceneShell>
  );
}

const layoutStyle: React.CSSProperties = {
  alignItems: 'center',
  justifyContent: 'center',
  padding: '120px 100px 130px',
};
const logoStyle: React.CSSProperties = {
  width: 130,
  height: 130,
  borderRadius: 20,
  marginBottom: 32,
  boxShadow: `0 20px 60px ${COLORS.shadowMedium}`,
};
const headingStyle: React.CSSProperties = {
  maxWidth: 1320,
  margin: 0,
  fontFamily: DISPLAY_FONT,
  fontSize: 78,
  fontWeight: 400,
  textAlign: 'center',
  lineHeight: 1.12,
};
const statsStyle: React.CSSProperties = { display: 'flex', gap: 16, marginTop: 40 };
const statStyle: React.CSSProperties = {
  padding: '14px 18px',
  borderRadius: 4,
  border: `1px solid ${COLORS.rule}`,
  background: COLORS.evidence,
  color: COLORS.petrol,
  fontSize: 18,
  fontWeight: 800,
};
const linksStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  marginTop: 34,
  color: COLORS.registry,
  fontSize: 20,
  fontWeight: 650,
  textAlign: 'center',
};

function clamp(): { extrapolateLeft: 'clamp'; extrapolateRight: 'clamp' } {
  return { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };
}
