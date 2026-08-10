import { Img, staticFile } from 'remotion';
import { ASSETS, COLORS } from '../constants';
import { BODY_FONT } from '../fonts';

interface SceneShellProps {
  children: React.ReactNode;
  kicker: string;
  dark?: boolean;
}

export function SceneShell({ children, kicker, dark = false }: SceneShellProps): React.JSX.Element {
  const ink = dark ? COLORS.evidence : COLORS.carbon;
  return (
    <div style={{ ...shellStyle, background: dark ? COLORS.docket : COLORS.paper, color: ink }}>
      <div style={brandStyle}>
        <Img src={staticFile(ASSETS.logoSvg)} style={logoStyle} />
        <span>RecallGraph</span>
      </div>
      <div style={{ ...kickerStyle, color: dark ? COLORS.docketMuted : COLORS.petrol }}>{kicker}</div>
      {children}
    </div>
  );
}

const shellStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
  fontFamily: BODY_FONT,
};

const brandStyle: React.CSSProperties = {
  position: 'absolute',
  top: 48,
  left: 64,
  zIndex: 20,
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  fontSize: 22,
  fontWeight: 700,
};

const logoStyle: React.CSSProperties = { width: 46, height: 46, borderRadius: 8 };

const kickerStyle: React.CSSProperties = {
  position: 'absolute',
  top: 58,
  right: 68,
  zIndex: 20,
  fontSize: 15,
  fontWeight: 800,
  letterSpacing: 2.4,
  textTransform: 'uppercase',
};
