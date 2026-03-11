import { describe, expect, it } from 'vitest';
import {
  pickActiveTheme,
  resolveThemeDocumentState,
  type ThemeRecord,
} from '../clef-base/lib/theme-selection.js';

describe('clef-base theme selection', () => {
  const themes: ThemeRecord[] = [
    { theme: 'light', name: 'Light', active: false, priority: 0, overrides: '{"mode":"light"}' },
    {
      theme: 'signal',
      name: 'Signal',
      active: true,
      priority: 10,
      overrides: '{"mode":"dark","sourceType":"expressive-theme","density":"compact","motif":"topbar","styleProfile":"signal"}',
    },
  ];

  it('keeps the highest-priority active theme as the document theme', () => {
    expect(pickActiveTheme(themes)).toBe('signal');
  });

  it('derives document attributes and css variables from expressive theme metadata', () => {
    const state = resolveThemeDocumentState(themes, { density: 'compact', motif: 'topbar' });
    expect(state).toMatchObject({
      id: 'signal',
      mode: 'dark',
      density: 'compact',
      motif: 'topbar',
      styleProfile: 'signal',
      sourceType: 'expressive-theme',
    });
    expect(state.cssVariables['--theme-density']).toBe('compact');
    expect(state.cssVariables['--theme-motif']).toBe('topbar');
  });
});
