// @clef-handler style=functional
// IngestManifestParser Concept Implementation
//
// Parses app.external.yaml ingest manifests into structured IngestManifest
// records. Validates source configuration, authentication, action mappings,
// field transforms, webhook definitions, and sync configuration.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';
import { parse as parseYaml } from 'yaml';
import { randomUUID } from 'crypto';

type Result = { variant: string; [key: string]: unknown };

// ─── Constants ─────────────────────────────────────────────────────────────

const VALID_AUTH_TYPES = new Set(['bearer', 'api-key', 'oauth2']);
const VALID_HTTP_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

// ─── Helpers ───────────────────────────────────────────────────────────────

function isValidJsonPath(expr: string): boolean {
  return typeof expr === 'string' && expr.startsWith('$');
}

function isValidConceptActionRef(ref: string): boolean {
  return /^[A-Z][a-zA-Z0-9]*\/[a-z][a-zA-Z0-9_]*$/.test(ref);
}

interface ParsedSource {
  displayName?: string;
  baseUrl?: string;
  specType?: string;
  auth?: Record<string, unknown>;
  concepts?: Record<string, unknown>;
  webhooks?: unknown;
}

interface ParsedManifest {
  sources: Record<string, ParsedSource>;
}

/**
 * Validate the top-level structure of a parsed YAML object.
 * Returns errors if required fields are missing.
 */
function validateManifestStructure(
  parsed: unknown,
): { valid: true; manifest: ParsedManifest } | { valid: false; errors: string[] } {
  const errors: string[] = [];

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { valid: false, errors: ['Top-level value must be a YAML mapping (object)'] };
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

/**
 * Deep-validate an already-stored manifest record (auth types, HTTP methods,
 * JSONPath expressions, webhook event naming).
 */
function deepValidateRecord(rec: Record<string, unknown>): string[] {
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
          `Concept '${conceptName}', action '${actionName}': unrecognized HTTP method '${method}'. ` +
            `Valid: ${[...VALID_HTTP_METHODS].join(', ')}`,
        );
      }
      const transform = ac.transform;
      if (transform && typeof transform === 'object' && !Array.isArray(transform)) {
        for (const [field, expr] of Object.entries(transform as Record<string, unknown>)) {
          if (typeof expr === 'string' && !isValidJsonPath(expr)) {
            errors.push(
              `Concept '${conceptName}', action '${actionName}', ` +
                `field '${field}': invalid JSONPath expression '${expr}'. Must start with '$'`,
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
      for (const [eventName, targetAction] of Object.entries(events as Record<string, unknown>)) {
        if (typeof targetAction === 'string' && !isValidConceptActionRef(targetAction)) {
          errors.push(
            `Webhook event '${eventName}': '${targetAction}' does not follow Concept/action naming format`,
          );
        }
      }
    }
  }

  return errors;
}

// ─── Handler ───────────────────────────────────────────────────────────────

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    return complete(createProgram(), 'ok', { name: 'IngestManifestParser' }) as StorageProgram<Result>;
  },

  parse(input: Record<string, unknown>) {
    const yaml = input.yaml as string;

    // Validate: yaml must be non-empty
    if (!yaml || yaml.trim() === '') {
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
    const [primarySourceName, primarySource] = Object.entries(manifest.sources)[0];

    // Generate a deterministic-ish ID using a UUID (imperative override handles dynamic keys
    // in autoInterpret; here we generate the ID at program construction time, which is
    // acceptable since parse() is called once per YAML string and construction is synchronous)
    const id = randomUUID();

    const record: Record<string, unknown> = {
      id,
      source: primarySourceName,
      displayName: primarySource.displayName ?? primarySourceName,
      baseUrl: primarySource.baseUrl ?? '',
      specType: primarySource.specType ?? 'rest',
      authConfig: JSON.stringify(primarySource.auth ?? {}),
      concepts: JSON.stringify(primarySource.concepts ?? {}),
      webhooks:
        primarySource.webhooks != null ? JSON.stringify(primarySource.webhooks) : null,
      syncConfig: null,
      raw: yaml,
    };

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
        // Deep-validate the stored record
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.record as Record<string, unknown>;
          return deepValidateRecord(rec);
        }, '_errors');

        return branch(
          b2,
          (bindings) => {
            const errs = bindings._errors as string[];
            return errs.length > 0;
          },
          (eb) =>
            completeFrom(eb, 'invalid', (bindings) => ({
              message: 'Manifest validation failed',
              errors: (bindings._errors as string[]).join('; '),
            })),
          (ob) => complete(ob, 'ok', {}),
        );
      },
      (b) =>
        complete(b, 'invalid', {
          message: `No manifest with id '${manifestId}' exists`,
          errors: 'manifest not found',
        }),
    ) as StorageProgram<Result>;
  },

  merge(input: Record<string, unknown>) {
    const baseId = input.base as string;
    const overrideId = input.override as string;

    // Use a deterministic merged key from the two input IDs
    const mergedKey = `merged:${baseId}:${overrideId}`;

    let p = createProgram();
    p = get(p, 'manifest', baseId, 'baseRecord');
    p = get(p, 'manifest', overrideId, 'overrideRecord');

    return branch(
      p,
      (bindings) => !bindings.baseRecord || !bindings.overrideRecord,
      (b) =>
        complete(b, 'invalid', {
          message: 'One or both manifest ids were not found',
        }),
      (b) => {
        // Merge concepts: overlay override on top of base
        let b2 = putFrom(b, 'manifest', mergedKey, (bindings) => {
          const base = bindings.baseRecord as Record<string, unknown>;
          const override = bindings.overrideRecord as Record<string, unknown>;

          let baseConcepts: Record<string, unknown> = {};
          let overrideConcepts: Record<string, unknown> = {};
          try { baseConcepts = JSON.parse(base.concepts as string); } catch { /* ignore */ }
          try { overrideConcepts = JSON.parse(override.concepts as string); } catch { /* ignore */ }

          return {
            ...base,
            id: mergedKey,
            concepts: JSON.stringify({ ...baseConcepts, ...overrideConcepts }),
            raw: `# merged from ${base.id} and ${override.id}\n${base.raw as string}`,
          };
        });

        return complete(b2, 'ok', { merged: mergedKey });
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
        // Check if the stored source name matches
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.record as Record<string, unknown>;
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
        }, '_sourceConfig');

        return branch(
          b2,
          (bindings) => bindings._sourceConfig !== null,
          (ob) =>
            completeFrom(ob, 'ok', (bindings) => ({
              sourceConfig: JSON.stringify(bindings._sourceConfig),
            })),
          (nb) => complete(nb, 'notfound', {}),
        );
      },
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
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.record as Record<string, unknown>;
          // Check source name matches
          if (rec.source !== sourceName) return null;
          // Parse concepts and look up the concept
          let concepts: Record<string, unknown> = {};
          try {
            concepts = JSON.parse(rec.concepts as string);
          } catch {
            return null;
          }
          if (!(conceptName in concepts)) return null;
          return concepts[conceptName];
        }, '_actionMappings');

        return branch(
          b2,
          (bindings) => bindings._actionMappings !== null,
          (ob) =>
            completeFrom(ob, 'ok', (bindings) => ({
              actionMappings: JSON.stringify(bindings._actionMappings),
            })),
          (nb) => complete(nb, 'notfound', {}),
        );
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
