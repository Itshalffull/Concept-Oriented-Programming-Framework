import { describe, expect, it, vi } from 'vitest';

import { buildCli } from '../cli/src/index.ts';

describe('CLI compatibility entrypoint', () => {
  it('validates a concept through the restored check command', async () => {
    const program = buildCli();
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await program.parseAsync([
      'node',
      'clef',
      'check',
      'repertoire/concepts/query-retrieval/content-embedding.concept',
    ]);

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('content-embedding.concept -> ContentEmbedding'),
    );

    log.mockRestore();
  });

  it('validates a sync through the restored sync-parser command', async () => {
    const program = buildCli();
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    await program.parseAsync([
      'node',
      'clef',
      'sync-parser',
      'parse',
      '--source',
      'repertoire/concepts/query-retrieval/syncs/content-node-update-indexes-content-embedding.sync',
    ]);

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('ContentNodeUpdateIndexesContentEmbedding'),
    );

    log.mockRestore();
  });
});
