// @migrated dsl-constructs 2026-03-18
// ============================================================
// HookSyncGenerator — Generates sync files from schema.yaml
// hook declarations at install time.
//
// Each hook (on_save, on_apply, on_remove, on_delete) becomes
// a standard sync file that wires ContentStorage/Schema events
// to concept actions (Section 2.1.3).
//
// See Architecture doc Section 2.1.3
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import { createProgram, get, find, put, del, merge, branch, complete, completeFrom, mapBindings, pure, type StorageProgram } from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';
import type { SchemaDef, SchemaHooks } from './schema-yaml-parser.handler.js';

export interface GeneratedHookSync {
  name: string;        // e.g., "Media_onSave"
  schemaName: string;  // e.g., "Media"
  hookType: string;    // e.g., "on_save"
  content: string;     // full sync file content
}

/**
 * Hook type metadata — maps hook names to their trigger patterns
 * and sync evaluation modes per Section 2.1.3.
 */
const HOOK_METADATA: Record<string, {
  triggerConcept: string;
  triggerAction: string;
  mode: 'eager' | 'eventual';
  usesSchemaFilter: boolean;
  schemaParam: string | null;
}> = {
  on_save: {
    triggerConcept: 'ContentStorage',
    triggerAction: 'save',
    mode: 'eventual',
    usesSchemaFilter: true,
    schemaParam: null,
  },
  on_apply: {
    triggerConcept: 'Schema',
    triggerAction: 'applyTo',
    mode: 'eager',
    usesSchemaFilter: false,
    schemaParam: 'schema',
  },
  on_remove: {
    triggerConcept: 'Schema',
    triggerAction: 'removeFrom',
    mode: 'eventual',
    usesSchemaFilter: false,
    schemaParam: 'schema',
  },
  on_delete: {
    triggerConcept: 'ContentStorage',
    triggerAction: 'delete',
    mode: 'eventual',
    usesSchemaFilter: true,
    schemaParam: null,
  },
};

/**
 * Generate a single hook sync file content from a schema name,
 * hook type, and action reference.
 *
 * Section 2.1.3: each hook becomes a standard sync with appropriate
 * trigger pattern and optional schema filter.
 */
