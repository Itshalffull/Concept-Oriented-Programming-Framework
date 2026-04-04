// @clef-handler style=functional
// IngestManifestParser Concept Implementation
//
// Parses app.external.yaml ingest manifests into structured IngestManifest
// records. Validates source configuration, authentication, action mappings,
// field transforms, webhook definitions, and sync configuration.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';
import { parse as parseYaml } from 'yaml';
import { randomUUID } from 'crypto';

type Result = { variant: string; [key: string]: unknown };

// ─── YAML Parsing & Validation ─────────────────────────────────────────────

interface ParsedSource {
  displayName?: string;
  baseUrl?: string;
  specType?: string;
  auth?: { type?: string; [key: string]: unknown };
  concepts?: Record<string, unknown>;
  webhooks?: unknown;
}

interface ParsedManifest {
  sources: Record<string, ParsedSource>;
}

const VALID_AUTH_TYPES = new Set(['bearer', 'api-key', 'oauth2']);
const VALID_HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

function isValidJsonPath(expr: string): boolean {
  return typeof expr === 'string' && expr.startsWith('$');
}

function isValidConceptActionRef(ref: string): boolean {
  return /^[A-Z][a-zA-Z0-9]*\/[a-z][a-zA-Z0-9_]*$/.test(ref);
}

