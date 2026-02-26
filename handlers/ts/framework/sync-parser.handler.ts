// ============================================================
// SyncParser Concept Implementation
//
// Wraps the bootstrap kernel's parseSyncFile as a proper concept
// handler. Parses .sync source strings into structured ASTs
// and validates concept/action references against manifests.
// ============================================================

import type { ConceptHandler, ConceptStorage, ConceptAST } from '../../../kernel/src/types.js';
import { parseSyncFile as parseSyncFileKernel } from './sync-parser.js';
import { generateId } from '../../../kernel/src/types.js';

// Re-export the raw parse function so consumers can import it
// from the concept implementation rather than the kernel parser.
export const parseSyncFile = parseSyncFileKernel;

// A manifest is a summary of a concept's actions and state,
// used for validation. We derive it from ConceptAST.
interface Manifest {
  name: string;
  uri: string;
  actions: string[];
}

function astToManifest(ast: ConceptAST): Manifest {
  return {
    name: ast.name,
    uri: `urn:copf/${ast.name}`,
    actions: ast.actions.map(a => a.name),
  };
}

export const syncParserHandler: ConceptHandler = {
  async parse(input, storage) {
    const source = input.source as string;
    const manifests = input.manifests as (ConceptAST | Manifest)[];

    if (!source || typeof source !== 'string') {
      return { variant: 'error', message: 'source is required and must be a string', line: 0 };
    }

    try {
      // Parse the .sync source
      const compiledSyncs = parseSyncFileKernel(source);

      if (compiledSyncs.length === 0) {
        return { variant: 'error', message: 'No sync definitions found in source', line: 0 };
      }

      // Build manifest index for validation
      const manifestIndex = new Map<string, Manifest>();
      if (manifests && Array.isArray(manifests)) {
        for (const m of manifests) {
          // Accept either a raw ConceptAST or a pre-built Manifest
          const manifest = 'actions' in m && Array.isArray((m as ConceptAST).actions) && (m as ConceptAST).actions.length > 0 && typeof (m as ConceptAST).actions[0] === 'object'
            ? astToManifest(m as ConceptAST)
            : m as Manifest;
          manifestIndex.set(manifest.name, manifest);
          if ('uri' in manifest) {
            manifestIndex.set(manifest.uri, manifest);
          }
        }
      }

      // Validate references in each sync against manifests
      const warnings: string[] = [];
      for (const sync of compiledSyncs) {
        // Validate when-clause concept/action references
        for (const pattern of sync.when) {
          const conceptName = pattern.concept.split('/').pop() || pattern.concept;
          if (manifestIndex.size > 0 && !manifestIndex.has(conceptName)) {
            warnings.push(`Sync "${sync.name}": when-clause references unknown concept "${conceptName}"`);
          }
        }

        // Validate then-clause concept/action references
        for (const action of sync.then) {
          const conceptName = action.concept.split('/').pop() || action.concept;
          if (manifestIndex.size > 0 && !manifestIndex.has(conceptName)) {
            warnings.push(`Sync "${sync.name}": then-clause references unknown concept "${conceptName}"`);
          }
        }
      }

      // Store each parsed sync
      const results: { syncId: string; name: string }[] = [];
      for (const sync of compiledSyncs) {
        const syncId = generateId();
        await storage.put('syncs', syncId, { syncId, name: sync.name });
        await storage.put('ast', syncId, { syncId, ast: sync });
        results.push({ syncId, name: sync.name });
      }

      // Return the first sync for single-sync files, all for multi-sync
      const firstId = results[0].syncId;
      const firstAst = compiledSyncs[0];

      return {
        variant: 'ok',
        sync: firstId,
        ast: firstAst,
        allSyncs: results,
        warnings,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const lineMatch = message.match(/line (\d+)/);
      const line = lineMatch ? parseInt(lineMatch[1], 10) : 0;
      return { variant: 'error', message, line };
    }
  },
};
