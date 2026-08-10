import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { ASSETS, CAPTIONS, COLORS, CONTENT } from '../constants';
import { DISPLAY_FONT } from '../fonts';
import { SceneShell } from '../components/SceneShell';
import { Subtitles } from '../components/Subtitles';

export function ReceiptScene(): React.JSX.Element {
  const frame = useCurrentFrame();
  const mismatch = interpolate(frame, [430, 475], [0, 1], clamp());

  return (
    <SceneShell kicker={CONTENT.receipt.kicker}>
      <AbsoluteFill style={layoutStyle}>
        <h1 style={headingStyle}>{CONTENT.receipt.title}</h1>
        <div style={imageWrap}>
          <Img
            src={staticFile(ASSETS.verifiedReceipt)}
            style={{ ...imageStyle, opacity: 1 - mismatch }}
          />
          <Img
            src={staticFile(ASSETS.mismatchEvidence)}
            style={{ ...imageStyle, opacity: mismatch }}
          />
          <div style={{ ...trustedLabel, opacity: 1 - mismatch }}>{CONTENT.receipt.trusted}</div>
          <div style={{ ...mismatchLabel, opacity: mismatch }}>{CONTENT.receipt.mismatch}</div>
        </div>
        <div style={disclaimerStyle}>{CONTENT.receipt.disclaimer}</div>
      </AbsoluteFill>
      <Subtitles entries={CAPTIONS.receipt} />
    </SceneShell>
  );
}

const layoutStyle: React.CSSProperties = { padding: '126px 95px 124px', alignItems: 'center' };
const headingStyle: React.CSSProperties = { margin: '0 0 22px', fontFamily: DISPLAY_FONT, fontSize: 58, fontWeight: 400 };
const imageWrap: React.CSSProperties = {
  position: 'relative',
  width: 1510,
  height: 750,
  overflow: 'hidden',
  borderRadius: 14,
  border: `1px solid ${COLORS.rule}`,
  background: COLORS.evidence,
  boxShadow: `0 24px 70px ${COLORS.shadowMedium}`,
};
const imageStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  objectPosition: 'top',
};
const trustedLabel: React.CSSProperties = {
  position: 'absolute',
  top: 22,
  right: 22,
  padding: '12px 16px',
  borderRadius: 4,
  color: COLORS.evidence,
  background: COLORS.petrol,
  fontSize: 18,
  fontWeight: 800,
};
const mismatchLabel: React.CSSProperties = {
  position: 'absolute',
  top: 22,
  right: 22,
  padding: '12px 16px',
  borderRadius: 4,
  color: COLORS.evidence,
  background: COLORS.oxide,
  fontSize: 18,
  fontWeight: 800,
};
const disclaimerStyle: React.CSSProperties = {
  marginTop: 18,
  color: COLORS.registry,
  fontSize: 18,
  fontWeight: 700,
  letterSpacing: 0.5,
};

function clamp(): { extrapolateLeft: 'clamp'; extrapolateRight: 'clamp' } {
  return { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };
}
