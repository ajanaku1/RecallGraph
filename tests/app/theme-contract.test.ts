import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';

async function projectFile(path: string): Promise<string> {
  return readFile(path, 'utf8');
}

function relativeLuminance(hex: string): number {
  const channels = hex.slice(1).match(/.{2}/g)?.map((value) => Number.parseInt(value, 16) / 255);
  if (!channels || channels.length !== 3) throw new Error(`Invalid hex colour: ${hex}`);
  const [red, green, blue] = channels.map((value) => (
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  ));
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

function escapePattern(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function expectRule(css: string, selector: string, declarations: string[]): void {
  const declarationPattern = declarations.map(escapePattern).join('[^}]*');
  expect(css).toMatch(new RegExp(`${escapePattern(selector)}\\s*\\{[^}]*${declarationPattern}`, 's'));
}

describe('Daylight Forensics theme contract', () => {
  it('establishes the light evidence palette and one dark closure docket', async () => {
    const css = await projectFile('src/app/recall.css');

    expectRule(css, ':root', [
      '--paper-canvas: #F2EFE7;',
      '--surface-evidence: #FCFBF7;',
      '--ink-carbon: #18201E;',
      '--text-registry: #63706B;',
      '--state-selection: #1F5B63;',
      '--state-risk: #D94A2F;',
      '--surface-docket: #151B1A;',
      '--radius-control: 4px;',
      '--radius-panel: 8px;',
    ]);
    expect(css).toContain('background: var(--surface-canvas);');
    expect(css).toContain('.decision-rail');
    expect(css).toContain('background: var(--surface-docket);');
    expect(css).toContain('border: 2px solid var(--state-selection);');
    expect(css).toMatch(/box-shadow:\s*inset 0 0 0 1px var\(--surface-evidence\)/);
    expect(css).toContain('.decision-rail > .primary-action');
    expect(css).toContain('border-left: 3px solid var(--state-risk);');
    expectRule(css, '.decision-rail > .primary-action:disabled', [
      'background: transparent;',
      'color: var(--text-on-docket-muted);',
      'opacity: 1;',
      'border-left: 3px solid var(--state-risk);',
    ]);
    expectRule(css, '.confirmation button:not(.quiet)', [
      'padding: var(--space-3) var(--space-4);',
      'margin-right: var(--space-2);',
      'border-color: var(--state-selection);',
      'background: var(--state-selection);',
      'color: var(--text-on-docket);',
    ]);
    expectRule(css, '.confirmation .quiet', [
      'padding: var(--space-3) var(--space-4);',
      'color: var(--text-on-docket-muted) !important;',
    ]);
    expectRule(css, '.receipt-workspace .quiet', [
      'padding: var(--space-3) var(--space-4);',
      'margin-left: var(--space-2);',
      'color: var(--state-selection) !important;',
    ]);
    expectRule(css, '.receipt-workspace button:disabled', [
      'background: var(--surface-evidence) !important;',
      'color: var(--text-primary) !important;',
      'opacity: 1;',
    ]);
    expect(css).toMatch(
      /\.decision-rail button:focus-visible,\s*\.confirmation button:focus-visible\s*\{[^}]*outline-color: var\(--text-on-docket\);/s,
    );
    expect(css).toMatch(
      /\.node\s*\{[^}]*transition:\s*transform var\(--duration-fast\) var\(--ease-out\);/s,
    );
    expect(css).not.toMatch(/transition(?:-property)?[^;{]*(?:border-color|background-color)/);
    expectRule(css, '.node.selected small', [
      'color: var(--state-selection);',
    ]);
    expectRule(css, '.journey-status .recovery-link', [
      'min-height: 44px;',
    ]);
    expect(css).toContain('-webkit-font-smoothing: antialiased;');
    expect(css).not.toMatch(/(?:background|color|border(?:-color)?|outline):\s*#[0-9a-f]{3,8}/i);
    expect(css).not.toMatch(/dark-only/i);
  });

  it('keeps normal text and focus pairings above contrast thresholds', () => {
    expect(contrast('#18201E', '#FCFBF7')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#63706B', '#FCFBF7')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#FCFBF7', '#151B1A')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#1F5B63', '#FCFBF7')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#18201E', '#F2EFE7')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#1F5B63', '#F2EFE7')).toBeGreaterThanOrEqual(3);
    expect(contrast('#63706B', '#E3EFED')).toBeLessThan(4.5);
    expect(contrast('#1F5B63', '#E3EFED')).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#FCFBF7', '#151B1A')).toBeGreaterThanOrEqual(3);
    expect(contrast('#1F5B63', '#151B1A')).toBeLessThan(3);
    expect(contrast('#D94A2F', '#FCFBF7')).toBeLessThan(4.5);
  });
});
