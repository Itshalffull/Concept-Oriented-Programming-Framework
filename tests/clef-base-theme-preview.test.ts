import { describe, expect, it } from 'vitest';
import { getThemePreviewMeta } from '../clef-base/app/components/widgets/ThemePreviewPanel';

describe('theme preview metadata', () => {
  it('extracts expressive metadata and override count from theme overrides', () => {
    expect(getThemePreviewMeta({
      theme: 'editorial',
      overrides: JSON.stringify({
        mode: 'light',
        density: 'comfortable',
        motif: 'sidebar',
        styleProfile: 'editorial',
        sourceType: 'expressive-theme',
      }),
    })).toEqual({
      mode: 'light',
      density: 'comfortable',
      motif: 'sidebar',
      styleProfile: 'editorial',
      sourceType: 'expressive-theme',
      overrideCount: 5,
    });
  });

  it('falls back safely when overrides are missing or malformed', () => {
    expect(getThemePreviewMeta({ theme: 'light', overrides: 'not-json' })).toEqual({
      mode: null,
      density: null,
      motif: null,
      styleProfile: null,
      sourceType: null,
      overrideCount: 0,
    });
  });
});
