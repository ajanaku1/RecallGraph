import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { CAPTIONS, COLORS, CONTENT } from '../constants';
import { BODY_FONT, DISPLAY_FONT } from '../fonts';
import { SceneShell } from '../components/SceneShell';
import { Subtitles } from '../components/Subtitles';

export function HookScene(): React.JSX.Element {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame: frame - 8, fps, from: 0, to: 1, config: { damping: 24, stiffness: 100 } });
  const path = interpolate(frame, [8, 92], [0, 1], clamp());
  const stitch = interpolate(frame, [76, 112], [0, 1], clamp());

  return (
    <SceneShell kicker={CONTENT.hook.kicker}>
      <AbsoluteFill style={bodyStyle}>
        <div
          style={{ ...titleWrap, opacity: enter, transform: `translateY(${(1 - enter) * 24}px)` }}
        >
          <h1 style={titleStyle}>{CONTENT.hook.title}</h1>
          <p style={questionStyle}>{CONTENT.hook.question}</p>
        </div>
        <LineageAnimation path={path} stitch={stitch} />
      </AbsoluteFill>
      <Subtitles entries={CAPTIONS.hook} />
    </SceneShell>
  );
}

function LineageAnimation({ path, stitch }: { path: number; stitch: number }): React.JSX.Element {
  return (
    <svg viewBox="0 0 1180 260" style={lineageStyle}>
      <path
        d="M30 130 H385 C470 130 470 60 555 60 H840 C920 60 920 130 1000 130 H1140"
        pathLength="1"
        style={pathStyle(path)}
      />
      <path
        d="M385 130 C470 130 470 205 555 205 H840 C920 205 920 130 1000 130"
        pathLength="1"
        style={pathStyle(path)}
      />
      <path d="M1000 64 V196" pathLength="1" style={stitchStyle(stitch)} />
    </svg>
  );
}

const bodyStyle: React.CSSProperties = {
  alignItems: 'center',
  justifyContent: 'center',
  padding: '130px 120px 120px',
};
const titleWrap: React.CSSProperties = {
  position: 'absolute',
  top: 190,
  left: 140,
  right: 140,
  textAlign: 'center',
};
const titleStyle: React.CSSProperties = {
  margin: 0,
  fontFamily: DISPLAY_FONT,
  fontSize: 112,
  fontWeight: 400,
  letterSpacing: -3,
};
const questionStyle: React.CSSProperties = {
  margin: '22px 0 0',
  fontFamily: BODY_FONT,
  color: COLORS.petrol,
  fontSize: 36,
  fontWeight: 700,
};
const lineageStyle: React.CSSProperties = {
  position: 'absolute',
  left: 360,
  right: 360,
  bottom: 230,
  width: 1200,
  overflow: 'visible',
};

function pathStyle(progress: number): React.CSSProperties {
  return {
    fill: 'none',
    stroke: COLORS.carbon,
    strokeWidth: 15,
    strokeLinecap: 'round',
    strokeDasharray: 1,
    strokeDashoffset: 1 - progress,
  };
}

function stitchStyle(progress: number): React.CSSProperties {
  return {
    fill: 'none',
    stroke: COLORS.vermilion,
    strokeWidth: 22,
    strokeLinecap: 'round',
    strokeDasharray: 1,
    strokeDashoffset: 1 - progress,
  };
}

function clamp(): { extrapolateLeft: 'clamp'; extrapolateRight: 'clamp' } {
  return { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' };
}
