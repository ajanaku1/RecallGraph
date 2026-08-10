import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

const root = process.cwd();
const requiredBeats = [
  'hook',
  'problem',
  'positioning',
  'product-reveal',
  'judge-moment',
  'verifiable-proof',
  'close',
];

test('video manifest binds the full story to real evidence and Edge TTS', async () => {
  const manifest = await readJson('video/MANIFEST.json');
  assert.equal(manifest.voiceProvider, 'microsoft-edge-tts');
  assert.equal(manifest.width, 1920);
  assert.equal(manifest.height, 1080);
  assert.equal(manifest.fps, 30);
  const durationSeconds = assertNumber(manifest.durationSeconds);
  const socialDurationSeconds = assertNumber(manifest.socialDurationSeconds);
  assert.ok(durationSeconds > 60 && durationSeconds < 180);
  assert.ok(socialDurationSeconds >= 10 && socialDurationSeconds <= 12);

  const scenes = assertRecordArray(manifest.scenes);
  const beats = new Set(scenes.flatMap((scene) => assertStringArray(scene.beats)));
  for (const beat of requiredBeats) assert.ok(beats.has(beat), `missing ${beat} beat`);
  assert.ok(scenes.filter((scene) => assertStringArray(scene.beats).includes('judge-moment')).length >= 2);

  for (const scene of scenes) {
    assert.equal(typeof scene.id, 'string');
    await assertNonempty(assertString(scene.audio));
    for (const evidence of assertStringArray(scene.evidence)) await assertNonempty(evidence);
  }
});

test('video documentation and caption source exist before rendering', async () => {
  const paths = [
    'video/SCRIPT.md',
    'video/STORYBOARD.md',
    'video/ASSETS.md',
    'video/DECISIONS.md',
    'video/COMPONENTS.md',
    'video/public/captions.json',
    'video/src/Root.tsx',
    'video/src/MainVideo.tsx',
    'video/src/SocialClip.tsx',
    'video/src/constants.ts',
  ];
  await Promise.all(paths.map(assertNonempty));
});

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(join(root, path), 'utf8')) as Record<string, unknown>;
}

async function assertNonempty(path: string): Promise<void> {
  const fullPath = join(root, path);
  await access(fullPath);
  assert.ok((await stat(fullPath)).size > 0, `${path} is empty`);
}

function assertRecordArray(value: unknown): Array<Record<string, unknown>> {
  assert.ok(Array.isArray(value));
  return value as Array<Record<string, unknown>>;
}

function assertStringArray(value: unknown): string[] {
  assert.ok(Array.isArray(value) && value.every((item) => typeof item === 'string'));
  return value;
}

function assertString(value: unknown): string {
  assert.equal(typeof value, 'string');
  return value as string;
}

function assertNumber(value: unknown): number {
  assert.equal(typeof value, 'number');
  return value as number;
}
