/**
 * Namespace-unified versioning integration tests.
 * Verifies artifact completeness across MAG-570 through MAG-577:
 * syncs, widgets, views, seeds, and qualified ref parser.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');

function fileExists(relativePath: string): boolean {
  return fs.existsSync(path.join(ROOT, relativePath));
}

function readFile(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf-8');
}

// ---------------------------------------------------------------------------
// Qualified ref parser (MAG-571) — verify import works
// ---------------------------------------------------------------------------

describe('Qualified ref parser import', () => {
  it('exports parseQualifiedRef function', async () => {
    const mod = await import(
      '../handlers/ts/framework/qualified-ref-parser'
    );
    expect(typeof mod.parseQualifiedRef).toBe('function');
  });

  it('exports classifyQualifier function', async () => {
    const mod = await import(
      '../handlers/ts/framework/qualified-ref-parser'
    );
    expect(typeof mod.classifyQualifier).toBe('function');
  });

  it('parses a basic qualified ref', async () => {
    const { parseQualifiedRef } = await import(
      '../handlers/ts/framework/qualified-ref-parser'
    );
    const result = parseQualifiedRef('draft-v2://article-1@v3');
    expect(result.namespace).toBe('draft-v2');
    expect(result.target).toBe('article-1');
    expect(result.qualifier).toBe('v3');
    expect(result.qualifierKind).toBe('version');
  });
});

// ---------------------------------------------------------------------------
// Artifact completeness — VersionSpace -> Namespace syncs (MAG-570)
// ---------------------------------------------------------------------------

describe('VersionSpace -> Namespace syncs (MAG-570)', () => {
  const MULTIVERSE_SYNCS = 'repertoire/concepts/multiverse/syncs';

  it('version-space-registers-namespace.sync exists', () => {
    expect(fileExists(`${MULTIVERSE_SYNCS}/required/version-space-registers-namespace.sync`)).toBe(true);
  });

  it('version-space-archives-namespace.sync exists', () => {
    expect(fileExists(`${MULTIVERSE_SYNCS}/recommended/version-space-archives-namespace.sync`)).toBe(true);
  });

  it('version-space-merge-cleans-namespace.sync exists', () => {
    expect(fileExists(`${MULTIVERSE_SYNCS}/recommended/version-space-merge-cleans-namespace.sync`)).toBe(true);
  });

  it('registers sync references Namespace/createNamespacedPage or Namespace/register', () => {
    const content = readFile(`${MULTIVERSE_SYNCS}/required/version-space-registers-namespace.sync`);
    expect(content).toMatch(/Namespace/);
  });

  it('archives sync references Namespace', () => {
    const content = readFile(`${MULTIVERSE_SYNCS}/recommended/version-space-archives-namespace.sync`);
    expect(content).toMatch(/Namespace/);
  });

  it('merge-cleans sync references Namespace', () => {
    const content = readFile(`${MULTIVERSE_SYNCS}/recommended/version-space-merge-cleans-namespace.sync`);
    expect(content).toMatch(/Namespace/);
  });
});

// ---------------------------------------------------------------------------
// Dependent concept syncs (MAG-573)
// ---------------------------------------------------------------------------

describe('Dependent concept syncs — namespace/qualifier awareness (MAG-573)', () => {
  const LIFECYCLE_SYNCS = 'clef-base/suites/entity-lifecycle/syncs';

  const EXPECTED_SYNCS = [
    'backlink-reindex-with-namespace.sync',
    'search-index-with-namespace.sync',
    'alias-resolves-in-namespace.sync',
    'snippet-resolves-qualified.sync',
    'synced-content-resolves-qualified.sync',
  ];

  for (const syncFile of EXPECTED_SYNCS) {
    it(`${syncFile} exists`, () => {
      expect(fileExists(`${LIFECYCLE_SYNCS}/${syncFile}`)).toBe(true);
    });
  }

  it('backlink sync references namespace metadata', () => {
    const content = readFile(`${LIFECYCLE_SYNCS}/backlink-reindex-with-namespace.sync`);
    expect(content).toMatch(/namespace|Namespace/);
  });

  it('search sync references namespace metadata', () => {
    const content = readFile(`${LIFECYCLE_SYNCS}/search-index-with-namespace.sync`);
    expect(content).toMatch(/namespace|Namespace/);
  });
});

// ---------------------------------------------------------------------------
// Revision resolution syncs (MAG-572)
// ---------------------------------------------------------------------------

describe('Revision resolution syncs (MAG-572)', () => {
  const VERSIONING_SYNCS = 'repertoire/concepts/versioning/syncs/required';

  const EXPECTED_SYNCS = [
    'content-hash-dag-history.sync',
    'merge-dag-history.sync',
    'patch-diff.sync',
    'ref-branch.sync',
    'temporal-version-content-hash.sync',
  ];

  for (const syncFile of EXPECTED_SYNCS) {
    it(`${syncFile} exists`, () => {
      expect(fileExists(`${VERSIONING_SYNCS}/${syncFile}`)).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// Retention pin sync
// ---------------------------------------------------------------------------

describe('Retention pin sync', () => {
  it('retention-checks-revision-references.sync exists', () => {
    expect(
      fileExists('repertoire/concepts/versioning/syncs/recommended/retention-checks-revision-references.sync')
    ).toBe(true);
  });

  it('references RetentionPolicy or retention', () => {
    const content = readFile(
      'repertoire/concepts/versioning/syncs/recommended/retention-checks-revision-references.sync'
    );
    expect(content).toMatch(/RetentionPolicy|retention/i);
  });
});

// ---------------------------------------------------------------------------
// Widgets (MAG-575 + MAG-576)
// ---------------------------------------------------------------------------

describe('Versioning widgets', () => {
  const WIDGETS_DIR = 'surface/widgets';

  const EXPECTED_WIDGETS = [
    'branch-indicator.widget',
    'historical-mode-banner.widget',
    'version-timeline.widget',
    'diff-view.widget',
    'branch-diff-dashboard.widget',
    'reference-picker.widget',
  ];

  for (const widget of EXPECTED_WIDGETS) {
    it(`${widget} exists`, () => {
      expect(fileExists(`${WIDGETS_DIR}/${widget}`)).toBe(true);
    });
  }

  it('has exactly 6 versioning widgets', () => {
    const found = EXPECTED_WIDGETS.filter(w =>
      fileExists(`${WIDGETS_DIR}/${w}`)
    );
    expect(found).toHaveLength(6);
  });
});

// ---------------------------------------------------------------------------
// Views (MAG-577)
// ---------------------------------------------------------------------------

describe('Versioning views', () => {
  const VIEWS_DIR = 'specs/view/views';

  it('branch-compare.view exists', () => {
    expect(fileExists(`${VIEWS_DIR}/branch-compare.view`)).toBe(true);
  });

  it('entity-history.view exists', () => {
    expect(fileExists(`${VIEWS_DIR}/entity-history.view`)).toBe(true);
  });

  it('version-spaces-list.view exists', () => {
    expect(fileExists(`${VIEWS_DIR}/version-spaces-list.view`)).toBe(true);
  });

  it('branch-compare.view declares projection and interaction features', () => {
    const content = readFile(`${VIEWS_DIR}/branch-compare.view`);
    expect(content).toContain('projection');
    expect(content).toContain('interaction');
  });

  it('branch-compare.view is read-only', () => {
    const content = readFile(`${VIEWS_DIR}/branch-compare.view`);
    expect(content).toContain('purity = "read-only"');
  });

  it('entity-history.view declares sort and projection features', () => {
    const content = readFile(`${VIEWS_DIR}/entity-history.view`);
    expect(content).toContain('sort');
    expect(content).toContain('projection');
  });

  it('entity-history.view is read-only', () => {
    const content = readFile(`${VIEWS_DIR}/entity-history.view`);
    expect(content).toContain('purity = "read-only"');
  });

  it('entity-history.view uses timeline display type', () => {
    const content = readFile(`${VIEWS_DIR}/entity-history.view`);
    expect(content).toContain('"timeline"');
  });
});

// ---------------------------------------------------------------------------
// Destination seeds (MAG-577)
// ---------------------------------------------------------------------------

describe('Versioning destination seeds', () => {
  it('DestinationCatalog.versioning.seeds.yaml exists', () => {
    expect(
      fileExists('clef-base/seeds/DestinationCatalog.versioning.seeds.yaml')
    ).toBe(true);
  });

  it('registers version-spaces destination', () => {
    const content = readFile(
      'clef-base/seeds/DestinationCatalog.versioning.seeds.yaml'
    );
    expect(content).toContain('destination: version-spaces');
    expect(content).toContain('targetView: version-spaces-list');
  });

  it('version-spaces destination points to /admin/branches', () => {
    const content = readFile(
      'clef-base/seeds/DestinationCatalog.versioning.seeds.yaml'
    );
    expect(content).toContain('href: /admin/branches');
  });
});

// ---------------------------------------------------------------------------
// ViewShell + child spec seeds for versioning views
// ---------------------------------------------------------------------------

describe('ViewShell seeds include versioning views', () => {
  it('version-spaces-list shell exists in ViewShell.seeds.yaml', () => {
    const content = readFile('clef-base/seeds/ViewShell.seeds.yaml');
    expect(content).toContain('name: version-spaces-list');
  });

  it('version-spaces data source exists in DataSourceSpec.seeds.yaml', () => {
    const content = readFile('clef-base/seeds/DataSourceSpec.seeds.yaml');
    expect(content).toContain('content-node-list-version-space-source');
  });

  it('version-spaces projection exists in ProjectionSpec.seeds.yaml', () => {
    const content = readFile('clef-base/seeds/ProjectionSpec.seeds.yaml');
    expect(content).toContain('version-spaces-list-fields');
  });
});

// ---------------------------------------------------------------------------
// Version-space integration syncs completeness
// ---------------------------------------------------------------------------

describe('Version-space integration suite sync count', () => {
  it('has 11 sync files in version-space-integration suite', () => {
    const syncsDir = path.join(
      ROOT,
      'clef-base/suites/version-space-integration/syncs'
    );
    const files = fs.readdirSync(syncsDir).filter(f => f.endsWith('.sync'));
    expect(files).toHaveLength(11);
  });
});
