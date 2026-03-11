import { describe, expect, it } from 'vitest';

import {
  createDefaultSlashCommands,
  createDefaultRelatedViews,
  mapSlashCommandsToBlockTypes,
} from '../generated/nextjs/widgets/triple-zone-layout/TripleZoneLayout.tsx';

describe('TripleZoneLayout helpers', () => {
  it('builds the default related zone as stacked standard views', () => {
    const views = createDefaultRelatedViews();

    expect(views.map((view) => view.id)).toEqual([
      'similar',
      'links-backlinks',
      'unlinked',
      'nearby',
    ]);
    expect(views[0]).toMatchObject({
      kind: 'similar',
      embeddingBacked: true,
      viewType: 'card-grid',
      dataSource: '{"concept":"ContentEmbedding","action":"searchSimilar"}',
    });
    expect(views[1]).toMatchObject({
      kind: 'links',
      viewType: 'list',
    });
    expect(views[2]).toMatchObject({
      kind: 'unlinked',
      viewType: 'list',
    });
    expect(views[3]).toMatchObject({
      kind: 'nearby',
      viewType: 'graph',
    });
  });

  it('maps slash commands into grouped slash menu block types', () => {
    const blockTypes = mapSlashCommandsToBlockTypes([
      {
        id: 'embedded-view',
        label: 'Embedded View',
        description: 'Insert a live View.',
        icon: '▦',
        group: 'Views',
      },
      {
        id: 'link',
        label: 'Link to Entity',
        description: 'Create a wiki link.',
        icon: '↗',
        group: 'References',
      },
    ]);

    expect(blockTypes).toEqual([
      {
        label: 'Embedded View',
        description: 'Insert a live View.',
        icon: '▦',
        group: 'Views',
      },
      {
        label: 'Link to Entity',
        description: 'Create a wiki link.',
        icon: '↗',
        group: 'References',
      },
    ]);
  });

  it('includes canvas embeds in the default slash command set', () => {
    const commands = createDefaultSlashCommands();

    expect(commands.map((command) => command.id)).toContain('embedded-canvas');
    expect(commands.map((command) => command.id)).toContain('shape');
    expect(commands.map((command) => command.id)).toContain('frame');
  });
});
