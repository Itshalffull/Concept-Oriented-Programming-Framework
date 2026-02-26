// Transform Plugin Provider: migration_lookup
// Resolve IDs from Provenance batch map table for referential integrity.
// See Architecture doc for transform plugin interface contract.

export const PROVIDER_ID = 'migration_lookup';
export const PLUGIN_TYPE = 'transform_plugin';

export interface TransformConfig {
  options?: Record<string, unknown>;
}

export interface TypeSpec {
  type: string;
  nullable?: boolean;
}

interface ProvenanceMapEntry {
  sourceId: string;
  destId: string;
  entityType: string;
  batchId: string;
}

export class MigrationLookupTransformProvider {
  private provenanceMap: Map<string, ProvenanceMapEntry> = new Map();

  transform(value: unknown, config: TransformConfig): unknown {
    if (value === null || value === undefined) {
      const required = config.options?.required !== false;
      if (required) {
        throw new Error('Migration lookup received null value for required field');
      }
      return null;
    }

    const sourceId = String(value);
    const entityType = (config.options?.entityType as string) ?? '';
    const batchId = config.options?.batchId as string | undefined;
    const fallbackBehavior = (config.options?.fallback as string) ?? 'error';

    // Build composite key for lookup
    const lookupKey = this.buildLookupKey(sourceId, entityType, batchId);

    // Check preloaded provenance map
    const entry = this.provenanceMap.get(lookupKey)
      ?? this.provenanceMap.get(this.buildLookupKey(sourceId, entityType));

    if (entry) {
      return entry.destId;
    }

    // Check inline map if provided
    const inlineMap = config.options?.map as Record<string, string> | undefined;
    if (inlineMap && sourceId in inlineMap) {
      return inlineMap[sourceId];
    }

    // Handle unresolved reference
    switch (fallbackBehavior) {
      case 'null':
        return null;
      case 'passthrough':
        return sourceId;
      case 'placeholder':
        return config.options?.placeholder ?? `__unresolved:${entityType}:${sourceId}`;
      case 'error':
      default:
        throw new Error(
          `Migration lookup failed: no destination ID found for source "${sourceId}" ` +
          `(entity: ${entityType}${batchId ? `, batch: ${batchId}` : ''})`
        );
    }
  }

  /** Preload the provenance map for efficient batch lookups */
  loadProvenanceMap(entries: ProvenanceMapEntry[]): void {
    this.provenanceMap.clear();
    for (const entry of entries) {
      const keyWithBatch = this.buildLookupKey(entry.sourceId, entry.entityType, entry.batchId);
      const keyWithoutBatch = this.buildLookupKey(entry.sourceId, entry.entityType);
      this.provenanceMap.set(keyWithBatch, entry);
      this.provenanceMap.set(keyWithoutBatch, entry);
    }
  }

  private buildLookupKey(sourceId: string, entityType: string, batchId?: string): string {
    const parts = [entityType, sourceId];
    if (batchId) parts.push(batchId);
    return parts.join('::');
  }

  inputType(): TypeSpec {
    return { type: 'string', nullable: true };
  }

  outputType(): TypeSpec {
    return { type: 'string', nullable: true };
  }
}

export default MigrationLookupTransformProvider;
