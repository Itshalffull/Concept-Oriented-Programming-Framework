import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { afterEach, describe, expect, it } from 'vitest';
import { createInMemoryStorage } from '../../runtime/adapters/storage.js';
import { seedDataHandler } from '../../handlers/ts/seed-data.handler.js';

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    rmSync(String(tempDirs.pop()), { recursive: true, force: true });
  }
});

describe('seedDataHandler', () => {
  it('discovers seed files and reports registered status', async () => {
    const storage = createInMemoryStorage();
    const dir = mkdtempSync(join(tmpdir(), 'clef-seeds-'));
    tempDirs.push(dir);
    mkdirSync(join(dir, 'nested'));
    writeFileSync(join(dir, 'nested', 'Theme.seeds.yaml'), [
      'concept: Theme',
      'action: create',
      'entries:',
      '  - theme: light',
      '    name: Light',
      '    overrides: \'{"mode":"light"}\'',
    ].join('\n'));

    const discovered = await seedDataHandler.discover({ base_path: dir }, storage);
    expect(discovered.variant).toBe('ok');
    expect(discovered.found).toHaveLength(1);

    const status = await seedDataHandler.status({}, storage);
    expect(status).toMatchObject({
      variant: 'ok',
    });
    expect(status.seeds).toEqual([
      expect.objectContaining({
        concept_uri: 'urn:clef/Theme',
        entry_count: 1,
        applied: false,
      }),
    ]);
  });

  it('marks all registered seeds applied without relying on storage.list', async () => {
    const storage = createInMemoryStorage();
    await seedDataHandler.register({
      source_path: '/tmp/Schema.seeds.yaml',
      concept_uri: 'urn:clef/Schema',
      action_name: 'defineSchema',
      entries: [
        JSON.stringify({ schema: 'Article', fields: 'title,body' }),
        JSON.stringify({ schema: 'Page', fields: 'title,slug' }),
      ],
    }, storage);

    const applied = await seedDataHandler.applyAll({}, storage);
    expect(applied).toMatchObject({
      variant: 'ok',
      applied_count: 2,
      skipped_count: 0,
      error_count: 0,
    });

    const status = await seedDataHandler.status({}, storage);
    expect(status.seeds).toEqual([
      expect.objectContaining({
        applied: true,
        entry_count: 2,
      }),
    ]);
  });
});
