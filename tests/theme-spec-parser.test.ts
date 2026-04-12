import { describe, expect, it } from 'vitest';
import { parseThemeFile } from '../handlers/ts/framework/theme-spec-parser.js';

describe('parseThemeFile', () => {
  it('parses inline object values without leaking layout commas into token values', () => {
    const manifest = parseThemeFile(`
      theme sample {
        typography {
          heading-sm: { size: 1.25rem, lineHeight: 1.4, weight: 600, family: font-family-sans }
        }

        motion {
          easing-default: cubic-bezier(0.2, 0, 0, 1)
        }

        elevation {
          level-2: 0 2px 4px -1px shadow, 0 1px 2px -1px shadow
        }
      }
    `);

    expect(manifest.typography['heading-sm.size']).toBe('1.25rem');
    expect(manifest.typography['heading-sm.lineHeight']).toBe('1.4');
    expect(manifest.typography['heading-sm.weight']).toBe('600');
    expect(manifest.typography['heading-sm.family']).toBe('font-family-sans');
    expect(manifest.motion['easing-default']).toBe('cubic-bezier(0.2, 0, 0, 1)');
    expect(manifest.elevation['level-2']).toBe('0 2px 4px -1px shadow, 0 1px 2px -1px shadow');
  });
});
