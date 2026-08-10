import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

describe('application scripts', () => {
  it('exposes local dev and production start commands', async () => {
    const packageJson = JSON.parse(await readFile('package.json', 'utf8')) as { scripts: Record<string, string> };
    expect(packageJson.scripts.dev).toBe('next dev');
    expect(packageJson.scripts.start).toBe('next start');
  });
});
