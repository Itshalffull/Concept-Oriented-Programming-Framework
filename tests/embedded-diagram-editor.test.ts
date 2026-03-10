import { describe, expect, it } from 'vitest';

import {
  createEmbeddedDiagramSlashCommands,
  mapEmbedTypeToCanvasNodeType,
} from '../generated/nextjs/widgets/embedded-diagram-editor/EmbeddedDiagramEditor.tsx';

describe('EmbeddedDiagramEditor helpers', () => {
  it('maps embed types onto Canvas node types', () => {
    expect(
      mapEmbedTypeToCanvasNodeType({
        id: 'frame-1',
        title: 'Frame',
        embedType: 'frame',
        position: { x: 0, y: 0 },
      }),
    ).toBe('frame');

    expect(
      mapEmbedTypeToCanvasNodeType({
        id: 'shape-1',
        title: 'Decision',
        embedType: 'shape',
        shapeKind: 'diamond',
        position: { x: 0, y: 0 },
      }),
    ).toBe('diamond');

    expect(
      mapEmbedTypeToCanvasNodeType({
        id: 'entity-1',
        title: 'SpecParser',
        embedType: 'entity',
        position: { x: 0, y: 0 },
      }),
    ).toBe('rectangle');
  });

  it('exposes slash commands for embedded canvas authoring', () => {
    const commands = createEmbeddedDiagramSlashCommands();

    expect(commands).toEqual([
      expect.objectContaining({ id: 'embedded-canvas', group: 'Canvas' }),
      expect.objectContaining({ id: 'shape', group: 'Canvas' }),
      expect.objectContaining({ id: 'frame', group: 'Canvas' }),
    ]);
  });
});
