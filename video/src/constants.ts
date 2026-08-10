import type { Caption } from '@remotion/captions';
import captionData from '../public/captions.json';

export const FPS = 30;
export const W = 1920;
export const H = 1080;
export const CROSSFADE = 24;
export const SCENE_GAP = 36;
export const SOCIAL_DURATION = 10 * FPS;

export const COLORS = {
  paper: '#F2EFE7',
  evidence: '#FCFBF7',
  carbon: '#18201E',
  registry: '#63706B',
  petrol: '#1F5B63',
  oxide: '#D94A2F',
  docket: '#151B1A',
  vermilion: '#F05A3C',
  rule: '#BBC2BA',
  selection: '#E3EFED',
  riskQuiet: '#FBE3DC',
  docketMuted: '#C6CEC7',
  docketDeep: '#101514',
  captionBackdrop: 'rgba(21, 27, 26, 0.92)',
  shadowSoft: 'rgba(24, 32, 30, 0.10)',
  shadowMedium: 'rgba(24, 32, 30, 0.16)',
  shadowStrong: 'rgba(0, 0, 0, 0.28)',
} as const;

export const ASSETS = {
  logoSvg: 'assets/logo.svg',
  logoPng: 'assets/logo.png',
  landing: 'assets/landing.png',
  closureReady: 'assets/closure-ready.png',
  guardedClose: 'assets/guarded-close.png',
  verifiedReceipt: 'assets/verified-receipt.png',
  mismatchEvidence: 'assets/mismatch-evidence.png',
  liveGate: 'assets/live-gate.json',
} as const;

export const AUDIO_DURATIONS = {
  hook: 295,
  problem: 548,
  impact: 556,
  govern: 481,
  receipt: 630,
  datahub: 629,
  close: 450,
} as const;

export const SCENE_DURATIONS = {
  hook: AUDIO_DURATIONS.hook + SCENE_GAP,
  problem: AUDIO_DURATIONS.problem + SCENE_GAP,
  impact: AUDIO_DURATIONS.impact + SCENE_GAP,
  govern: AUDIO_DURATIONS.govern + SCENE_GAP,
  receipt: AUDIO_DURATIONS.receipt + SCENE_GAP,
  datahub: AUDIO_DURATIONS.datahub + SCENE_GAP,
  close: AUDIO_DURATIONS.close + SCENE_GAP,
} as const;

export const AUDIO_FILES = {
  hook: 'audio/01-hook.mp3',
  problem: 'audio/02-problem.mp3',
  impact: 'audio/03-impact.mp3',
  govern: 'audio/04-govern.mp3',
  receipt: 'audio/05-receipt.mp3',
  datahub: 'audio/06-datahub.mp3',
  close: 'audio/07-close.mp3',
} as const;

export const TOTAL_FRAMES = Object.values(SCENE_DURATIONS).reduce((sum, duration) => sum + duration, 0)
  - CROSSFADE * (Object.keys(SCENE_DURATIONS).length - 1);

export const CAPTIONS = captionData as Record<keyof typeof SCENE_DURATIONS, Caption[]>;

export const CONTENT = {
  hook: {
    kicker: 'Model recall command',
    title: 'A source is revoked.',
    question: 'What reaches production?',
  },
  problem: {
    kicker: 'The closure gap',
    title: 'Lineage is not closure evidence.',
    oldWay: ['Screenshots', 'Ticket fragments', 'Approval memory'],
    recallWay: ['Deterministic impact', 'Human dispositions', 'Fail-closed gates'],
  },
  impact: {
    kicker: 'Real product reveal',
    title: 'Every affected descendant, in one case.',
    stat: '2 models · 1 deployment · 2 unresolved',
    label: 'Hosted fixture evidence',
  },
  govern: {
    kicker: 'Judge moment 01',
    title: 'Closure unlocks only after governed writeback.',
    left: 'Both dispositions reviewed',
    right: 'Guarded close action',
  },
  receipt: {
    kicker: 'Judge moment 02',
    title: 'Integrity evidence that fails honestly.',
    trusted: 'Trusted digest match',
    mismatch: 'Planted mismatch detected',
    disclaimer: 'Change detection only · not a signature',
  },
  datahub: {
    kicker: 'Verifiable sponsor proof',
    title: 'Live DataHub evidence stays separate.',
    server: 'mcp-server-datahub 0.6.0',
    tool: 'get_lineage',
    result: '2 ML models + 1 process',
    mutation: 'write → readback → restore',
    source: 'license-revoked-training · PROD',
  },
  close: {
    kicker: 'Open evidence',
    title: 'Every affected model. Traced. Resolved.',
    stats: ['100 automated checks', 'Apache 2.0', 'Production on Vercel'],
    live: 'recallgraph.vercel.app',
    repo: 'github.com/ajanaku1/RecallGraph',
  },
  social: {
    eyebrow: 'RECALLGRAPH',
    question: 'A training source is revoked.',
    answer: 'Which models must be recalled?',
    proof: 'Trace · Govern · Verify',
  },
} as const;
