import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { CAPTIONS, COLORS, CONTENT } from '../constants';
import { DISPLAY_FONT } from '../fonts';
import { SceneShell } from '../components/SceneShell';
import { Subtitles } from '../components/Subtitles';

export function ProblemScene(): React.JSX.Element {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const left = spring({ frame: frame - 18, fps, from: 0, to: 1, config: { damping: 24, stiffness: 90 } });
  const right = spring({ frame: frame - 46, fps, from: 0, to: 1, config: { damping: 24, stiffness: 90 } });

  return (
    <SceneShell kicker={CONTENT.problem.kicker}>
      <AbsoluteFill style={layoutStyle}>
        <h1 style={headingStyle}>{CONTENT.problem.title}</h1>
        <ProblemComparison left={left} right={right} />
      </AbsoluteFill>
      <Subtitles entries={CAPTIONS.problem} />
    </SceneShell>
  );
}

function ProblemComparison({ left, right }: { left: number; right: number }): React.JSX.Element {
  const rightStyle = {
    ...cardStyle,
    ...recallCardStyle,
    opacity: right,
    transform: `translateX(${(1 - right) * 40}px)`,
  };
  return (
    <div style={columnsStyle}>
      <div style={{ ...cardStyle, opacity: left, transform: `translateX(${(1 - left) * -40}px)` }}>
        {CONTENT.problem.oldWay.map((item) => (
          <div key={item} style={oldRowStyle}>{item}</div>
        ))}
      </div>
      <div style={ruleStyle} />
      <div style={rightStyle}>
        {CONTENT.problem.recallWay.map((item) => (
          <div key={item} style={newRowStyle}>{item}</div>
        ))}
      </div>
    </div>
  );
}

const layoutStyle: React.CSSProperties = { padding: '150px 150px 135px', justifyContent: 'center' };
const headingStyle: React.CSSProperties = {
  margin: '0 0 52px',
  fontFamily: DISPLAY_FONT,
  fontSize: 72,
  fontWeight: 400,
  textAlign: 'center',
};
const columnsStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 2px 1fr',
  gap: 58,
  alignItems: 'stretch',
};
const cardStyle: React.CSSProperties = {
  minHeight: 390,
  padding: 44,
  borderRadius: 14,
  background: COLORS.evidence,
  border: `1px solid ${COLORS.rule}`,
  boxShadow: `0 24px 70px ${COLORS.shadowSoft}`,
};
const recallCardStyle: React.CSSProperties = { background: COLORS.docket, borderColor: COLORS.docket };
const oldRowStyle: React.CSSProperties = {
  marginBottom: 28,
  padding: '22px 26px',
  borderLeft: `5px solid ${COLORS.oxide}`,
  background: COLORS.riskQuiet,
  color: COLORS.carbon,
  fontSize: 28,
  fontWeight: 650,
};
const newRowStyle: React.CSSProperties = {
  marginBottom: 28,
  padding: '22px 26px',
  borderLeft: `5px solid ${COLORS.vermilion}`,
  color: COLORS.evidence,
  fontSize: 28,
  fontWeight: 650,
};
const ruleStyle: React.CSSProperties = { background: COLORS.rule };
