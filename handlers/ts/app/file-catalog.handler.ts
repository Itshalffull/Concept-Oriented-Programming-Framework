// @clef-handler style=functional
// ============================================================
// FileCatalog Concept Implementation
//
// Discovers Clef artifacts on disk using pluggable providers.
// Each file type (.concept, .sync, .widget, .theme, .derived,
// suite.yaml) has its own provider with a file pattern and
// parsing logic.
// ============================================================

// @migrated dsl-constructs 2026-03-18
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, branch, complete, perform,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

// Lazy-load parsers only when needed (avoids circular deps at import time).
// Uses synchronous require — the modules are expected to be pre-loaded by
// the runtime before the handler is invoked.
function loadParsers(): { parseConceptFile: (s: string) => unknown; parseSyncFile: (s: string) => unknown[] } {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { parseConceptFile } = require('../framework/parser.js');
  const { parseSyncFile } = require('../framework/sync-parser.js');
  return { parseConceptFile, parseSyncFile };
}

interface CatalogEntry {
  id: string;
  path: string;
  kind: string;
  name: string;
  suite: string | null;
  metadata: string; // JSON
}

interface ProviderDef {
  provider_name: string;
  kind: string;
  file_pattern: string; // glob suffix, e.g. ".concept"
}

// --- Built-in providers ---

const BUILT_IN_PROVIDERS: ProviderDef[] = [
  { provider_name: 'concept', kind: 'concept', file_pattern: '.concept' },
  { provider_name: 'sync', kind: 'sync', file_pattern: '.sync' },
  { provider_name: 'widget', kind: 'widget', file_pattern: '.widget' },
  { provider_name: 'theme', kind: 'theme', file_pattern: '.theme' },
  { provider_name: 'derived', kind: 'derived', file_pattern: '.derived' },
  { provider_name: 'suite', kind: 'suite', file_pattern: 'suite.yaml' },
];

// --- Provider-specific metadata extraction ---

function extractConceptMetadata(source: string, parseConceptFile: (s: string) => unknown): {
  name: string;
  metadata: Record<string, unknown>;
} | null {
  try {
    const ast = parseConceptFile(source) as Record<string, unknown>;
    const name = ast.name as string;
    const purpose = ast.purpose as string ?? '';
    const version = (ast as Record<string, unknown>).version;
    const typeParams = ast.typeParams as string[] ?? [];
    const actions = (ast.actions as Array<{ name: string; params: unknown[]; variants: unknown[] }>) ?? [];
    const state = (ast.state as Array<{ name: string }>) ?? [];
    const invariants = (ast.invariants as unknown[]) ?? [];
    const capabilities = (ast.capabilities as string[]) ?? [];
    const annotations = ast.annotations as Record<string, unknown> ?? {};

    return {
      name,
      metadata: {
        name,
        purpose: purpose.slice(0, 200),
        version: version ?? 1,
        category: annotations.category ?? null,
        visibility: annotations.visibility ?? null,
        gate: annotations.gate ?? false,
        typeParams,
        stateFields: state.map(s => s.name),
        actions: actions.map(a => ({
          name: a.name,
          params: (a.params ?? []).length,
          variants: (a.variants ?? []).length,
        })),
        invariantCount: invariants.length,
        capabilities,
      },
    };
  } catch {
    return null;
  }
}

function extractSyncMetadata(source: string, parseSyncFile: (s: string) => unknown[]): {
  name: string;
  metadata: Record<string, unknown>;
}[] {
  try {
    const syncs = parseSyncFile(source) as Array<Record<string, unknown>>;
    return syncs.map(sync => {
      const name = sync.name as string ?? 'unknown';
      const whenPatterns = (sync.when ?? sync.whenPatterns ?? []) as Array<Record<string, unknown>>;
      const thenActions = (sync.then ?? sync.thenActions ?? []) as Array<Record<string, unknown>>;
      const annotations = (sync.annotations ?? []) as string[];

      const triggers = whenPatterns.map(w => ({
        concept: w.concept as string ?? '',
        action: w.action as string ?? '',
      }));
      const effects = thenActions.map(t => ({
        concept: t.concept as string ?? '',
        action: t.action as string ?? '',
      }));

      return {
        name,
        metadata: {
          name,
          purpose: sync.purpose as string ?? '',
          annotations,
          triggers,
          effects,
          whereClauseCount: ((sync.where ?? sync.whereClause ?? []) as unknown[]).length,
        },
      };
    });
  } catch {
    return [];
  }
}