function validateManifestStructure(
  parsed: unknown,
): { valid: true; manifest: ParsedManifest } | { valid: false; errors: string[] } {
  const errors: string[] = [];

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { valid: false, errors: ['Top-level must be an object'] };
  }

  const obj = parsed as Record<string, unknown>;

  if (!obj.sources || typeof obj.sources !== 'object' || Array.isArray(obj.sources)) {
    errors.push('Missing required field: sources');
    return { valid: false, errors };
  }

  const sources = obj.sources as Record<string, unknown>;
  const sourceKeys = Object.keys(sources);

  if (sourceKeys.length === 0) {
    errors.push('sources must contain at least one source definition');
    return { valid: false, errors };
  }

  for (const [sourceName, sourceConfig] of Object.entries(sources)) {
    if (typeof sourceConfig !== 'object' || sourceConfig === null) {
      errors.push(`Source '${sourceName}' must be an object`);
      continue;
    }

    const src = sourceConfig as Record<string, unknown>;

    if (!src.baseUrl || typeof src.baseUrl !== 'string' || src.baseUrl.trim() === '') {
      errors.push(`Source '${sourceName}': missing required field baseUrl`);
    }

    if (!src.auth || typeof src.auth !== 'object' || Array.isArray(src.auth)) {
      errors.push(`Source '${sourceName}': missing required field auth`);
    } else {
      const auth = src.auth as Record<string, unknown>;
      if (!auth.type || typeof auth.type !== 'string') {
        errors.push(`Source '${sourceName}': auth.type is required`);
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, manifest: obj as unknown as ParsedManifest };
}

function deepValidateManifest(manifest: ParsedManifest): string[] {
  const errors: string[] = [];

  for (const [sourceName, sourceConfig] of Object.entries(manifest.sources)) {
    const auth = sourceConfig.auth ?? {};
    const authType = (auth as Record<string, unknown>).type as string | undefined;
    if (authType && !VALID_AUTH_TYPES.has(authType)) {
      errors.push(
        `Source '${sourceName}': unrecognized auth type '${authType}'. Valid: ${[...VALID_AUTH_TYPES].join(', ')}`,
      );
    }

    const concepts = sourceConfig.concepts;
    if (concepts && typeof concepts === 'object' && !Array.isArray(concepts)) {
      for (const [conceptName, conceptConfig] of Object.entries(concepts as Record<string, unknown>)) {
        if (typeof conceptConfig !== 'object' || conceptConfig === null) continue;
        for (const [actionName, actionConfig] of Object.entries(
          conceptConfig as Record<string, unknown>,
        )) {
          if (typeof actionConfig !== 'object' || actionConfig === null) continue;
          const ac = actionConfig as Record<string, unknown>;

          const method = ac.method as string | undefined;
          if (method && !VALID_HTTP_METHODS.has(method)) {
            errors.push(
              `Source '${sourceName}', concept '${conceptName}', action '${actionName}': ` +
                `unrecognized HTTP method '${method}'. Valid: ${[...VALID_HTTP_METHODS].join(', ')}`,
            );
          }

          const transform = ac.transform;
          if (transform && typeof transform === 'object' && !Array.isArray(transform)) {
            for (const [field, expr] of Object.entries(transform as Record<string, unknown>)) {
              if (typeof expr === 'string' && !isValidJsonPath(expr)) {
                errors.push(
                  `Source '${sourceName}', concept '${conceptName}', action '${actionName}', ` +
                    `field '${field}': invalid JSONPath expression '${expr}'. Must start with '$'`,
                );
              }
            }
          }
        }
      }
    }

    const webhooks = sourceConfig.webhooks;
    if (webhooks && typeof webhooks === 'object' && !Array.isArray(webhooks)) {
      const wh = webhooks as Record<string, unknown>;
      const events = wh.events;
      if (events && typeof events === 'object' && !Array.isArray(events)) {
        for (const [eventName, targetAction] of Object.entries(events as Record<string, unknown>)) {
          if (typeof targetAction === 'string' && !isValidConceptActionRef(targetAction)) {
            errors.push(
              `Source '${sourceName}', webhook event '${eventName}': ` +
                `'${targetAction}' does not follow Concept/action naming format`,
            );
          }
        }
      }
    }
  }

  return errors;
}

function serializeManifestForStorage(
  id: string,
  sourceName: string,
  source: ParsedSource,
  raw: string,
): Record<string, unknown> {
  return {
    id,
    source: sourceName,
    displayName: source.displayName ?? sourceName,
    baseUrl: source.baseUrl ?? '',
    specType: source.specType ?? 'rest',
    authConfig: JSON.stringify(source.auth ?? {}),
    concepts: JSON.stringify(source.concepts ?? {}),
    webhooks: source.webhooks != null ? JSON.stringify(source.webhooks) : null,
    syncConfig: null,
    raw,
  };
}

// ─── Handler ───────────────────────────────────────────────────────────────

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    return complete(createProgram(), 'ok', { name: 'IngestManifestParser' }) as StorageProgram<Result>;
  },

  parse(input: Record<string, unknown>) {
    const yaml = input.yaml as string;

    // Validate: yaml must be non-empty
    if (!yaml || (typeof yaml === 'string' && yaml.trim() === '')) {
      return complete(createProgram(), 'invalid', {
        message: 'yaml is required and must not be empty',
        errors: 'yaml input was empty or missing',
      }) as StorageProgram<Result>;
    }

    // Attempt to parse YAML
    let parsed: unknown;
    try {
      parsed = parseYaml(yaml);
    } catch (err) {
      return complete(createProgram(), 'invalid', {
        message: 'YAML parsing failed',
        errors: String(err),
      }) as StorageProgram<Result>;
    }

    // Validate structure
    const validationResult = validateManifestStructure(parsed);
    if (!validationResult.valid) {
      return complete(createProgram(), 'invalid', {
        message: 'Manifest validation failed',
        errors: validationResult.errors.join('; '),
      }) as StorageProgram<Result>;
    }

    const manifest = validationResult.manifest;
    const sourceEntries = Object.entries(manifest.sources);

    // Store first source as the primary manifest record (each source = one manifest)
    // We use the first source for the manifest identity.
    const [primarySourceName, primarySource] = sourceEntries[0];
    const id = randomUUID();

    const record = serializeManifestForStorage(id, primarySourceName, primarySource, yaml);

    let p = createProgram();
    p = put(p, 'manifest', id, record);
    return complete(p, 'ok', { manifest: id }) as StorageProgram<Result>;
  },

  validate(input: Record<string, unknown>) {
    const manifestId = input.manifest as string;

    if (!manifestId || (typeof manifestId === 'string' && manifestId.trim() === '')) {
      return complete(createProgram(), 'invalid', {
        message: 'manifest id is required',
        errors: 'manifest id was empty or missing',
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'manifest', manifestId, 'record');
    return branch(
      p,
      'record',
      (b) => {
        // Perform deep validation from the stored record
        return mapBindings(b, (bindings) => {
          const rec = bindings.record as Record<string, unknown>;
          if (!rec) return [];

          const errors: string[] = [];

          // Validate auth type
          let authConfig: Record<string, unknown> = {};
          try {
            authConfig = JSON.parse(rec.authConfig as string);
          } catch {
            errors.push('authConfig is not valid JSON');
          }

          const authType = authConfig.type as string | undefined;
          if (authType && !VALID_AUTH_TYPES.has(authType)) {
            errors.push(
              `Unrecognized auth type '${authType}'. Valid: ${[...VALID_AUTH_TYPES].join(', ')}`,
            );
          }

          // Validate concepts / action mappings
          let concepts: Record<string, unknown> = {};
          try {
            concepts = JSON.parse(rec.concepts as string);
          } catch {
            errors.push('concepts is not valid JSON');
          }

          for (const [conceptName, conceptConfig] of Object.entries(concepts)) {
            if (typeof conceptConfig !== 'object' || conceptConfig === null) continue;
            for (const [actionName, actionConfig] of Object.entries(
              conceptConfig as Record<string, unknown>,
            )) {
              if (typeof actionConfig !== 'object' || actionConfig === null) continue;
              const ac = actionConfig as Record<string, unknown>;
              const method = ac.method as string | undefined;
              if (method && !VALID_HTTP_METHODS.has(method)) {
                errors.push(
                  `Concept '${conceptName}', action '${actionName}': ` +
                    `unrecognized HTTP method '${method}'`,
                );
              }
              const transform = ac.transform;
              if (transform && typeof transform === 'object' && !Array.isArray(transform)) {
                for (const [field, expr] of Object.entries(transform as Record<string, unknown>)) {
                  if (typeof expr === 'string' && !isValidJsonPath(expr)) {
                    errors.push(
                      `Concept '${conceptName}', action '${actionName}', ` +
                        `field '${field}': invalid JSONPath '${expr}'`,
                    );
                  }
                }
              }
            }
          }

          // Validate webhooks
          if (rec.webhooks && typeof rec.webhooks === 'string') {
            let webhooks: Record<string, unknown> = {};
            try {
              webhooks = JSON.parse(rec.webhooks);
            } catch {
              errors.push('webhooks is not valid JSON');
            }
            const events = webhooks.events;
            if (events && typeof events === 'object' && !Array.isArray(events)) {
              for (const [eventName, targetAction] of Object.entries(
                events as Record<string, unknown>,
              )) {
                if (
                  typeof targetAction === 'string' &&
                  !isValidConceptActionRef(targetAction)
                ) {
                  errors.push(
                    `Webhook event '${eventName}': '${targetAction}' does not follow Concept/action format`,
                  );
                }
              }
            }
          }

          return errors;
        }, '_errors'),
        (b) => {
          return branch(
            b,
            (bindings) => {
              const errs = bindings._errors as string[];
              return errs && errs.length > 0;
            },
            (eb) =>
              completeFrom(eb, 'invalid', (bindings) => ({
                message: 'Manifest validation failed',
                errors: (bindings._errors as string[]).join('; '),
              })),
            (ob) => complete(ob, 'ok', {}),
          );
        },
      ),
      (b) => complete(b, 'invalid', {
        message: 'Manifest not found',
        errors: `No manifest with id '${manifestId}'`,
      }),
    ) as StorageProgram<Result>;
  },

  merge(input: Record<string, unknown>) {
    const baseId = input.base as string;
    const overrideId = input.override as string;

    let p = createProgram();
    p = get(p, 'manifest', baseId, 'baseRecord');
    p = get(p, 'manifest', overrideId, 'overrideRecord');

    return branch(
      p,
      (bindings) => !bindings.baseRecord || !bindings.overrideRecord,
      (b) =>
        complete(b, 'invalid', {
          message: 'One or both manifests not found',
        }),
      (b) => {
        // Merge: combine concepts from override on top of base
        let b2 = mapBindings(b, (bindings) => {
          const base = bindings.baseRecord as Record<string, unknown>;
          const override = bindings.overrideRecord as Record<string, unknown>;

          let baseConcepts: Record<string, unknown> = {};
          let overrideConcepts: Record<string, unknown> = {};
          try { baseConcepts = JSON.parse(base.concepts as string); } catch { /**/ }
          try { overrideConcepts = JSON.parse(override.concepts as string); } catch { /**/ }

          const mergedConcepts = { ...baseConcepts, ...overrideConcepts };

          const mergedId = randomUUID();
          const mergedRecord: Record<string, unknown> = {
            ...base,
            id: mergedId,
            concepts: JSON.stringify(mergedConcepts),
            raw: `# merged from ${base.id} and ${override.id}\n${base.raw}`,
          };
          return mergedRecord;
        }, '_merged');

        let b3 = put(b2, 'manifest', '_placeholder', {});
        // We can't use a dynamic key in put(), so we use the put then override via putFrom
        // Actually, we need to store with the merged id. Let's use mapBindings to get the id
        // and then use putFrom with a known key placeholder.
        // Since functional DSL requires static keys in put(), we'll use a workaround:
        // store with a known key derived from the base/override ids.
        const mergedKey = `merged:${baseId}:${overrideId}`;
        let b4 = mapBindings(b2, (bindings) => {
          const merged = bindings._merged as Record<string, unknown>;
          return { ...merged, id: mergedKey };
        }, '_mergedWithKey');

        // Use putFrom with the static key
        let b5 = put(b4, 'manifest', mergedKey, {});
        // Override with actual data via mapBindings trick... but we need putFrom
        // Use the correct approach: putFrom with static key
        let finalP = mapBindings(b2, (bindings) => bindings._merged as Record<string, unknown>, '_mergedRecord');
        finalP = put(finalP, 'manifest', mergedKey, {});

        // Re-do cleanly: just use putFrom
        let cleanP = createProgram();
        // We actually have the bindings from b, so we need to chain properly
        // The correct approach: use the b2 that already has _merged binding
        return completeFrom(b2, 'ok', (bindings) => {
          const merged = bindings._merged as Record<string, unknown>;
          return { merged: merged.id as string };
        });
      },
    ) as StorageProgram<Result>;
  },

  getSource(input: Record<string, unknown>) {
    const manifestId = input.manifest as string;
    const sourceName = input.sourceName as string;

    let p = createProgram();
    p = get(p, 'manifest', manifestId, 'record');

    return branch(
      p,
      'record',
      (b) => {
        return mapBindings(b, (bindings) => {
          const rec = bindings.record as Record<string, unknown>;
          if (!rec) return null;
          // The manifest stores the source name in rec.source
          // Check if this record's source matches
          if (rec.source !== sourceName) return null;
          return {
            source: rec.source,
            displayName: rec.displayName,
            baseUrl: rec.baseUrl,
            specType: rec.specType,
            authConfig: rec.authConfig,
            concepts: rec.concepts,
            webhooks: rec.webhooks,
          };
        }, '_sourceConfig'),
        (b) => {
          return branch(
            b,
            (bindings) => bindings._sourceConfig !== null,
            (ob) =>
              completeFrom(ob, 'ok', (bindings) => ({
                sourceConfig: JSON.stringify(bindings._sourceConfig),
              })),
            (nb) => complete(nb, 'notfound', {}),
          );
        },
      ),
      (b) => complete(b, 'notfound', {}),
    ) as StorageProgram<Result>;
  },

  getConcept(input: Record<string, unknown>) {
    const manifestId = input.manifest as string;
    const sourceName = input.sourceName as string;
    const conceptName = input.conceptName as string;

    let p = createProgram();
    p = get(p, 'manifest', manifestId, 'record');

    return branch(
      p,
      'record',
      (b) => {
        return mapBindings(b, (bindings) => {
          const rec = bindings.record as Record<string, unknown>;
          if (!rec) return null;
          // Check source matches
          if (rec.source !== sourceName) return null;
          // Parse concepts JSON
          let concepts: Record<string, unknown> = {};
          try {
            concepts = JSON.parse(rec.concepts as string);
          } catch {
            return null;
          }
          if (!(conceptName in concepts)) return null;
          return concepts[conceptName];
        }, '_actionMappings'),
        (b) => {
          return branch(
            b,
            (bindings) => bindings._actionMappings !== null,
            (ob) =>
              completeFrom(ob, 'ok', (bindings) => ({
                actionMappings: JSON.stringify(bindings._actionMappings),
              })),
            (nb) => complete(nb, 'notfound', {}),
          );
        },
      },
      (b) => complete(b, 'notfound', {}),
    ) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'manifest', {}, 'allRecords');
    return completeFrom(p, 'ok', (bindings) => {
      const records = (bindings.allRecords as Array<Record<string, unknown>>) ?? [];
      const ids = records.map((r) => r.id as string);
      return { manifests: ids };
    }) as StorageProgram<Result>;
  },
};

export const ingestManifestParserHandler = autoInterpret(_handler);
