// ============================================================
// EntityReflector Concept Implementation
//
// Creates ContentNode entries for registered concepts, loaded
// syncs, defined schemas, and other entity types. Uses a
// provider model so new entity type providers can be added.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '@clef/runtime';

// The reflector needs access to the kernel to query other concepts.
// This is injected via a factory function called from kernel.ts.
let _kernelRef: {
  invokeConcept: (uri: string, action: string, input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  queryConcept: (uri: string, relation: string) => Promise<Record<string, unknown>[]>;
} | null = null;

export function setEntityReflectorKernel(kernel: typeof _kernelRef) {
  _kernelRef = kernel;
}

// --- Provider implementations ---

async function reflectConcepts(): Promise<{ created: number; skipped: number }> {
  if (!_kernelRef) return { created: 0, skipped: 0 };
  let created = 0;
  let skipped = 0;

  // Get registered concepts from RuntimeRegistry
  const regResult = await _kernelRef.invokeConcept('urn:clef/RuntimeRegistry', 'listConcepts', {});
  if (regResult.variant !== 'ok') return { created: 0, skipped: 0 };

  const concepts = JSON.parse(regResult.concepts as string) as Array<Record<string, unknown>>;

  // Optionally enrich with FileCatalog metadata
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

    // Check if ContentNode already exists
    const existing = await _kernelRef.invokeConcept('urn:clef/ContentNode', 'get', { node: nodeId });
    if (existing.variant === 'ok') {
      skipped++;
      continue;
    }

    // Build content from RuntimeRegistry + FileCatalog
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

  // Enrich with FileCatalog metadata
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
    created++;
  }

  return { created, skipped };
}

async function reflectSchemas(): Promise<{ created: number; skipped: number }> {
  if (!_kernelRef) return { created: 0, skipped: 0 };
  let created = 0;
  let skipped = 0;

  // Query Schema concept for all defined schemas
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

export const entityReflectorHandler: ConceptHandler = {
  async registerProvider(input, storage) {
    const providerName = input.provider_name as string;

    const existing = await storage.get('provider', providerName);
    if (existing) {
      return { variant: 'already_registered' };
    }

    await storage.put('provider', providerName, {
      id: providerName,
      provider_name: providerName,
      last_run: null,
      reflected_count: 0,
    });

    return { variant: 'ok' };
  },

  async reflect(_input, storage) {
    let totalCreated = 0;
    let totalSkipped = 0;

    // Ensure built-in providers are registered
    for (const name of Object.keys(PROVIDERS)) {
      const existing = await storage.get('provider', name);
      if (!existing) {
        await storage.put('provider', name, {
          id: name,
          provider_name: name,
          last_run: null,
          reflected_count: 0,
        });
      }
    }

    const providers = await storage.find('provider', {});

    for (const provider of providers) {
      const name = provider.provider_name as string;
      const fn = PROVIDERS[name];
      if (!fn) continue;

      try {
        const { created, skipped } = await fn();
        totalCreated += created;
        totalSkipped += skipped;

        await storage.put('provider', name, {
          ...provider,
          last_run: new Date().toISOString(),
          reflected_count: (provider.reflected_count as number ?? 0) + created,
        });
      } catch {
        // Provider failure doesn't halt other providers
      }
    }

    return { variant: 'ok', created: totalCreated, skipped: totalSkipped };
  },

  async reflectProvider(input, storage) {
    const providerName = input.provider_name as string;

    const provider = await storage.get('provider', providerName);
    if (!provider) {
      return { variant: 'notfound', message: `No provider: ${providerName}` };
    }

    const fn = PROVIDERS[providerName];
    if (!fn) {
      return { variant: 'notfound', message: `No implementation for provider: ${providerName}` };
    }

    const { created, skipped } = await fn();

    await storage.put('provider', providerName, {
      ...provider,
      last_run: new Date().toISOString(),
      reflected_count: (provider.reflected_count as number ?? 0) + created,
    });

    return { variant: 'ok', created, skipped };
  },

  async status(_input, storage) {
    const providers = await storage.find('provider', {});
    return { variant: 'ok', providers: JSON.stringify(providers) };
  },
};
