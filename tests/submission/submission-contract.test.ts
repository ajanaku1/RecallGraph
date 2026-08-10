import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { verifySubmission } from '../../scripts/submission-contract.mjs';

const manifest = {
  schemaVersion: 1,
  repositoryUrl: 'https://github.com/ajanaku1/RecallGraph',
  liveUrl: 'https://recallgraph.example.com',
  demoVideoUrl: 'https://video.example.com/recallgraph',
  feedbackSurveyUrl: 'https://survey.example.com/recallgraph',
};

test('submission verification rejects missing public evidence', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'recallgraph-submission-'));
  try {
    const issues: string[] = await verifySubmission(directory, services());

    assert.ok(issues.some((issue) => issue.includes('submission/manifest.json')));
    assert.ok(issues.some((issue) => issue.includes('README.md')));
    assert.ok(issues.some((issue) => issue.includes('video/out/demo.mp4')));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('submission verification accepts complete, reachable evidence under three minutes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'recallgraph-submission-'));
  try {
    await writeFixture(directory);
    const issues: string[] = await verifySubmission(directory, services());

    assert.deepEqual(issues, []);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('submission verification rejects an overlong demo and private repository', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'recallgraph-submission-'));
  try {
    await writeFixture(directory);
    const issues: string[] = await verifySubmission(
      directory,
      services({ duration: 181, privateRepo: true }),
    );

    assert.ok(issues.some((issue) => issue.includes('under 180 seconds')));
    assert.ok(issues.some((issue) => issue.includes('public')));
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

function services(options: { duration?: number; privateRepo?: boolean } = {}) {
  return {
    probeVideoDuration: async () => options.duration ?? 120,
    fetch: async (input: string | URL | Request) => {
      const url = String(input);
      if (url.startsWith('https://api.github.com/repos/')) {
        return Response.json({
          private: options.privateRepo ?? false,
          description: 'Deterministic model recall closure evidence.',
          homepage: manifest.liveUrl,
          license: { spdx_id: 'Apache-2.0' },
        });
      }
      return new Response('ok', { status: 200 });
    },
  };
}

async function writeFixture(directory: string): Promise<void> {
  const paths = ['submission', 'docs/images', 'video/out'];
  await Promise.all(paths.map((path) => mkdir(join(directory, path), { recursive: true })));
  await Promise.all([
    writeFile(join(directory, 'submission/manifest.json'), JSON.stringify(manifest)),
    writeFile(join(directory, 'README.md'), readme()),
    writeFile(join(directory, 'LICENSE'), 'Apache License\nVersion 2.0, January 2004'),
    writeFile(join(directory, 'submission/DEVPOST.md'), '# RecallGraph\nEvery affected model. Traced. Resolved.'),
    writeFile(join(directory, 'submission/LIMITATIONS.md'), '# Limitations\nFixture mode is not live evidence.'),
    writeFile(join(directory, 'video/out/demo.mp4'), 'video'),
    ...['landing.png', 'closure-ready.png', 'guarded-close.png', 'verified-receipt.png']
      .map((name) => writeFile(join(directory, 'docs/images', name), 'image')),
  ]);
}

function readme(): string {
  return [
    '# RecallGraph',
    manifest.repositoryUrl,
    '## Live Demo',
    manifest.liveUrl,
    '## Demo Video',
    manifest.demoVideoUrl,
    manifest.feedbackSurveyUrl,
    '## Running Locally',
    '## Limitations',
    '## License',
    'Apache-2.0',
  ].join('\n');
}
