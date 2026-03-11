import { describe, expect, it } from 'vitest';
import {
  buildDisplayWidgetContext,
  getDisplayInteractor,
  mapWidgetToLayout,
} from '../clef-base/lib/widget-selection.js';

describe('clef-base widget selection helpers', () => {
  it('maps collection layouts to the shared collection interactor', () => {
    expect(getDisplayInteractor('table')).toBe('records-collection');
    expect(getDisplayInteractor('card-grid')).toBe('records-collection');
  });

  it('builds resolver context with theme and collection metadata', () => {
    const context = buildDisplayWidgetContext({
      viewId: 'content-list',
      layout: 'table',
      rowCount: 4,
      fieldCount: 6,
      density: 'comfortable',
      motif: 'sidebar',
      styleProfile: 'editorial',
      sourceType: 'expressive-theme',
    });

    expect(context).toMatchObject({
      density: 'comfortable',
      motif: 'sidebar',
      optionCount: 4,
      fieldCount: 6,
      viewId: 'content-list',
    });
    expect(context.tags).toEqual(
      expect.arrayContaining(['admin', 'view', 'table', 'small-collection']),
    );
  });

  it('maps resolved widget ids back to local display layouts', () => {
    expect(mapWidgetToLayout('admin-card-grid-display', 'table')).toBe('card-grid');
    expect(mapWidgetToLayout('admin-table-display', 'card-grid')).toBe('table');
    expect(mapWidgetToLayout('unknown-widget', 'graph')).toBe('graph');
  });
});
