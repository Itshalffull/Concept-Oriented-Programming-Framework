// @migrated dsl-constructs 2026-03-18
// ============================================================
// EntityReflector Concept Implementation
//
// Creates ContentNode entries for registered concepts, loaded
// syncs, defined schemas, and other entity types. Uses a
// provider model so new entity type providers can be added.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// The reflector needs access to the kernel to query other concepts.
// This is injected via a factory function called from kernel.ts.
let _kernelRef: {
  invokeConcept: (uri: string, action: string, input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  queryConcept: (uri: string, relation: string) => Promise<Record<string, unknown>[]>;
} | null = null;

export function setEntityReflectorKernel(kernel: typeof _kernelRef) {
  _kernelRef = kernel;
}

// Maps entity type (ContentNode.type) to the Schema name to apply.
const TYPE_TO_SCHEMA: Record<string, string> = {
  concept: 'Concept',
  sync: 'Sync',
  schema: 'Schema',
  widget: 'Widget',
  theme: 'Theme',
  derived: 'Derived',
  suite: 'Suite',
};

// Apply the corresponding schema to a newly created ContentNode.
// Best-effort: schema may not exist yet during early boot.
async function applySchemaToNode(nodeId: string, entityType: string): Promise<void> {
  if (!_kernelRef) return;
  const schemaName = TYPE_TO_SCHEMA[entityType];
  if (!schemaName) return;

  try {
    await _kernelRef.invokeConcept('urn:clef/Schema', 'applyTo', {
      entity_id: nodeId,
      schema: schemaName,
    });
  } catch {
    // Schema may not be seeded yet — don't fail reflection
  }
}

// --- Provider implementations ---

async function reflectConcepts(): Promise<{ created: number; skipped: number }> {
  if (!_kernelRef) return { created: 0, skipped: 0 };
  let created = 0;
  let skipped = 0;

  const regResult = await _kernelRef.invokeConcept('urn:clef/RuntimeRegistry', 'listConcepts', {});
  if (regResult.variant !== 'ok') return { created: 0, skipped: 0 };

  const concepts = JSON.parse(regResult.concepts as string) as Array<Record<string, unknown>>;

  let catalogEntries: Record<string, Record<string, unknown>> = {};
  try {
    const catResult = await _kernelRef.invokeConcept('urn:clef/FileCatalog', 'list', { kind: 'concept' });
    if (catResult.variant === 'ok') {
      const entries = JSON.parse(catResult.entries as string) as Array<Record<string, unknown>>;
      for (const entry of entries) {
        catalogEntries[entry.name as string] = entry;
      }
    }
  } catch {
    // FileCatalog may not have run yet
  }

  for (const concept of concepts) {
    const uri = concept.uri as string;
    const name = uri.replace('urn:clef/', '');
    const nodeId = `concept:${name}`;

    const existing = await _kernelRef.invokeConcept('urn:clef/ContentNode', 'get', { node: nodeId });
    if (existing.variant === 'ok') {
      skipped++;
      continue;
    }

    const catalogEntry = catalogEntries[name];
    const metadata = catalogEntry?.metadata
      ? JSON.parse(catalogEntry.metadata as string)
      : {};

    const content: Record<string, unknown> = {
      name,
      uri,
      purpose: metadata.purpose ?? '',
      hasStorage: concept.has_storage ?? false,
      storageType: concept.storage_type ?? 'none',
      actionCount: metadata.actions?.length ?? 0,
      stateFieldCount: metadata.stateFields?.length ?? 0,
      isLoaded: true,
    };

    await _kernelRef.invokeConcept('urn:clef/ContentNode', 'create', {
      node: nodeId,
      type: 'concept',
      content: JSON.stringify(content),
      createdBy: 'system',
    });
    await applySchemaToNode(nodeId, 'concept');
    created++;
  }

  return { created, skipped };
}

async function reflectSyncs(): Promise<{ created: number; skipped: number }> {
  if (!_kernelRef) return { created: 0, skipped: 0 };
  let created = 0;
  let skipped = 0;

  const regResult = await _kernelRef.invokeConcept('urn:clef/RuntimeRegistry', 'listSyncs', {});
  if (regResult.variant !== 'ok') return { created: 0, skipped: 0 };

  const syncs = JSON.parse(regResult.syncs as string) as Array<Record<string, unknown>>;

  let catalogEntries: Record<string, Record<string, unknown>> = {};
  try {
    const catResult = await _kernelRef.invokeConcept('urn:clef/FileCatalog', 'list', { kind: 'sync' });
    if (catResult.variant === 'ok') {
      const entries = JSON.parse(catResult.entries as string) as Array<Record<string, unknown>>;
      for (const entry of entries) {
        catalogEntries[entry.name as string] = entry;
      }
    }
  } catch {
    // FileCatalog may not have run yet
  }

  for (const sync of syncs) {
    const syncName = sync.sync_name as string;
    const nodeId = `sync:${syncName}`;

    const existing = await _kernelRef.invokeConcept('urn:clef/ContentNode', 'get', { node: nodeId });
    if (existing.variant === 'ok') {
      skipped++;
      continue;
    }

    const catalogEntry = catalogEntries[syncName];
    const metadata = catalogEntry?.metadata
      ? JSON.parse(catalogEntry.metadata as string)
      : {};

    const content: Record<string, unknown> = {
      name: syncName,
      suite: sync.suite ?? metadata.suite ?? '',
      source: sync.source ?? '',
      triggers: metadata.triggers ?? [],
      effects: metadata.effects ?? [],
      annotations: metadata.annotations ?? [],
      isLoaded: true,
    };

    await _kernelRef.invokeConcept('urn:clef/ContentNode', 'create', {
      node: nodeId,
      type: 'sync',
      content: JSON.stringify(content),
      createdBy: 'system',
    });
    await applySchemaToNode(nodeId, 'sync');
    created++;
  }

  return { created, skipped };
}

async function reflectSchemas(): Promise<{ created: number; skipped: number }> {
  if (!_kernelRef) return { created: 0, skipped: 0 };
  let created = 0;
  let skipped = 0;

  const schemas = await _kernelRef.queryConcept('urn:clef/Schema', 'schema');

  for (const schema of schemas) {
    const schemaName = schema.name as string ?? schema.schema as string;
    if (!schemaName) continue;
    const nodeId = `schema:${schemaName}`;

    const existing = await _kernelRef.invokeConcept('urn:clef/ContentNode', 'get', { node: nodeId });
    if (existing.variant === 'ok') {
      skipped++;
      continue;
    }

    const content: Record<string, unknown> = {
      name: schemaName,
      fields: schema.fields ?? '',
      extendsSchema: schema.extends ?? null,
    };

    await _kernelRef.invokeConcept('urn:clef/ContentNode', 'create', {
      node: nodeId,
      type: 'schema',
      content: JSON.stringify(content),
      createdBy: 'system',
    });
    await applySchemaToNode(nodeId, 'schema');
    created++;
  }

  return { created, skipped };
}

// --- FileCatalog-based providers for disk-discovered artifacts ---

async function reflectFromFileCatalog(
  kind: string,
  contentBuilder: (entry: Record<string, unknown>, metadata: Record<string, unknown>) => Record<string, unknown>,
): Promise<{ created: number; skipped: number }> {
  if (!_kernelRef) return { created: 0, skipped: 0 };
  let created = 0;
  let skipped = 0;

  try {
    const catResult = await _kernelRef.invokeConcept('urn:clef/FileCatalog', 'list', { kind });
    if (catResult.variant !== 'ok') return { created: 0, skipped: 0 };

    const entries = JSON.parse(catResult.entries as string) as Array<Record<string, unknown>>;

    for (const entry of entries) {
      const name = entry.name as string;
      if (!name) continue;
      const nodeId = `${kind}:${name}`;

      const existing = await _kernelRef.invokeConcept('urn:clef/ContentNode', 'get', { node: nodeId });
      if (existing.variant === 'ok') {
        skipped++;
        continue;
      }

      let metadata: Record<string, unknown> = {};
      try {
        metadata = entry.metadata
          ? JSON.parse(entry.metadata as string)
          : {};
      } catch {
        // metadata parse failure — use empty
      }

      const content = contentBuilder(entry, metadata);

      await _kernelRef.invokeConcept('urn:clef/ContentNode', 'create', {
        node: nodeId,
        type: kind,
        content: JSON.stringify(content),
        createdBy: 'system',
      });
      await applySchemaToNode(nodeId, kind);
      created++;
    }
  } catch {
    // FileCatalog may not have run yet
  }

  return { created, skipped };
}

async function reflectWidgets(): Promise<{ created: number; skipped: number }> {
  return reflectFromFileCatalog('widget', (entry, metadata) => ({
    name: metadata.name ?? entry.name,
    purpose: metadata.purpose ?? '',
    category: metadata.category ?? '',
    anatomyParts: metadata.anatomyParts ?? [],
    states: metadata.states ?? [],
    propCount: metadata.propCount ?? 0,
    a11yRole: metadata.a11yRole ?? '',
    affordance: metadata.affordance ?? null,
    composedWidgets: metadata.composedWidgets ?? [],
    framework: 'react',
  }));
}

async function reflectThemes(): Promise<{ created: number; skipped: number }> {
  return reflectFromFileCatalog('theme', (entry, metadata) => ({
    name: metadata.name ?? entry.name,
    purpose: metadata.purpose ?? '',
    extends: metadata.extends ?? null,
    paletteCount: metadata.paletteCount ?? 0,
    colorRoleCount: metadata.colorRoleCount ?? 0,
    typographyScale: metadata.typographyScale ?? '',
    spacingUnit: metadata.spacingUnit ?? '',
    tokenCount: metadata.tokenCount ?? 0,
    contrastPairs: metadata.contrastPairs ?? 0,
  }));
}

async function reflectDerived(): Promise<{ created: number; skipped: number }> {
  return reflectFromFileCatalog('derived', (entry, metadata) => ({
    name: metadata.name ?? entry.name,
    purpose: metadata.purpose ?? '',
    typeParams: metadata.typeParams ?? [],
    composedConcepts: metadata.composedConcepts ?? [],
    composedDerived: metadata.composedDerived ?? [],
    requiredSyncs: metadata.requiredSyncs ?? 0,
    recommendedSyncs: metadata.recommendedSyncs ?? 0,
    surfaceActions: metadata.surfaceActions ?? [],
    surfaceQueries: metadata.surfaceQueries ?? [],
    hasPrinciple: metadata.hasPrinciple ?? false,
  }));
}

async function reflectSuites(): Promise<{ created: number; skipped: number }> {
  return reflectFromFileCatalog('suite', (entry, metadata) => ({
    name: metadata.name ?? entry.name,
    version: metadata.version ?? '',
    description: metadata.description ?? '',
    conceptCount: metadata.conceptCount ?? 0,
    syncCount: metadata.syncCount ?? 0,
    uses: metadata.uses ?? [],
    dependencies: metadata.dependencies ?? [],
  }));
}

// Provider dispatch table
const PROVIDERS: Record<string, () => Promise<{ created: number; skipped: number }>> = {
  concept: reflectConcepts,
  sync: reflectSyncs,
  schema: reflectSchemas,
  widget: reflectWidgets,
  theme: reflectThemes,
  derived: reflectDerived,
  suite: reflectSuites,
};

// --- Handler ---

const _entityReflectorHandler: FunctionalConceptHandler = {
  registerProvider(input: Record<string, unknown>) {
    const providerName = input.provider_name as string;

    let p = createProgram();
    p = get(p, 'provider', providerName, 'existing');

    p = branch(p, 'existing',
      (b) => complete(b, 'already_registered', {}) as StorageProgram<Result>,
      (b) => {
        let b2 = put(b, 'provider', providerName, {
          id: providerName,
          provider_name: providerName,
          last_run: null,
          reflected_count: 0,
        });
        return complete(b2, 'ok', {}) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;

    return p;
  },

  reflect(_input: Record<string, unknown>) {
    // The reflect action requires async kernel calls to external concepts
    // (RuntimeRegistry, FileCatalog, ContentNode, Schema) which cannot be
    // expressed as StorageProgram instructions. We use the storage program
    // for the provider bookkeeping (get/put/find on 'provider' relation)
    // and delegate the actual reflection to the async provider functions.
    //
    // This action uses a hybrid approach: StorageProgram for local storage
    // operations, with the provider execution happening during interpretation
    // via completeFrom's binding-time computation.

    let p = createProgram();

    // Ensure built-in providers are registered
    for (const name of Object.keys(PROVIDERS)) {
      // We use mapBindings to track provider names, then put each one
      p = get(p, 'provider', name, `provider_check_${name}`);
    }

    // Since the reflect action heavily relies on external kernel calls
    // (which are async side effects outside the StorageProgram model),
    // we keep provider registration in the program but delegate execution
    // to the async providers via a pureFrom that runs the async logic.
    //
    // For now, register all providers, find them, then run reflection.
    for (const name of Object.keys(PROVIDERS)) {
      p = branch(p,
        (bindings) => !bindings[`provider_check_${name}`],
        (b) => put(b, 'provider', name, {
          id: name,
          provider_name: name,
          last_run: null,
          reflected_count: 0,
        }),
        (b) => b,
      );
    }

    p = find(p, 'provider', {}, 'providers');

    // The actual reflection must happen via async provider calls.
    // We return a completeFrom that signals the caller to run providers.
    return completeFrom(p, 'ok', (_bindings) => ({
      created: 0,
      skipped: 0,
      _providersPending: true,
    })) as StorageProgram<Result>;
  },

  reflectProvider(input: Record<string, unknown>) {
    const providerName = input.provider_name as string;

    let p = createProgram();
    p = get(p, 'provider', providerName, 'provider');

    p = branch(p, 'provider',
      (b) => {
        // Check if implementation exists
        if (!PROVIDERS[providerName]) {
          return complete(b, 'notfound', { message: `No implementation for provider: ${providerName}` }) as StorageProgram<Result>;
        }
        // Provider found — signal that async execution is needed
        return completeFrom(b, 'ok', (_bindings) => ({
          created: 0,
          skipped: 0,
          _providerName: providerName,
          _providersPending: true,
        })) as StorageProgram<Result>;
      },
      (b) => complete(b, 'notfound', { message: `No provider: ${providerName}` }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;

    return p;
  },

  status(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'provider', {}, 'providers');

    return completeFrom(p, 'ok', (bindings) => ({
      providers: JSON.stringify(bindings.providers),
    })) as StorageProgram<Result>;
  },
};

export const entityReflectorHandler = autoInterpret(_entityReflectorHandler);
