import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('clef-base theme bootstrap', () => {
  it('ships expressive themes in seed data and generated CSS', () => {
    const seeds = readFileSync('clef-base/seeds/Theme.seeds.yaml', 'utf-8');
    const css = readFileSync('clef-base/app/styles/themes.generated.css', 'utf-8');

    expect(seeds).toContain('theme: editorial');
    expect(seeds).toContain('theme: signal');
    expect(css).toContain('[data-theme="editorial"]');
    expect(css).toContain('[data-theme="signal"]');
    expect(css).not.toContain(',;');
    expect(css).toContain('--motion-easing-default: cubic-bezier(0.2, 0, 0, 1);');
    expect(css).toContain('--elevation-level-1: 0 1px 2px 0 var(--palette-shadow);');
    expect(css).toContain('--elevation-card: var(--elevation-level-1);');
    expect(css).toContain('--radius-card: var(--radius-lg);');
    expect(css).not.toContain('--radius-radius-card: lg;');
    expect(css).not.toContain('--elevation-elevation-card: level-1;');
  });
});
