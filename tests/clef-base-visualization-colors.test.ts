import { describe, expect, it } from 'vitest';
import {
  getLabelVisualizationColorToken,
  getTypeVisualizationColorToken,
} from '../clef-base/lib/visualization-colors';

describe('clef-base visualization color contract', () => {
  it('maps arbitrary schema labels to stable visualization slots', () => {
    const first = getLabelVisualizationColorToken('schemas-list');
    const second = getLabelVisualizationColorToken('schemas-list');

    expect(first).toBe(second);
    expect(first).toMatch(/^var\(--visualization-slot-[1-8]\)$/);
  });

  it('maps graph node categories to theme-driven visualization tokens', () => {
    expect(getTypeVisualizationColorToken('Sync')).toBe('var(--visualization-sync)');
    expect(getTypeVisualizationColorToken('Concept')).toBe('var(--visualization-concept)');
    expect(getTypeVisualizationColorToken('Unknown')).toMatch(/^var\(--visualization-slot-[1-8]\)$/);
  });

  it('maps canvas node categories to the same visualization contract', () => {
    expect(getTypeVisualizationColorToken('sync')).toBe('var(--visualization-sync)');
    expect(getTypeVisualizationColorToken('concept')).toBe('var(--visualization-concept)');
    expect(getTypeVisualizationColorToken('custom-type')).toMatch(/^var\(--visualization-slot-[1-8]\)$/);
  });
});
