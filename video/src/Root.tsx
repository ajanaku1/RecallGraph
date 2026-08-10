import { Composition, registerRoot } from 'remotion';
import { FPS, H, SOCIAL_DURATION, TOTAL_FRAMES, W } from './constants';
import { MainVideo } from './MainVideo';
import { SocialClip } from './SocialClip';

export function RemotionRoot(): React.JSX.Element {
  return (
    <>
      <Composition id="Main" component={MainVideo} durationInFrames={TOTAL_FRAMES} fps={FPS} width={W} height={H} />
      <Composition id="Social" component={SocialClip} durationInFrames={SOCIAL_DURATION} fps={FPS} width={1080} height={1920} />
    </>
  );
}

registerRoot(RemotionRoot);
