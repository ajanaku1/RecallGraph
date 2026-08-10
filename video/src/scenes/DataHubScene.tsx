import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { CAPTIONS, COLORS, CONTENT } from '../constants';
import { DISPLAY_FONT } from '../fonts';
import { SceneShell } from '../components/SceneShell';
import { Subtitles } from '../components/Subtitles';

export function DataHubScene(): React.JSX.Element {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const reveal = spring({ frame: frame - 24, fps, from: 0, to: 1, config: { damping: 28, stiffness: 85 } });
  const rows = [
    CONTENT.datahub.server,
    CONTENT.datahub.tool,
    CONTENT.datahub.result,
    CONTENT.datahub.mutation,
  ];

  return (
    <SceneShell kicker={CONTENT.datahub.kicker} dark>
      <AbsoluteFill style={layoutStyle}>
        <div style={copyStyle}>
          <h1 style={headingStyle}>{CONTENT.datahub.title}</h1>
          <div style={sourceStyle}>{CONTENT.datahub.source}</div>
        </div>
        <div
          style={{ ...terminalStyle, opacity: reveal, transform: `translateY(${(1 - reveal) * 24}px)` }}
        >
          {rows.map((row, index) => (
            <div key={row} style={rowStyle}>
              <span style={index === rows.length - 1 ? accentDotStyle : dotStyle} />
              <span>{row}</span>
            </div>
          ))}
        </div>
      </AbsoluteFill>
      <Subtitles entries={CAPTIONS.datahub} />
    </SceneShell>
  );
}

const layoutStyle: React.CSSProperties = {
  padding: '150px 140px 130px',
  display: 'grid',
  gridTemplateColumns: '0.9fr 1.1fr',
  gap: 80,
  alignItems: 'center',
};
const copyStyle: React.CSSProperties = { paddingLeft: 20 };
const headingStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: DISPLAY_FONT,
  color: COLORS.evidence,
  fontSize: 72,
  lineHeight: 1.08,
  fontWeight: 400,
};
const sourceStyle: React.CSSProperties = {
  marginTop: 34,
  paddingTop: 26,
  borderTop: `2px solid ${COLORS.vermilion}`,
  color: COLORS.docketMuted,
  fontSize: 22,
  fontWeight: 650,
};
const terminalStyle: React.CSSProperties = {
  padding: '34px 38px',
  border: `1px solid ${COLORS.registry}`,
  borderRadius: 12,
  background: COLORS.docketDeep,
  boxShadow: `0 24px 80px ${COLORS.shadowStrong}`,
};
const rowStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '14px 1fr',
  gap: 18,
  alignItems: 'center',
  minHeight: 86,
  borderBottom: `1px solid ${COLORS.registry}`,
  color: COLORS.evidence,
  fontSize: 26,
  fontWeight: 600,
};
const dotStyle: React.CSSProperties = { width: 10, height: 10, borderRadius: 10, background: COLORS.petrol };
const accentDotStyle: React.CSSProperties = { ...dotStyle, background: COLORS.vermilion };
