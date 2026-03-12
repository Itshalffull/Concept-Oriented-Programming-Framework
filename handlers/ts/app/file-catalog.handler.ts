// ============================================================
// FileCatalog Concept Implementation
//
// Discovers Clef artifacts on disk using pluggable providers.
// Each file type (.concept, .sync, .widget, .theme, .derived,
// suite.yaml) has its own provider with a file pattern and
// parsing logic.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '@clef/runtime';

// Lazy-load parsers only when needed (avoids circular deps at import time)
async function loadParsers() {
  const { parseConceptFile } = await import('../framework/parser.js');
  const { parseSyncFile } = await import('../framework/sync-parser.js');
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

export const fileCatalogHandler: ConceptHandler = {
  async registerProvider(input, storage) {
    const providerName = input.provider_name as string;
    const kind = input.kind as string;
    const filePattern = input.file_pattern as string;

    const existing = await storage.get('provider', providerName);
    if (existing) {
      return { variant: 'already_registered' };
    }

    await storage.put('provider', providerName, {
      id: providerName,
      provider_name: providerName,
      kind,
      file_pattern: filePattern,
    });

    return { variant: 'ok' };
  },

  async discover(input, storage) {
    const basePaths = (input.base_paths as string).split(',').map(p => p.trim());

    const fs = await import('fs');
    const path = await import('path');
    const parsers = await loadParsers();

    // Load registered providers (or use built-in defaults)
    let providers = await storage.find('provider', {});
    if (providers.length === 0) {
      // Auto-register built-in providers
      for (const bp of BUILT_IN_PROVIDERS) {
        await storage.put('provider', bp.provider_name, {
          id: bp.provider_name,
          provider_name: bp.provider_name,
          kind: bp.kind,
          file_pattern: bp.file_pattern,
        });
      }
      providers = BUILT_IN_PROVIDERS.map(bp => ({
        id: bp.provider_name,
        ...bp,
      }));
    }

    let found = 0;

    for (const basePath of basePaths) {
      const resolvedBase = path.resolve(basePath);
      let allFiles: string[];
      try {
        allFiles = walkDir(resolvedBase, fs, path);
      } catch {
        continue;
      }

      for (const filePath of allFiles) {
        const fileName = path.basename(filePath);

        for (const provider of providers) {
          const pattern = provider.file_pattern as string;
          if (!fileName.endsWith(pattern)) continue;

          const kind = provider.kind as string;
          let source: string;
          try {
            source = fs.readFileSync(filePath, 'utf-8');
          } catch {
            continue;
          }

          // Determine suite from directory structure
          const suite = inferSuite(filePath, resolvedBase, path);

          if (kind === 'concept') {
            const result = extractConceptMetadata(source, parsers.parseConceptFile);
            if (result) {
              const entryId = `${kind}:${result.name}`;
              await storage.put('entry', entryId, {
                id: entryId,
                path: filePath,
                kind,
                name: result.name,
                suite,
                metadata: JSON.stringify(result.metadata),
              });
              found++;
            }
          } else if (kind === 'sync') {
            const results = extractSyncMetadata(source, parsers.parseSyncFile);
            for (const result of results) {
              const entryId = `${kind}:${result.name}`;
              await storage.put('entry', entryId, {
                id: entryId,
                path: filePath,
                kind,
                name: result.name,
                suite,
                metadata: JSON.stringify(result.metadata),
              });
              found++;
            }
          } else if (kind === 'suite') {
            const result = extractSuiteMetadata(source);
            if (result) {
              const entryId = `${kind}:${result.name}`;
              await storage.put('entry', entryId, {
                id: entryId,
                path: filePath,
                kind,
                name: result.name,
                suite: result.name,
                metadata: JSON.stringify(result.metadata),
              });
              found++;
            }
          } else {
            // widget, theme, derived — generic extraction
            const result = extractGenericMetadata(source, kind);
            if (result) {
              const entryId = `${kind}:${result.name}`;
              await storage.put('entry', entryId, {
                id: entryId,
                path: filePath,
                kind,
                name: result.name,
                suite,
                metadata: JSON.stringify(result.metadata),
              });
              found++;
            }
          }
        }
      }
    }

    return { variant: 'ok', found };
  },

  async get(input, storage) {
    const name = input.name as string;
    const kind = input.kind as string;
    const entryId = `${kind}:${name}`;
    const entry = await storage.get('entry', entryId);
    if (!entry) return { variant: 'notfound' };
    return { variant: 'ok', entry: JSON.stringify(entry) };
  },

  async list(input, storage) {
    const kind = input.kind as string | undefined;
    const allEntries = await storage.find('entry', {});
    const filtered = kind
      ? allEntries.filter(e => e.kind === kind)
      : allEntries;
    return { variant: 'ok', entries: JSON.stringify(filtered) };
  },

  async listForSuite(input, storage) {
    const suite = input.suite as string;
    const allEntries = await storage.find('entry', {});
    const filtered = allEntries.filter(e => e.suite === suite);
    return { variant: 'ok', entries: JSON.stringify(filtered) };
  },

  async syncFilePathsForSuite(input, storage) {
    const suite = input.suite as string;
    const searchPathsStr = input.search_paths as string | undefined;
    const searchPaths = searchPathsStr
      ? searchPathsStr.split(',').map(p => p.trim())
      : ['suites/', '../repertoire/concepts/'];

    const fs = await import('fs');
    const path = await import('path');

    const manifest = findSuiteManifest(suite, searchPaths, fs, path);
    if (!manifest) {
      return { variant: 'error', message: `Suite manifest not found: ${suite}` };
    }

    const paths = collectSyncPaths(manifest, searchPaths, fs, path);
    return { variant: 'ok', paths: JSON.stringify(paths) };
  },
};

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