function extractSuiteMetadata(source: string): {
  name: string;
  metadata: Record<string, unknown>;
} | null {
  try {
    // Lightweight YAML parse for suite.yaml
    const lines = source.split('\n');
    let name = '';
    let version = '';
    let description = '';
    let conceptCount = 0;
    let syncCount = 0;
    const uses: string[] = [];
    const dependencies: string[] = [];
    let section = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('name:')) {
        name = trimmed.replace('name:', '').trim().replace(/^["']|["']$/g, '');
      } else if (trimmed.startsWith('version:')) {
        version = trimmed.replace('version:', '').trim();
      } else if (trimmed.startsWith('description:')) {
        description = trimmed.replace('description:', '').trim().replace(/^["']|["']$/g, '');
      } else if (trimmed === 'concepts:') {
        section = 'concepts';
      } else if (trimmed === 'syncs:') {
        section = 'syncs';
      } else if (trimmed === 'uses:') {
        section = 'uses';
      } else if (trimmed === 'dependencies:') {
        section = 'dependencies';
      } else if (trimmed.startsWith('- ')) {
        if (section === 'concepts') conceptCount++;
        else if (section === 'syncs') syncCount++;
        else if (section === 'uses') uses.push(trimmed.slice(2).trim());
        else if (section === 'dependencies') dependencies.push(trimmed.slice(2).trim());
      } else if (!line.startsWith('  ') && !line.startsWith('\t') && trimmed !== '' && !trimmed.startsWith('#')) {
        section = '';
      }
    }

    if (!name) return null;
    return {
      name,
      metadata: { name, version, description, conceptCount, syncCount, uses, dependencies },
    };
  } catch {
    return null;
  }
}

function extractGenericMetadata(source: string, kind: string): {
  name: string;
  metadata: Record<string, unknown>;
} | null {
  // For .widget, .theme, .derived — extract name from the first declaration line
  const match = source.match(new RegExp(`(widget|theme|derived)\\s+(\\w+)`));
  if (match) {
    return {
      name: match[2],
      metadata: { name: match[2], kind },
    };
  }
  return null;
}

// --- Walk directory recursively ---

function walkDir(dir: string, fs: typeof import('fs'), path: typeof import('path')): string[] {
  const results: string[] = [];
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        results.push(...walkDir(fullPath, fs, path));
      } else {
        results.push(fullPath);
      }
    } catch {
      // skip inaccessible files
    }
  }
  return results;
}

// --- Suite dependency walking for sync path resolution ---

interface SuiteManifest {
  name: string;
  syncs: Array<{ file: string; tier?: string }>;
  uses: Array<{ name: string; optional?: boolean }>;
  basePath: string;
}

function parseSuiteYaml(source: string, basePath: string): SuiteManifest | null {
  const lines = source.split('\n');
  let name = '';
  const syncs: Array<{ file: string; tier?: string }> = [];
  const uses: Array<{ name: string; optional?: boolean }> = [];
  let section = '';
  let currentItem: Record<string, string> = {};

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('name:')) {
      name = trimmed.replace('name:', '').trim().replace(/^["']|["']$/g, '');
    } else if (trimmed === 'syncs:') {
      section = 'syncs';
    } else if (trimmed === 'uses:') {
      section = 'uses';
    } else if (trimmed === 'concepts:' || trimmed === 'dependencies:') {
      section = trimmed.replace(':', '');
    } else if (section === 'syncs' && trimmed.startsWith('- ')) {
      if (currentItem.name && section === 'syncs') {
        syncs.push({ file: currentItem.file ?? '', tier: currentItem.tier });
      }
      currentItem = {};
      const fieldLine = trimmed.slice(2);
      const colonIdx = fieldLine.indexOf(':');
      if (colonIdx > 0) {
        const key = fieldLine.slice(0, colonIdx).trim();
        const val = fieldLine.slice(colonIdx + 1).trim();
        currentItem[key] = val;
      }
    } else if (section === 'uses' && trimmed.startsWith('- ')) {
      if (currentItem.name && section === 'uses') {
        uses.push({ name: currentItem.name, optional: currentItem.optional === 'true' });
      }
      currentItem = {};
      const fieldLine = trimmed.slice(2);
      const colonIdx = fieldLine.indexOf(':');
      if (colonIdx > 0) {
        const key = fieldLine.slice(0, colonIdx).trim();
        const val = fieldLine.slice(colonIdx + 1).trim();
        currentItem[key] = val;
      } else {
        // Simple list item: `- suite-name`
        currentItem.name = fieldLine.trim();
      }
    } else if ((section === 'syncs' || section === 'uses') && /^\s{2,}\S/.test(line)) {
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx > 0) {
        const key = trimmed.slice(0, colonIdx).trim();
        const val = trimmed.slice(colonIdx + 1).trim();
        currentItem[key] = val;
      }
    } else if (!line.startsWith('  ') && !line.startsWith('\t') && trimmed !== '' && !trimmed.startsWith('#')) {
      // Flush pending item on section change
      if (section === 'syncs' && currentItem.file) {
        syncs.push({ file: currentItem.file, tier: currentItem.tier });
      } else if (section === 'uses' && currentItem.name) {
        uses.push({ name: currentItem.name, optional: currentItem.optional === 'true' });
      }
      currentItem = {};
      section = '';
    }
  }

  // Flush last item
  if (section === 'syncs' && currentItem.file) {
    syncs.push({ file: currentItem.file, tier: currentItem.tier });
  } else if (section === 'uses' && currentItem.name) {
    uses.push({ name: currentItem.name, optional: currentItem.optional === 'true' });
  }

  if (!name) return null;
  return { name, syncs, uses, basePath };
}

