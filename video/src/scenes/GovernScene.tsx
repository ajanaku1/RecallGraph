import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { ASSETS, CAPTIONS, COLORS, CONTENT } from '../constants';
import { DISPLAY_FONT } from '../fonts';
import { EvidenceImage } from '../components/EvidenceImage';
import { SceneShell } from '../components/SceneShell';
import { Subtitles } from '../components/Subtitles';

export function GovernScene(): React.JSX.Element {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const left = spring({ frame: frame - 20, fps, from: 0, to: 1, config: { damping: 26, stiffness: 88 } });
  const right = spring({ frame: frame - 65, fps, from: 0, to: 1, config: { damping: 26, stiffness: 88 } });

  return (
    <SceneShell kicker={CONTENT.govern.kicker} dark>
      <AbsoluteFill style={layoutStyle}>
        <h1 style={headingStyle}>{CONTENT.govern.title}</h1>
        <div style={gridStyle}>
          <div
            style={{ ...panelStyle, opacity: left, transform: `translateY(${(1 - left) * 24}px)` }}
          >
            <div style={labelStyle}>{CONTENT.govern.left}</div>
            <EvidenceImage src={ASSETS.closureReady} alt={CONTENT.govern.left} grow={0.01} />
          </div>
          <div
            style={{ ...panelStyle, opacity: right, transform: `translateY(${(1 - right) * 24}px)` }}
          >
            <div style={labelStyle}>{CONTENT.govern.right}</div>
            <EvidenceImage src={ASSETS.guardedClose} alt={CONTENT.govern.right} grow={0.01} />
          </div>
        </div>
      </AbsoluteFill>
      <Subtitles entries={CAPTIONS.govern} />
    </SceneShell>
  );
}

const layoutStyle: React.CSSProperties = { padding: '130px 80px 125px', justifyContent: 'center' };
const headingStyle: React.CSSProperties = {
  margin: '0 0 30px',
  fontFamily: DISPLAY_FONT,
  color: COLORS.evidence,
  fontSize: 54,
  fontWeight: 400,
  textAlign: 'center',
};
const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 30 };
const panelStyle: React.CSSProperties = { position: 'relative', height: 690 };
const labelStyle: React.CSSProperties = {
  position: 'absolute',
  top: 18,
  left: 18,
  zIndex: 10,
  padding: '10px 14px',
  borderRadius: 4,
  background: COLORS.docket,
  border: `1px solid ${COLORS.registry}`,
  color: COLORS.evidence,
  fontSize: 16,
  fontWeight: 800,
  letterSpacing: 1,
};
