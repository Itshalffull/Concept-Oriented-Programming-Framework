import React from 'react';
import { describe, expect, it } from 'vitest';
import { ThemePreviewPanel } from '../clef-base/app/components/widgets/ThemePreviewPanel';

describe('ThemePreviewPanel', () => {
  it('renders a per-theme preview island with metadata and controls', () => {
    const element = ThemePreviewPanel({
      theme: {
        theme: 'signal',
        name: 'Signal',
        overrides: JSON.stringify({
          density: 'compact',
          motif: 'topbar',
          styleProfile: 'signal',
          sourceType: 'expressive-theme',
        }),
        active: true,
      },
      onOpenDetails: () => undefined,
      onActivateToggle: () => <span>Activate control</span>,
    }) as React.ReactElement;

    expect(element.props['data-theme']).toBe('signal');
    expect(element.props['data-theme-preview-active']).toBe('true');

    const children = React.Children.toArray(element.props.children);
    expect(JSON.stringify(children)).toContain('Theme QA Surface');
    expect(JSON.stringify(children)).toContain('Activate control');
    expect(JSON.stringify(children)).toContain('topbar');
    expect(JSON.stringify(children)).toContain('compact');
  });
});