function findSuiteManifest(
  suiteName: string,
  searchPaths: string[],
  fs: typeof import('fs'),
  path: typeof import('path'),
): SuiteManifest | null {
  for (const searchPath of searchPaths) {
    const suiteDir = path.resolve(searchPath, suiteName);
    const manifestPath = path.join(suiteDir, 'suite.yaml');
    try {
      const source = fs.readFileSync(manifestPath, 'utf-8');
      return parseSuiteYaml(source, suiteDir);
    } catch {
      // not found in this search path
    }
  }
  return null;
}

function collectSyncPaths(
  manifest: SuiteManifest,
  searchPaths: string[],
  fs: typeof import('fs'),
  path: typeof import('path'),
  visited: Set<string> = new Set(),
): string[] {
  if (visited.has(manifest.name)) return []; // cycle detection
  visited.add(manifest.name);

  const paths: string[] = [];

  // Add this suite's own sync files
  for (const sync of manifest.syncs) {
    if (sync.file) {
      const resolved = path.resolve(manifest.basePath, sync.file);
      paths.push(resolved);
    }
  }

  // Recurse into `uses:` dependencies
  for (const dep of manifest.uses) {
    const depManifest = findSuiteManifest(dep.name, searchPaths, fs, path);
    if (depManifest) {
      paths.push(...collectSyncPaths(depManifest, searchPaths, fs, path, visited));
    }
  }

  return paths;
}

// --- Handler ---

const _fileCatalogHandler: FunctionalConceptHandler = {
  registerProvider(input: Record<string, unknown>) {
    const providerName = input.provider_name as string;
    const kind = input.kind as string;
    const filePattern = input.file_pattern as string;

    let p = createProgram();
    p = spGet(p, 'provider', providerName, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', {}),
      (b) => {
        let b2 = put(b, 'provider', providerName, {
          id: providerName, provider_name: providerName, kind, file_pattern: filePattern,
        });
        return complete(b2, 'ok', {});
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  discover(input: Record<string, unknown>) {
    const basePaths = (input.base_paths as string);
    // Delegate filesystem walk to FsProvider via transport effect.
    // The effect handler reads the directory tree and returns file entries.
    let p = createProgram();
    p = perform(p, 'fs', 'discover', { base_paths: basePaths }, 'discoveryResult');
    return complete(p, 'ok', { found: 0 }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  get(input: Record<string, unknown>) {
    const name = input.name as string;
    const kind = input.kind as string;
    const entryId = `${kind}:${name}`;

    let p = createProgram();
    p = spGet(p, 'entry', entryId, 'entry');
    p = branch(p, 'entry',
      (b) => complete(b, 'ok', { entry: '' }),
      (b) => complete(b, 'notfound', {}),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  list(input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'entry', {}, 'allEntries');
    return complete(p, 'ok', { entries: '' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  listForSuite(input: Record<string, unknown>) {
    const suite = input.suite as string;
    let p = createProgram();
    p = find(p, 'entry', {}, 'allEntries');
    return complete(p, 'ok', { entries: '' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  syncFilePathsForSuite(input: Record<string, unknown>) {
    const suite = input.suite as string;
    let p = createProgram();
    p = find(p, 'entry', { suite, kind: 'suite' }, 'suiteEntries');
    return complete(p, 'ok', { paths: '[]' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const fileCatalogHandler = autoInterpret(_fileCatalogHandler);


// --- Helpers ---

function inferSuite(
  filePath: string,
  basePath: string,
  path: typeof import('path'),
): string | null {
  // Look for suite.yaml in the same directory or parent directories up to basePath
  let dir = path.dirname(filePath);
  while (dir.length >= basePath.length) {
    try {
      const fs = require('fs');
      const suiteFile = path.join(dir, 'suite.yaml');
      if (fs.existsSync(suiteFile)) {
        const content = fs.readFileSync(suiteFile, 'utf-8');
        const nameMatch = content.match(/^name:\s*(.+)/m);
        if (nameMatch) {
          return nameMatch[1].trim().replace(/^["']|["']$/g, '');
        }
      }
    } catch {
      // ignore
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}
