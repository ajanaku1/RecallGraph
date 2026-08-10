import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';
import { ASSETS, COLORS, CONTENT, SOCIAL_DURATION } from './constants';
import { BODY_FONT, DISPLAY_FONT } from './fonts';

export function SocialClip(): React.JSX.Element {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame: frame - 8, fps, from: 0, to: 1, config: { damping: 24, stiffness: 105 } });
  const copy = spring({ frame: frame - 32, fps, from: 0, to: 1, config: { damping: 24, stiffness: 95 } });
  const exit = interpolate(frame, [SOCIAL_DURATION - 24, SOCIAL_DURATION], [1, 0], clamp());

  return (
    <AbsoluteFill style={{ ...canvasStyle, opacity: exit }}>
      <div style={stitchStyle} />
      <div style={eyebrowStyle}>{CONTENT.social.eyebrow}</div>
      <Img
        src={staticFile(ASSETS.logoSvg)}
        style={{ ...logoStyle, opacity: logo, transform: `scale(${0.93 + logo * 0.07})` }}
      />
      <div style={{ ...copyStyle, opacity: copy, transform: `translateY(${(1 - copy) * 28}px)` }}>
        <h1 style={questionStyle}>{CONTENT.social.question}</h1>
        <p style={answerStyle}>{CONTENT.social.answer}</p>
      </div>
      <div style={proofStyle}>{CONTENT.social.proof}</div>
    </AbsoluteFill>
  );
}

const canvasStyle: React.CSSProperties = {
  background: COLORS.paper,
  color: COLORS.carbon,
  alignItems: 'center',
  justifyContent: 'center',
  padding: '140px 74px',
};
const stitchStyle: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  width: 18,
  background: COLORS.vermilion,
};
const eyebrowStyle: React.CSSProperties = {
  position: 'absolute',
  top: 92,
  left: 90,
  color: COLORS.petrol,
  fontFamily: BODY_FONT,
  fontSize: 24,
  fontWeight: 800,
  letterSpacing: 4,
};
const logoStyle: React.CSSProperties = {
  width: 190,
  height: 190,
  borderRadius: 26,
  marginBottom: 56,
  boxShadow: `0 24px 70px ${COLORS.shadowMedium}`,
};
const copyStyle: React.CSSProperties = { textAlign: 'center' };
const questionStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: DISPLAY_FONT,
  fontSize: 84,
  lineHeight: 1.08,
  fontWeight: 400,
};
const answerStyle: React.CSSProperties = {
  margin: '38px 0 0',
  color: COLORS.petrol,
  fontFamily: BODY_FONT,
  fontSize: 45,
  lineHeight: 1.2,
  fontWeight: 750,
};
const proofStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 110,
  paddingTop: 24,
  borderTop: `3px solid ${COLORS.oxide}`,
  color: COLORS.registry,
  fontFamily: BODY_FONT,
  fontSize: 26,
  fontWeight: 700,
  letterSpacing: 2,
};

function clamp(): { extrapolateLeft: 'clamp'; extrapolateRight: 'clamp' } {
  return { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };
}
