// ============================================================
// SharedContentNodePoolProvider — Storage backend for Clef Base
//
// Routes concept state to the shared ContentNode pool:
// - Mapped fields (declared in schema.yaml) → ContentNode Properties
// - Unmapped fields → concept-local storage
// - Set membership → Schema membership
//
// See Architecture doc Sections 3.1.1, 13.1
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';
import type { SchemaDef, SchemaFieldDef } from './schema-yaml-parser.handler.js';

export interface FieldMapping {
  schemaName: string;
  conceptField: string;     // from the concept state
  schemaField: string;      // on the ContentNode Property
  mutability: string;       // editable | readonly | system
}

export interface SchemaMapping {
  schemaName: string;
  concept: string;
  primarySet: string;
  manifest: string;
  mappedFields: FieldMapping[];
  unmappedFields: string[];  // concept state fields NOT in schema.yaml
}

export interface PoolProviderConfig {
  schemaMappings: SchemaMapping[];
  conceptName: string;
}

/**
 * Build field mappings from parsed SchemaDefs.
 * Maps concept state fields declared in schema.yaml to ContentNode Properties.
 * Fields NOT in schema.yaml go to concept-local storage.
 */
export function buildSchemaMappings(
  schemas: SchemaDef[],
  conceptStateFields?: string[],
): SchemaMapping[] {
  const mappings: SchemaMapping[] = [];

  for (const schema of schemas) {
    if (!schema.concept) continue; // Only concept-mapped schemas get pool routing

    const mappedFields: FieldMapping[] = [];
    const mappedConceptFields = new Set<string>();

    for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
      if (fieldDef.from) {
        // This field is mapped from a concept state field
        mappedFields.push({
          schemaName: schema.name,
          conceptField: fieldDef.from,
          schemaField: fieldName,
          mutability: fieldDef.mutability || 'editable',
        });
        mappedConceptFields.add(fieldDef.from);
      }
    }

    // Determine unmapped fields (concept state fields NOT in schema.yaml)
    const unmappedFields: string[] = [];
    if (conceptStateFields) {
      for (const stateField of conceptStateFields) {
        if (!mappedConceptFields.has(stateField)) {
          unmappedFields.push(stateField);
        }
      }
    }

    mappings.push({
      schemaName: schema.name,
      concept: schema.concept,
      primarySet: schema.primary_set || 'items',
      manifest: schema.manifest,
      mappedFields,
      unmappedFields,
    });
  }

  return mappings;
}

/**
 * Route a save operation through the pool provider.
 * Returns instructions for how the data should be stored.
 */
export function routeSave(
  entityId: string,
  data: Record<string, unknown>,
  mapping: SchemaMapping,
): {
  contentNodeProperties: Record<string, unknown>;
  conceptLocalData: Record<string, unknown>;
  schemaToApply: string;
} {
  const contentNodeProperties: Record<string, unknown> = {};
  const conceptLocalData: Record<string, unknown> = {};

  const mappedConceptFields = new Set(
    mapping.mappedFields.map(f => f.conceptField),
  );

  for (const [key, value] of Object.entries(data)) {
    if (key === 'id') continue; // ID is not routed, it's the ContentNode ID

    const fieldMapping = mapping.mappedFields.find(f => f.conceptField === key);
    if (fieldMapping) {
      // Check mutability — system fields cannot be set by concept actions
      if (fieldMapping.mutability === 'system') {
        // System fields are set by storage infrastructure, skip in concept save
        continue;
      }
      contentNodeProperties[fieldMapping.schemaField] = value;
    } else {
      // Unmapped field → concept-local storage
      conceptLocalData[key] = value;
    }
  }

  return {
    contentNodeProperties,
    conceptLocalData,
    schemaToApply: mapping.schemaName,
  };
}

/**
 * Route a load operation through the pool provider.
 * Merges ContentNode Properties with concept-local data.
 */
export function routeLoad(
  contentNodeProperties: Record<string, unknown>,
  conceptLocalData: Record<string, unknown>,
  mapping: SchemaMapping,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  // Map ContentNode Properties back to concept field names
  for (const fieldMapping of mapping.mappedFields) {
    const value = contentNodeProperties[fieldMapping.schemaField];
    if (value !== undefined) {
      result[fieldMapping.conceptField] = value;
    }
  }

  // Merge concept-local data
  for (const [key, value] of Object.entries(conceptLocalData)) {
    result[key] = value;
  }

  return result;
}

/**
 * Resolve a concept set query to a Schema membership query.
 * Section 13.1: primary_set → "all ContentNodes with this Schema applied"
 */
export function resolveSetQuery(
  setName: string,
  mappings: SchemaMapping[],
): { schemaName: string; concept: string } | null {
  const mapping = mappings.find(m => m.primarySet === setName);
  if (!mapping) return null;
  return { schemaName: mapping.schemaName, concept: mapping.concept };
}

let counter = 0;
export function resetContentNodePoolProviderCounter(): void { counter = 0; }