export function generateHookSync(
  schemaName: string,
  hookType: string,
  actionRef: string,
): GeneratedHookSync | { error: string } {
  const meta = HOOK_METADATA[hookType];
  if (!meta) {
    return { error: `Unknown hook type "${hookType}". Valid hooks: ${Object.keys(HOOK_METADATA).join(', ')}` };
  }

  // Validate action reference format: Concept/action
  if (!actionRef.includes('/')) {
    return { error: `Hook action "${actionRef}" must be in Concept/action format` };
  }

  const [concept, action] = actionRef.split('/');
  // on_save -> onSave, on_apply -> onApply, etc.
  const parts = hookType.split('_');
  const hookSuffix = parts[0] + parts.slice(1).map(p => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  const syncName = `${schemaName}_${hookSuffix}`;

  const lines: string[] = [];

  // Comment header
  lines.push(`# Auto-generated hook sync from schema.yaml (Section 2.1.3)`);
  lines.push(`# Schema: ${schemaName}, Hook: ${hookType}`);
  lines.push(`# Action: ${actionRef}`);
  lines.push('');

  // Sync declaration
  lines.push(`sync ${syncName} [${meta.mode}]`);

  // When clause
  lines.push('when {');
  if (meta.schemaParam) {
    // on_apply, on_remove — schema name is in the trigger params
    lines.push(`  ${meta.triggerConcept}/${meta.triggerAction}: [ entity_id: ?id; ${meta.schemaParam}: "${schemaName}" ] => [ ok: _ ]`);
  } else {
    // on_save, on_delete — generic trigger, filter by schema membership
    lines.push(`  ${meta.triggerConcept}/${meta.triggerAction}: [ id: ?id ] => [ ok: _ ]`);
  }
  lines.push('}');

  // Where clause (only for hooks that need schema filter)
  if (meta.usesSchemaFilter) {
    lines.push('where {');
    lines.push(`  Schema/getSchemasFor: [ entity_id: ?id ] => [ ok: ?schemas ]`);
    lines.push(`  filter("${schemaName}" in ?schemas)`);
    lines.push('}');
  }

  // Then clause
  lines.push('then {');
  lines.push(`  ${concept}/${action}: [ entity_id: ?id ]`);
  lines.push('}');

  return {
    name: syncName,
    schemaName,
    hookType,
    content: lines.join('\n'),
  };
}

/**
 * Generate all hook syncs for a set of parsed SchemaDefs.
 */
export function generateAllHookSyncs(schemas: SchemaDef[]): {
  syncs: GeneratedHookSync[];
  errors: Array<{ message: string; schema: string; hook: string }>;
} {
  const syncs: GeneratedHookSync[] = [];
  const errors: Array<{ message: string; schema: string; hook: string }> = [];

  for (const schema of schemas) {
    if (!schema.hooks) continue;
    if (!schema.concept) {
      errors.push({
        message: `Schema "${schema.name}" has hooks but no associated concept`,
        schema: schema.name,
        hook: '*',
      });
      continue;
    }

    for (const [hookType, actionRef] of Object.entries(schema.hooks)) {
      if (!actionRef) continue;
      const result = generateHookSync(schema.name, hookType, actionRef);
      if ('error' in result) {
        errors.push({
          message: result.error,
          schema: schema.name,
          hook: hookType,
        });
      } else {
        syncs.push(result);
      }
    }
  }

  return { syncs, errors };
}

let counter = 0;
export function resetHookSyncGeneratorCounter(): void { counter = 0; }

const _handler: FunctionalConceptHandler = {
  /**
   * Generate hook syncs from parsed schema definitions.
   * Input: { schemas: SchemaDef[] }
   */
  generate(input: Record<string, unknown>) {
    let p = createProgram();
    const schemas = input.schemas as SchemaDef[] | undefined;
    if (!schemas || !Array.isArray(schemas)) {
      p = complete(p, 'error', { message: 'schemas must be an array of SchemaDef objects' }); return p;
    }

    const result = generateAllHookSyncs(schemas);

    if (result.errors.length > 0) {
      p = complete(p, 'error', { message: `Hook sync generation had ${result.errors.length} error(s)`,
        errors: result.errors }); return p;
    }

    const id = `hook-syncs-${++counter}`;
    const syncFiles = result.syncs.map(s => ({
      name: `${s.name}.sync`,
      content: s.content,
    }));

    p = put(p, 'generated_hook_syncs', id, {
      id,
      syncs: syncFiles,
    });

    p = complete(p, 'ok', { id, sync_files: syncFiles }); return p;
  },

  /**
   * Generate hook syncs from raw schema.yaml source.
   * Convenience action that parses then generates.
   * Input: { source: Record<string, unknown> }
   */
  generateFromYaml(input: Record<string, unknown>) {
    let p = createProgram();
    const source = input.source as Record<string, unknown> | undefined;
    if (!source || typeof source !== 'object') {
      p = complete(p, 'error', { message: 'source must be a parsed YAML object' }); return p;
    }

    // Dynamically import to avoid circular deps
    const { parseSchemaYaml } = await import('./schema-yaml-parser.handler.js');
    const parseResult = parseSchemaYaml(source);

    if (parseResult.errors.length > 0) {
      p = complete(p, 'error', { message: `schema.yaml has ${parseResult.errors.length} validation error(s)`,
        errors: parseResult.errors }); return p;
    }

    // Delegate to generate action
    return this.generate({ schemas: parseResult.schemas });
  },

  /**
   * Preview what hook syncs would be generated for a schema,
   * without storing anything.
   */
  preview(input: Record<string, unknown>) {
    let p = createProgram();
    const schemaName = input.schema_name as string | undefined;
    const hooks = input.hooks as Record<string, string> | undefined;
    const concept = input.concept as string | undefined;

    if (!schemaName) {
      p = complete(p, 'error', { message: 'schema_name is required' }); return p;
    }
    if (!hooks || typeof hooks !== 'object') {
      p = complete(p, 'error', { message: 'hooks must be an object mapping hook types to action references' }); return p;
    }
    if (!concept) {
      p = complete(p, 'error', { message: 'concept is required for hook sync generation' }); return p;
    }

    const previews: Array<{ name: string; hookType: string; content: string }> = [];
    const errors: Array<{ message: string; hook: string }> = [];

    for (const [hookType, actionRef] of Object.entries(hooks)) {
      if (!actionRef) continue;
      const result = generateHookSync(schemaName, hookType, actionRef);
      if ('error' in result) {
        errors.push({ message: result.error, hook: hookType });
      } else {
        previews.push({ name: result.name, hookType: result.hookType, content: result.content });
      }
    }

    if (errors.length > 0) {
      p = complete(p, 'error', { message: 'Some hooks have errors', errors }); return p;
    }

    p = complete(p, 'ok', { previews }); return p;
  },
};

export const hookSyncGeneratorHandler = autoInterpret(_handler);
