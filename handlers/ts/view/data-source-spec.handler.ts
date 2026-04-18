// @clef-handler style=functional concept=DataSourceSpec
// ============================================================
// DataSourceSpec Concept Implementation — Functional (StorageProgram) style
//
// Manages named data source declarations for the view layer. Each source
// records its kind, serialized config, and the template variable names
// extracted from that config. Supports create, get, bind, and list.
//
// The bind action resolves {{varName}} template placeholders via the
// VariableProgram expression inference and resolution engine defined in
// data-source-interpolator.ts. See that module for the full mapping rules.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram,
  get,
  find,
  put,
  complete,
  completeFrom,
  branch,
  mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';
import {
  buildContextFromFlatBindings,
  interpolateDataSourceConfig,
} from './data-source-interpolator.ts';

type Result = { variant: string; [key: string]: unknown };

// --- Template variable extraction ---

function extractTemplateVars(config: string): string[] {
  const matches = config.matchAll(/\{\{(\w+)\}\}/g);
  const vars: string[] = [];
  for (const m of matches) {
    if (!vars.includes(m[1])) vars.push(m[1]);
  }
  return vars;
}

// --- Allowed kinds ---

const VALID_KINDS = new Set([
  'concept-action',
  'remote-api',
  'search-index',
  'inline',
]);

// --- Handler ---

const _handler: FunctionalConceptHandler = {

  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', { name: 'DataSourceSpec' }) as StorageProgram<Result>;
  },

  create(input: Record<string, unknown>) {
    const name = (input.name as string) ?? '';
    const kind = (input.kind as string) ?? '';
    const config = (input.config as string) ?? '';

    // Validate name
    if (!name || name.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'name is required',
      }) as StorageProgram<Result>;
    }

    // Validate kind
    if (!VALID_KINDS.has(kind)) {
      return complete(createProgram(), 'error', {
        message: `kind must be one of: ${[...VALID_KINDS].join(', ')}`,
      }) as StorageProgram<Result>;
    }

    // Validate config is parseable JSON
    let parsedConfig: unknown;
    try {
      parsedConfig = JSON.parse(config);
    } catch {
      return complete(createProgram(), 'error', {
        message: 'config must be valid JSON',
      }) as StorageProgram<Result>;
    }
    void parsedConfig; // config is valid; we store the original string

    const parameters = extractTemplateVars(config);

    let p = createProgram();
    p = get(p, 'source', name, 'existing');

    return branch(
      p,
      'existing',
      // existing != null — duplicate
      (b) =>
        completeFrom(b, 'duplicate', (bindings) => ({
          source: (bindings.existing as Record<string, unknown>).name as string,
        })),
      // existing == null — store and return ok
      (b) => {
        const b2 = put(b, 'source', name, { name, kind, config, parameters });
        return complete(b2, 'ok', { source: name });
      },
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const name = (input.name as string) ?? '';

    let p = createProgram();
    p = get(p, 'source', name, 'existing');

    return branch(
      p,
      'existing',
      (b) =>
        completeFrom(b, 'ok', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return {
            source: existing.name as string,
            kind: existing.kind as string,
            config: existing.config as string,
            parameters: JSON.stringify(existing.parameters ?? []),
          };
        }),
      (b) =>
        complete(b, 'notfound', {
          message: `No data source with name "${name}" found`,
        }),
    ) as StorageProgram<Result>;
  },

  bind(input: Record<string, unknown>) {
    const name = (input.name as string) ?? '';
    const bindingsJson = (input.bindings as string) ?? '';

    // Validate bindings is parseable JSON before any storage ops
    let bindingsMap: Record<string, string>;
    try {
      bindingsMap = JSON.parse(bindingsJson) as Record<string, string>;
    } catch {
      return complete(createProgram(), 'error', {
        message: 'bindings must be valid JSON',
      }) as StorageProgram<Result>;
    }

    // Capture for use in mapBindings closure
    const capturedBindings = bindingsMap;

    let p = createProgram();
    p = get(p, 'source', name, 'existing');

    return branch(
      p,
      'existing',
      // Source found — resolve template variables via VariableProgram engine
      (b) => {
        let b2 = mapBindings(
          b,
          (bindings) => {
            const existing = bindings.existing as Record<string, unknown>;
            const rawConfig = existing.config as string;
            // Build a VariableResolutionContext from the flat bindings map, then
            // interpolate every {{varName}} token using VariableProgram expression
            // inference and resolution. Tokens that cannot be resolved are left
            // unreplaced for backward compatibility.
            const ctx = buildContextFromFlatBindings(capturedBindings);
            return interpolateDataSourceConfig(rawConfig, ctx);
          },
          'resolvedConfig',
        );

        return completeFrom(b2, 'ok', (bindings) => ({
          source: name,
          config: bindings.resolvedConfig as string,
        }));
      },
      // Source not found
      (b) =>
        complete(b, 'notfound', {
          message: `No data source with name "${name}" found`,
        }),
    ) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'source', {}, 'allSources');
    return completeFrom(p, 'ok', (bindings) => {
      const allSources = (bindings.allSources as Array<Record<string, unknown>>) ?? [];
      const entries = allSources.map((s) => ({
        name: s.name,
        kind: s.kind,
        config: s.config,
        parameters: s.parameters ?? [],
      }));
      return { sources: JSON.stringify(entries) };
    }) as StorageProgram<Result>;
  },
};

export const dataSourceSpecHandler = autoInterpret(_handler);