export const contentNodePoolProviderHandler: ConceptHandler = {
  /**
   * Configure the pool provider for a concept by loading its schema.yaml mappings.
   * Input: { schemas: SchemaDef[], concept_state_fields?: string[] }
   */
  async configure(input: Record<string, unknown>, storage: ConceptStorage) {
    const schemas = input.schemas as SchemaDef[] | undefined;
    if (!schemas || !Array.isArray(schemas)) {
      return { variant: 'error', message: 'schemas must be an array of SchemaDef objects' };
    }

    const conceptStateFields = input.concept_state_fields as string[] | undefined;
    const mappings = buildSchemaMappings(schemas, conceptStateFields);

    if (mappings.length === 0) {
      return { variant: 'error', message: 'No concept-mapped schemas found in the provided schema definitions' };
    }

    const id = `pool-config-${++counter}`;
    const config: PoolProviderConfig = {
      schemaMappings: mappings,
      conceptName: mappings[0].concept,
    };

    await storage.put('pool_configs', id, {
      id,
      config,
    });

    return { variant: 'ok', id, config };
  },

  /**
   * Route a save operation: split data into ContentNode Properties
   * and concept-local storage.
   * Input: { entity_id: string, data: Record<string, unknown>, schema_name: string, config: PoolProviderConfig }
   */
  async routeSave(input: Record<string, unknown>, _storage: ConceptStorage) {
    const entityId = input.entity_id as string | undefined;
    const data = input.data as Record<string, unknown> | undefined;
    const schemaName = input.schema_name as string | undefined;
    const config = input.config as PoolProviderConfig | undefined;

    if (!entityId) return { variant: 'error', message: 'entity_id is required' };
    if (!data || typeof data !== 'object') return { variant: 'error', message: 'data must be an object' };
    if (!schemaName) return { variant: 'error', message: 'schema_name is required' };
    if (!config) return { variant: 'error', message: 'config is required (from configure action)' };

    const mapping = config.schemaMappings.find(m => m.schemaName === schemaName);
    if (!mapping) {
      return { variant: 'error', message: `No mapping found for schema "${schemaName}"` };
    }

    const routed = routeSave(entityId, data, mapping);

    return {
      variant: 'ok',
      entity_id: entityId,
      content_node_properties: routed.contentNodeProperties,
      concept_local_data: routed.conceptLocalData,
      schema_to_apply: routed.schemaToApply,
    };
  },

  /**
   * Route a load operation: merge ContentNode Properties with concept-local data.
   * Input: { content_node_properties: Record, concept_local_data: Record, schema_name: string, config: PoolProviderConfig }
   */
  async routeLoad(input: Record<string, unknown>, _storage: ConceptStorage) {
    const contentNodeProps = input.content_node_properties as Record<string, unknown> | undefined;
    const conceptLocalData = input.concept_local_data as Record<string, unknown> | undefined;
    const schemaName = input.schema_name as string | undefined;
    const config = input.config as PoolProviderConfig | undefined;

    if (!contentNodeProps || typeof contentNodeProps !== 'object') {
      return { variant: 'error', message: 'content_node_properties must be an object' };
    }
    if (!schemaName) return { variant: 'error', message: 'schema_name is required' };
    if (!config) return { variant: 'error', message: 'config is required' };

    const mapping = config.schemaMappings.find(m => m.schemaName === schemaName);
    if (!mapping) {
      return { variant: 'error', message: `No mapping found for schema "${schemaName}"` };
    }

    const merged = routeLoad(contentNodeProps, conceptLocalData || {}, mapping);

    return { variant: 'ok', data: merged };
  },

  /**
   * Resolve a concept set query to a Schema membership query.
   * Input: { set_name: string, config: PoolProviderConfig }
   */
  async resolveSet(input: Record<string, unknown>, _storage: ConceptStorage) {
    const setName = input.set_name as string | undefined;
    const config = input.config as PoolProviderConfig | undefined;

    if (!setName) return { variant: 'error', message: 'set_name is required' };
    if (!config) return { variant: 'error', message: 'config is required' };

    const resolved = resolveSetQuery(setName, config.schemaMappings);
    if (!resolved) {
      return { variant: 'notfound', message: `No schema mapping for set "${setName}"` };
    }

    return { variant: 'ok', schema_name: resolved.schemaName, concept: resolved.concept };
  },

  /**
   * Get the field routing summary for a configured concept.
   * Input: { config: PoolProviderConfig }
   */
  async describe(input: Record<string, unknown>, _storage: ConceptStorage) {
    const config = input.config as PoolProviderConfig | undefined;
    if (!config) return { variant: 'error', message: 'config is required' };

    const summary = config.schemaMappings.map(m => ({
      schema: m.schemaName,
      concept: m.concept,
      primarySet: m.primarySet,
      manifest: m.manifest,
      mappedFieldCount: m.mappedFields.length,
      unmappedFieldCount: m.unmappedFields.length,
      mappedFields: m.mappedFields.map(f => ({
        conceptField: f.conceptField,
        schemaField: f.schemaField,
        mutability: f.mutability,
      })),
      unmappedFields: m.unmappedFields,
    }));

    return { variant: 'ok', concept: config.conceptName, schemas: summary };
  },
};
