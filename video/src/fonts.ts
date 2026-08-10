import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadSerif } from '@remotion/google-fonts/LibreBaskerville';

export const { fontFamily: BODY_FONT } = loadInter('normal', {
  subsets: ['latin'],
  weights: ['400', '500', '600', '700', '800'],
});

export const { fontFamily: DISPLAY_FONT } = loadSerif('normal', {
  subsets: ['latin'],
  weights: ['400', '700'],
});
