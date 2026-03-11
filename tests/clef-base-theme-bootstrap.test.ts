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
  });
});
