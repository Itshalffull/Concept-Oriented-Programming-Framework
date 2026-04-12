import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('clef-base theme bootstrap', () => {
  it('ships expressive themes in seed data and generated CSS', () => {
    const seeds = readFileSync('clef-base/seeds/Theme.seeds.yaml', 'utf-8');
    const css = readFileSync('clef-base/app/styles/themes.generated.css', 'utf-8');

    expect(seeds).toContain('theme: editorial');
    expect(seeds).toContain('theme: signal');
    expect(seeds).toContain('styleProfile":"foundation"');
    expect(seeds).toContain('styleProfile":"nocturne"');
    expect(seeds).toContain('styleProfile":"accessibility"');
    expect(css).toContain('[data-theme="editorial"]');
    expect(css).toContain('[data-theme="signal"]');
    expect(css).toContain('[data-theme="dark"]');
    expect(css).toContain('--theme-density: comfortable;');
    expect(css).toContain('--theme-density: compact;');
    expect(css).toContain('--theme-motif: sidebar;');
    expect(css).toContain('--theme-motif: topbar;');
    expect(css).toContain('--palette-primary: oklch(0.80 0.16 255);');
    expect(css).toContain('--palette-background: oklch(0.10 0.005 255);');
    expect(css).not.toContain(',;');
    expect(css).toContain('--motion-easing-default: cubic-bezier(0.2, 0, 0, 1);');
    expect(css).toContain('--elevation-level-1: 0 1px 2px 0 var(--palette-shadow);');
    expect(css).toContain('--elevation-card: var(--elevation-level-1);');
    expect(css).toContain('--radius-card: var(--radius-lg);');
    expect(css).toContain('--typography-font-family-sans: Fraunces, Georgia, serif;');
    expect(css).toContain('--typography-font-family-sans: IBM Plex Sans, system-ui, sans-serif;');
    expect(css).toContain('--radius-md: 0.875rem;');
    expect(css).toContain('--radius-md: 0.375rem;');
    expect(css).not.toContain('--radius-radius-card: lg;');
    expect(css).not.toContain('--elevation-elevation-card: level-1;');
  });
});
