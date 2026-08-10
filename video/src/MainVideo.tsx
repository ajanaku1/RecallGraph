import type { ComponentType, ReactNode } from 'react';
import { AbsoluteFill } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { AUDIO_DURATIONS, AUDIO_FILES, COLORS, CROSSFADE, SCENE_DURATIONS } from './constants';
import { SceneAudio } from './components/SceneAudio';
import { CloseScene } from './scenes/CloseScene';
import { DataHubScene } from './scenes/DataHubScene';
import { GovernScene } from './scenes/GovernScene';
import { HookScene } from './scenes/HookScene';
import { ImpactScene } from './scenes/ImpactScene';
import { ProblemScene } from './scenes/ProblemScene';
import { ReceiptScene } from './scenes/ReceiptScene';

const scenes = [
  scene('hook', HookScene),
  scene('problem', ProblemScene),
  scene('impact', ImpactScene),
  scene('govern', GovernScene),
  scene('receipt', ReceiptScene),
  scene('datahub', DataHubScene),
  scene('close', CloseScene),
] as const;

export function MainVideo(): React.JSX.Element {
  return (
    <AbsoluteFill style={{ background: COLORS.paper }}>
      <TransitionSeries>{timeline()}</TransitionSeries>
    </AbsoluteFill>
  );
}

function timeline(): ReactNode[] {
  return scenes.flatMap((item, index) => {
    const elements: ReactNode[] = [
      <TransitionSeries.Sequence key={item.key} durationInFrames={item.duration} premountFor={30}>
        <item.Component />
        <SceneAudio src={item.audio} audioDuration={item.audioDuration} />
      </TransitionSeries.Sequence>,
    ];
    if (index < scenes.length - 1) elements.push(transition(item.key));
    return elements;
  });
}

function transition(key: string): ReactNode {
  return (
    <TransitionSeries.Transition
      key={`${key}-transition`}
      presentation={fade()}
      timing={linearTiming({ durationInFrames: CROSSFADE })}
    />
  );
}

function scene<Key extends keyof typeof SCENE_DURATIONS>(key: Key, Component: ComponentType): {
  key: Key;
  Component: ComponentType;
  duration: number;
  audio: string;
  audioDuration: number;
} {
  return { key, Component, duration: SCENE_DURATIONS[key], audio: AUDIO_FILES[key], audioDuration: AUDIO_DURATIONS[key] };
}
