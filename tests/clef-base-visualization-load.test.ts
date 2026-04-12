import { describe, expect, it, vi } from 'vitest';

vi.mock('@clef/surface/domain/Canvas', () => ({
  Canvas: () => null,
}));

vi.mock('@clef/surface/domain/GraphAnalysisPanel', () => ({
  GraphAnalysisPanel: () => null,
}));

vi.mock('../clef-base/lib/clef-provider', () => ({
  useKernelInvoke: () => vi.fn(),
}));

import GraphDisplay from '../clef-base/app/components/widgets/GraphDisplay';
import CanvasDisplay from '../clef-base/app/components/widgets/CanvasDisplay';

describe('clef-base visualization surfaces load', () => {
  it('loads graph and canvas display modules with the visualization contract', () => {
    expect(GraphDisplay).toBeTypeOf('function');
    expect(CanvasDisplay).toBeTypeOf('function');
  });
});
