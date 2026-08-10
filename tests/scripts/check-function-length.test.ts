import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

test('function checker reports an overlong function without success output', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'recallgraph-checker-'));
  try {
    await writeFile(join(directory, 'overlong.ts'), overlongFunction(), 'utf8');
    const result = spawnSync(process.execPath, [
      'scripts/check-function-length.mjs', directory,
    ], { cwd: process.cwd(), encoding: 'utf8' });

    assert.equal(result.status, 1);
    assert.match(result.stderr, /overlong\.ts:overlong:1:31/);
    assert.doesNotMatch(result.stdout, /all functions are 30 lines or fewer/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

function overlongFunction(): string {
  const lines = Array.from({ length: 31 }, (_, index) => `  const line${index} = ${index};`);
  return ['export function overlong(): void {', ...lines, '}'].join('\n');
}
