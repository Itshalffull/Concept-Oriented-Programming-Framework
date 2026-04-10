import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

const ROOT = path.resolve(__dirname, '..');

describe('Namespace concept updates (MAG-578)', () => {
  const p = path.join(ROOT, 'repertoire/concepts/classification/namespace.concept');
  it('has resolve action', () => { expect(fs.readFileSync(p,'utf-8')).toContain('action resolve'); });
  it('has register action', () => { expect(fs.readFileSync(p,'utf-8')).toContain('action register'); });
  it('has provider state', () => { expect(fs.readFileSync(p,'utf-8')).toContain('provider: N -> String'); });
  it('root namespace sync exists', () => { expect(fs.existsSync(path.join(ROOT, 'repertoire/concepts/classification/syncs/kernel-registers-root-namespace.sync'))).toBe(true); });
});

describe('ContentStorage namespace (MAG-579)', () => {
  const p = path.join(ROOT, 'repertoire/concepts/foundation/content-storage.concept');
  it('save has namespace', () => { expect(fs.readFileSync(p,'utf-8')).toMatch(/action save.*namespace.*option String/); });
  it('load has namespace', () => { expect(fs.readFileSync(p,'utf-8')).toMatch(/action load.*namespace.*option String/); });
  it('query has namespace', () => { expect(fs.readFileSync(p,'utf-8')).toMatch(/action query.*namespace.*option String/); });
});

describe('Tenant provider (MAG-580)', () => {
  it('tenant-registers-namespace sync', () => { expect(fs.existsSync(path.join(ROOT, 'clef-base/suites/entity-lifecycle/syncs/tenant-registers-namespace.sync'))).toBe(true); });
  it('tenant-scoping-on-save sync', () => { expect(fs.existsSync(path.join(ROOT, 'clef-base/suites/entity-lifecycle/syncs/tenant-scoping-on-save.sync'))).toBe(true); });
});

describe('SearchIndex namespace (MAG-581)', () => {
  const p = path.join(ROOT, 'repertoire/concepts/query-retrieval/search-index.concept');
  it('indexItem has namespace', () => { expect(fs.readFileSync(p,'utf-8')).toMatch(/action indexItem.*namespace.*option String/); });
  it('search has namespace', () => { expect(fs.readFileSync(p,'utf-8')).toMatch(/action search.*namespace.*option String/); });
});

describe('Alias scope (MAG-582)', () => {
  it('resolve has scope', () => { expect(fs.readFileSync(path.join(ROOT,'repertoire/concepts/linking/alias.concept'),'utf-8')).toMatch(/action resolve.*scope.*option String/); });
});

describe('SyncedContent namespace (MAG-583)', () => {
  it('createReference has sourceNamespace', () => { expect(fs.readFileSync(path.join(ROOT,'repertoire/concepts/content/synced-content.concept'),'utf-8')).toMatch(/action createReference.*sourceNamespace.*option String/); });
});

describe('EventBus namespace (MAG-584)', () => {
  const p = path.join(ROOT, 'repertoire/concepts/infrastructure/event-bus.concept');
  it('dispatch has namespace', () => { expect(fs.readFileSync(p,'utf-8')).toMatch(/action dispatch.*namespace.*option String/); });
  it('subscribe has namespace', () => { expect(fs.readFileSync(p,'utf-8')).toMatch(/action subscribe.*namespace.*option String/); });
});

describe('Cache namespace sync (MAG-585)', () => {
  it('sync exists', () => { expect(fs.existsSync(path.join(ROOT, 'clef-base/suites/entity-lifecycle/syncs/cache-namespace-prefix.sync'))).toBe(true); });
});

describe('Bind namespaceStrategy (MAG-586)', () => {
  it('design note exists', () => { expect(fs.existsSync(path.join(ROOT, 'docs/plans/bind-namespace-strategy.md'))).toBe(true); });
});

describe('Pilot namespace (MAG-587)', () => {
  it('navigate has namespace', () => { expect(fs.readFileSync(path.join(ROOT,'specs/surface/pilot.derived'),'utf-8')).toMatch(/action navigate.*namespace.*option String/); });
});
