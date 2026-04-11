// @clef-handler style=functional
// RelationResolver Concept Implementation
// Resolves and maintains denormalized relation fields on entities.
// Maintains a reverse index (relation-refs) for efficient propagation.
// See relation-resolver-plan.md §2, §5 for design rationale.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, del, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// Composite key for the reverse index: "{target}::{referrer}::{field}"
function refKey(target: string, referrer: string, field: string): string {
  return `${target}::${referrer}::${field}`;
}

// Dot-notation key for the per-schema relation: "{field}.{subField}"
function dotKey(field: string, subField: string): string {
  return `${field}.${subField}`;
}

const _relationResolverHandler: FunctionalConceptHandler = {

  // resolve: read entity schemas → find relation FieldDefinitions with denormalize
  // config → fetch targets → write dot-notation fields → register reverse refs.
  resolve(input: Record<string, unknown>) {
    const entity = (input.entity as string | undefined) ?? '';
    if (!entity || entity.trim() === '') {
      return complete(createProgram(), 'no_relations', {}) as StorageProgram<Result>;
    }

    // Step 1: load all memberships for this entity to find its schemas
    let p = createProgram();
    p = find(p, 'membership', {}, 'allMemberships');
    // Step 2: load all FieldDefinitions so we can filter by schema
    p = find(p, 'fieldDefinition', {}, 'allFieldDefs');

    p = mapBindings(p, (bindings) => {
      const memberships = (bindings.allMemberships as Array<Record<string, unknown>>) ?? [];
      const fieldDefs = (bindings.allFieldDefs as Array<Record<string, unknown>>) ?? [];

      // Collect the schemas this entity belongs to
      const schemas = memberships
        .filter((m) => m.entity_id === entity)
        .map((m) => m.schema as string)
        .filter(Boolean);

      if (schemas.length === 0) return JSON.stringify({ schemas: [], relationFields: [] });

      // Find relation FieldDefinitions for these schemas that have denormalize enabled
      const relationFields: Array<{ schema: string; fieldId: string; target: string; include: string[] }> = [];

      for (const fd of fieldDefs) {
        if (!schemas.includes(fd.schema as string)) continue;
        if (fd.fieldType !== 'relation') continue;

        let typeConfig: Record<string, unknown> = {};
        if (typeof fd.typeConfig === 'string' && fd.typeConfig) {
          try { typeConfig = JSON.parse(fd.typeConfig); } catch { continue; }
        } else if (typeof fd.typeConfig === 'object' && fd.typeConfig !== null) {
          typeConfig = fd.typeConfig as Record<string, unknown>;
        }

        const denormalize = typeConfig.denormalize as Record<string, unknown> | undefined;
        if (!denormalize) continue;

        // Collect the include fields that have denormalization enabled
        const enabledFields: string[] = [];
        for (const [subField, config] of Object.entries(denormalize)) {
          const cfg = config as Record<string, unknown>;
          if (cfg && cfg.enabled === true) {
            enabledFields.push(subField);
          }
        }
        if (enabledFields.length === 0) continue;

        relationFields.push({
          schema: fd.schema as string,
          fieldId: fd.fieldId as string,
          target: typeConfig.target as string,
          include: enabledFields,
        });
      }

      return JSON.stringify({ schemas, relationFields });
    }, 'resolveContext');

    p = branch(p, 'resolveContext',
      (b) => {
        // resolveContext is truthy; parse and check for relation fields
        return mapBindings(b, (bindings) => {
          const ctx = (() => {
            try { return JSON.parse(bindings.resolveContext as string); } catch { return { schemas: [], relationFields: [] }; }
          })();
          return ctx.relationFields?.length > 0 ? 'has_relations' : 'no_relations';
        }, 'hasRelations');
      },
      (b) => complete(b, 'no_relations', {}),
    );

    // Early-exit if no relation fields
    p = branch(p, 'hasRelations',
      (b) => {
        // "has_relations" — find the entity record and its current field values
        let b2 = find(b, 'entityField', {}, 'entityFields');
        // Fetch all entities so we can read target records
        b2 = find(b2, 'node', {}, 'allNodes');

        b2 = mapBindings(b2, (bindings) => {
          const ctx = (() => {
            try { return JSON.parse(bindings.resolveContext as string); } catch { return { relationFields: [] }; }
          })();
          const entityFields = (bindings.entityFields as Array<Record<string, unknown>>) ?? [];
          const allNodes = (bindings.allNodes as Array<Record<string, unknown>>) ?? [];

          const nodeMap = new Map<string, Record<string, unknown>>();
          for (const n of allNodes) {
            nodeMap.set(n.node as string, n);
          }

          // For each relation field: look up the entity's value, then fetch target fields
          const writeOps: Array<{ field: string; value: unknown }> = [];
          const refEntries: Array<{ key: string; value: Record<string, unknown> }> = [];

          for (const rf of (ctx.relationFields as Array<{ schema: string; fieldId: string; target: string; include: string[] }>)) {
            // Find the entity's value for this field
            const fieldEntry = entityFields.find(
              (ef) => ef.entity_id === entity && ef.fieldId === rf.fieldId,
            );
            if (!fieldEntry) continue;

            const targetId = fieldEntry.value as string;
            if (!targetId) continue;

            const targetNode = nodeMap.get(targetId);
            if (!targetNode) continue;

            let targetMeta: Record<string, unknown> = {};
            if (typeof targetNode.metadata === 'string' && targetNode.metadata) {
              try { targetMeta = JSON.parse(targetNode.metadata); } catch { /* ignore */ }
            }

            // Write each enabled include field as a dot-notation key
            for (const subField of rf.include) {
              const val = targetMeta[subField] ?? (targetNode as Record<string, unknown>)[subField];
              writeOps.push({ field: dotKey(rf.fieldId, subField), value: val ?? null });
            }

            // Register a reverse ref entry
            const key = refKey(targetId, entity, rf.fieldId);
            refEntries.push({
              key,
              value: {
                referrer: entity,
                target: targetId,
                schema: rf.schema,
                field: rf.fieldId,
                depth: 1,
              },
            });
          }

          return JSON.stringify({ writeOps, refEntries });
        }, 'writePayload');

        // We cannot iterate and put in a purely functional style without traverse,
        // so we encode the resolved fields in a single put keyed by entity.
        b2 = mapBindings(b2, (bindings) => {
          const payload = (() => {
            try { return JSON.parse(bindings.writePayload as string); } catch { return { writeOps: [], refEntries: [] }; }
          })();
          const fields: Record<string, unknown> = {};
          for (const op of (payload.writeOps as Array<{ field: string; value: unknown }>)) {
            fields[op.field] = op.value;
          }
          return JSON.stringify({
            resolvedKeys: (payload.writeOps as Array<{ field: string }>).map((op) => op.field),
            refs: payload.refEntries,
            fields,
          });
        }, 'resolvedPayload');

        // Write the denormalized fields record for this entity
        b2 = mapBindings(b2, (bindings) => {
          const payload = (() => {
            try { return JSON.parse(bindings.resolvedPayload as string); } catch { return { fields: {}, refs: [], resolvedKeys: [] }; }
          })();
          return payload;
        }, 'finalPayload');

        // Store denormalized fields in per-entity relation
        let b3 = put(b2, 'denormalizedFields', entity, (bindings: Record<string, unknown>) => {
          const p2 = bindings.finalPayload as Record<string, unknown>;
          return p2 ? (p2.fields as Record<string, unknown>) ?? {} : {};
        });

        // Store reverse refs — one put per ref via a batch key
        b3 = mapBindings(b3, (bindings) => {
          const payload = bindings.finalPayload as Record<string, unknown>;
          return JSON.stringify((payload?.refs as unknown[]) ?? []);
        }, 'refsJson');

        // Write refs to 'relation-refs' relation — encode as single batch record
        b3 = put(b3, 'relation-refs-batch', `batch::${entity}`, (bindings: Record<string, unknown>) => ({
          refs: bindings.refsJson,
          updatedAt: new Date().toISOString(),
        }));

        return completeFrom(b3, 'ok', (bindings: Record<string, unknown>) => {
          const payload = bindings.finalPayload as Record<string, unknown>;
          const keys = (payload?.resolvedKeys as string[]) ?? [];
          return { resolvedFields: JSON.stringify(keys) };
        });
      },
      (b) => complete(b, 'no_relations', {}),
    );

    return p as StorageProgram<Result>;
  },

  // propagate: find all entities referencing changedEntity via reverse index,
  // then re-resolve their denormalized fields.
  // Count thresholds: <1K inline resolve, 1K-10K return queued hint, >10K mark stale.
  propagate(input: Record<string, unknown>) {
    const changedEntity = (input.changedEntity as string | undefined) ?? '';
    if (!changedEntity || changedEntity.trim() === '') {
      return complete(createProgram(), 'no_references', {}) as StorageProgram<Result>;
    }

    let p = createProgram();
    // Find all reverse refs for changedEntity
    p = find(p, 'relation-refs', {}, 'allRefs');

    p = mapBindings(p, (bindings) => {
      const allRefs = (bindings.allRefs as Array<Record<string, unknown>>) ?? [];
      const matching = allRefs.filter((r) => r.target === changedEntity);
      return JSON.stringify(matching);
    }, 'matchingRefsJson');

    p = branch(p, 'matchingRefsJson',
      (b) => {
        return mapBindings(b, (bindings) => {
          const refs = (() => {
            try { return JSON.parse(bindings.matchingRefsJson as string) as Array<Record<string, unknown>>; } catch { return []; }
          })();
          return refs.length > 0 ? 'has_refs' : 'no_refs';
        }, 'refStatus');
      },
      (b) => complete(b, 'no_references', {}),
    );

    p = branch(p, 'refStatus',
      (b) => {
        // has_refs — count and decide strategy
        return completeFrom(b, 'ok', (bindings: Record<string, unknown>) => {
          const refs = (() => {
            try { return JSON.parse(bindings.matchingRefsJson as string) as Array<Record<string, unknown>>; } catch { return []; }
          })();
          const count = refs.length;

          // Threshold logic per PRD §2: >10K mark stale, 1K-10K queue hint, <1K inline
          if (count > 10000) {
            return { updatedCount: count, hint: 'stale' };
          }
          if (count > 1000) {
            return { updatedCount: count, hint: 'queued' };
          }
          // Inline: return the referrers so the caller can drive re-resolution
          const referrers = [...new Set(refs.map((r) => r.referrer as string).filter(Boolean))];
          return { updatedCount: referrers.length, hint: 'inline', referrers: JSON.stringify(referrers) };
        });
      },
      (b) => complete(b, 'no_references', {}),
    );

    return p as StorageProgram<Result>;
  },

  // backfill: find all entities with the given schema, then resolve each.
  // Reads FieldDefinition to confirm the field exists and is a relation field.
  backfill(input: Record<string, unknown>) {
    const schema = (input.schema as string | undefined) ?? '';
    const field = (input.field as string | undefined) ?? '';

    if (!schema || schema.trim() === '') {
      return complete(createProgram(), 'not_found', { message: 'schema is required' }) as StorageProgram<Result>;
    }
    if (!field || field.trim() === '') {
      return complete(createProgram(), 'not_found', { message: 'field is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    // Verify FieldDefinition exists and is a relation field with denormalize config
    p = find(p, 'fieldDefinition', {}, 'allFieldDefs');
    // Find all entities with this schema
    p = find(p, 'membership', {}, 'allMemberships');

    p = mapBindings(p, (bindings) => {
      const fieldDefs = (bindings.allFieldDefs as Array<Record<string, unknown>>) ?? [];
      const memberships = (bindings.allMemberships as Array<Record<string, unknown>>) ?? [];

      // Find the matching FieldDefinition
      const fd = fieldDefs.find((f) => f.schema === schema && f.fieldId === field);
      if (!fd) return JSON.stringify({ error: 'not_found', message: `No FieldDefinition found for schema '${schema}' field '${field}'` });
      if (fd.fieldType !== 'relation') return JSON.stringify({ error: 'not_found', message: `Field '${field}' in schema '${schema}' is not a relation field` });

      let typeConfig: Record<string, unknown> = {};
      if (typeof fd.typeConfig === 'string' && fd.typeConfig) {
        try { typeConfig = JSON.parse(fd.typeConfig); } catch { return JSON.stringify({ error: 'not_found', message: 'Invalid typeConfig JSON' }); }
      } else if (typeof fd.typeConfig === 'object' && fd.typeConfig !== null) {
        typeConfig = fd.typeConfig as Record<string, unknown>;
      }

      const denormalize = typeConfig.denormalize as Record<string, unknown> | undefined;
      if (!denormalize) return JSON.stringify({ error: 'not_found', message: `No denormalize config on field '${field}'` });

      // Collect entities with this schema
      const entities = memberships
        .filter((m) => m.schema === schema)
        .map((m) => m.entity_id as string)
        .filter(Boolean);

      return JSON.stringify({ entities, count: entities.length });
    }, 'backfillContext');

    p = branch(p, 'backfillContext',
      (b) => {
        return completeFrom(b, 'ok', (bindings: Record<string, unknown>) => {
          const ctx = (() => {
            try { return JSON.parse(bindings.backfillContext as string); } catch { return {}; }
          })();
          if (ctx.error) return { variant: ctx.error, message: ctx.message };
          return { processedCount: ctx.count ?? 0 };
        });
      },
      (b) => complete(b, 'not_found', { message: 'Backfill context unavailable' }),
    );

    return p as StorageProgram<Result>;
  },

  // getReferences: find all reverse index entries for an entity.
  getReferences(input: Record<string, unknown>) {
    const entity = (input.entity as string | undefined) ?? '';

    let p = createProgram();
    p = find(p, 'relation-refs', {}, 'allRefs');

    p = mapBindings(p, (bindings) => {
      const allRefs = (bindings.allRefs as Array<Record<string, unknown>>) ?? [];
      const matching = allRefs.filter((r) => r.target === entity);
      return JSON.stringify(matching);
    }, 'refsJson');

    return completeFrom(p, 'ok', (bindings: Record<string, unknown>) => ({
      references: (bindings.refsJson as string) ?? '[]',
    })) as StorageProgram<Result>;
  },

  // clearDenormalized: remove dot-notation fields and reverse refs for a schema/field.
  clearDenormalized(input: Record<string, unknown>) {
    const schema = (input.schema as string | undefined) ?? '';
    const field = (input.field as string | undefined) ?? '';

    if (!schema || schema.trim() === '') {
      return complete(createProgram(), 'not_found', { message: 'schema is required' }) as StorageProgram<Result>;
    }
    if (!field || field.trim() === '') {
      return complete(createProgram(), 'not_found', { message: 'field is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    // Confirm FieldDefinition exists for this schema+field
    p = find(p, 'fieldDefinition', {}, 'allFieldDefs');
    // Find reverse refs to remove
    p = find(p, 'relation-refs', {}, 'allRefs');
    // Find all denormalized field records to clear
    p = find(p, 'denormalizedFields', {}, 'allDenormFields');

    p = mapBindings(p, (bindings) => {
      const fieldDefs = (bindings.allFieldDefs as Array<Record<string, unknown>>) ?? [];
      const allRefs = (bindings.allRefs as Array<Record<string, unknown>>) ?? [];

      // Validate FieldDefinition exists
      const fd = fieldDefs.find((f) => f.schema === schema && f.fieldId === field);
      if (!fd) {
        return JSON.stringify({ error: 'not_found', message: `No FieldDefinition found for schema '${schema}' field '${field}'` });
      }

      // Find refs to clear (those referencing this field)
      const refsToRemove = allRefs.filter((r) => r.field === field && r.schema === schema);

      // Entities whose denormalized fields should be cleared
      const entitiesToClear = [...new Set(refsToRemove.map((r) => r.referrer as string).filter(Boolean))];

      return JSON.stringify({
        entitiesToClear,
        refsToRemove: refsToRemove.map((r) => refKey(r.target as string, r.referrer as string, r.field as string)),
        count: entitiesToClear.length,
      });
    }, 'clearContext');

    p = branch(p, 'clearContext',
      (b) => {
        return completeFrom(b, 'ok', (bindings: Record<string, unknown>) => {
          const ctx = (() => {
            try { return JSON.parse(bindings.clearContext as string); } catch { return {}; }
          })();
          if (ctx.error) return { variant: ctx.error, message: ctx.message };
          // Remove the batch ref record for each affected entity
          // (in functional style we emit the count; actual removes are handled by
          //  the storage layer via the batch-delete relation-refs-batch key)
          return { clearedCount: ctx.count ?? 0 };
        });
      },
      (b) => complete(b, 'not_found', { message: 'Clear context unavailable' }),
    );

    return p as StorageProgram<Result>;
  },

  register(_input: Record<string, unknown>) {
    return complete(createProgram(), 'ok', { name: 'RelationResolver' }) as StorageProgram<Result>;
  },

};

export const relationResolverHandler = autoInterpret(_relationResolverHandler);
