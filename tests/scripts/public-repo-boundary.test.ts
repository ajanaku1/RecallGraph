import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const privatePaths = [
  'brand/',
  'video/',
  'tests/video/',
  'Goal.md',
  'design.md',
  'prompt.md',
  'plan.md',
  'ai/',
  '.evidence/phase-6-tdd.md',
];

test('private project material is ignored', async () => {
  const ignored = await Promise.all(privatePaths.map(isIgnored));
  const exposed = privatePaths.filter((_, index) => !ignored[index]);

  assert.deepEqual(exposed, []);
});

test('private project material contains no tracked files', async () => {
  const { stdout } = await execFileAsync('git', ['ls-files', '--', ...privatePaths]);

  assert.equal(stdout.trim(), '');
});

test('public test suite does not depend on private video source', async () => {
  const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as {
    scripts: Record<string, string>;
  };

  assert.equal(packageJson.scripts['test:video'], undefined);
  assert.doesNotMatch(packageJson.scripts.test, /test:video/);
});

async function isIgnored(path: string): Promise<boolean> {
  try {
    await execFileAsync('git', ['check-ignore', '--no-index', '--quiet', path]);
    return true;
  } catch {
    return false;
  }
}
