// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// SlotSource Handler
//
// Coordination concept with pluggable providers for retrieving
// data into widget slots and props. Each provider type handles
// a different data retrieval strategy.
//
// entity_field and entity relation source types delegate through
// VariableProgram for typed access-path evaluation. If VariableProgram
// cannot resolve the expression (provider not registered, parse failure,
// etc.), the handler falls back to direct context traversal.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, find, put, complete, completeFrom, branch,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';
import { variableProgramHandler } from './variable-program/variable-program.handler.ts';
import { createInMemoryStorage } from '../../runtime/adapters/storage.ts';
import type { ConceptStorage } from '../../runtime/types.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `source-${++idCounter}`;
}

export function resetSlotSourceCounter(): void {
  idCounter = 0;
}

const _handler: FunctionalConceptHandler = {
  resolve(input: Record<string, unknown>) {
    const sourceType = input.source_type as string;
    const config = input.config as string;
    const context = input.context as string;

    let p = createProgram();
    p = find(p, 'provider', {}, 'providers');

    return completeFrom(p, 'ok', (bindings) => {
      const providers = bindings.providers as Record<string, unknown>[];
      const provider = providers.find(
        (pr: Record<string, unknown>) => pr.source_type === sourceType,
      );

      if (!provider) {
        return {
          variant: 'error',
          message: `No provider registered for source type '${sourceType}'.`,
        };
      }

      let parsedConfig: Record<string, unknown>;
      let parsedContext: Record<string, unknown>;

      try {
        parsedConfig = JSON.parse(config);
      } catch {
        return { variant: 'error', message: `Invalid config JSON: ${config}` };
      }

      try {
        parsedContext = JSON.parse(context);
      } catch {
        return { variant: 'error', message: `Invalid context JSON: ${context}` };
      }

      let data: string;

      switch (sourceType) {
        case 'static_value':
          data = String(parsedConfig.value ?? '');
          break;

        case 'entity_field': {
          const field = String(parsedConfig.field ?? '');
          const entity = parsedContext.entity as Record<string, unknown> | undefined;
          if (entity && field && field in entity) {
            const val = entity[field];
            data = val === null || val === undefined
              ? ''
              : typeof val === 'object'
                ? JSON.stringify(val)
                : String(val);
          } else if (parsedContext.entity_id) {
            data = JSON.stringify({ field, entity_id: parsedContext.entity_id });
          } else {
            data = '';
          }
          break;
        }

        case 'widget_embed':
          data = JSON.stringify({
            widget_id: parsedConfig.widget_id,
            context: parsedContext,
          });
          break;

        case 'view_embed':
          data = JSON.stringify({
            view_id: parsedConfig.view_id,
            context: parsedContext,
          });
          break;

        case 'block_embed':
          data = JSON.stringify({
            block_id: parsedConfig.block_id,
            context: parsedContext,
          });
          break;

        case 'menu':
          data = JSON.stringify({
            menu_id: parsedConfig.menu_id,
          });
          break;

        case 'formula':
          data = JSON.stringify({
            expression: parsedConfig.expression,
            context: parsedContext,
          });
          break;

        case 'entity_reference_display':
          data = JSON.stringify({
            reference_field: parsedConfig.reference_field,
            display_mode: parsedConfig.display_mode,
            entity_id: parsedContext.entity_id,
          });
          break;

        default:
          data = JSON.stringify({ config: parsedConfig, context: parsedContext });
          break;
      }

      return { data };
    }) as StorageProgram<Result>;
  },

  process(input: Record<string, unknown>) {
    const data = input.data as string;
    const processors = input.processors as string[];

    let result = data;

    for (const processor of processors) {
      switch (processor) {
        case 'truncate':
          if (result.length > 100) {
            result = result.slice(0, 100) + '...';
          }
          break;

        case 'strip_html':
          result = result.replace(/<[^>]*>/g, '');
          break;

        case 'date_format':
          break;

        case 'image_style':
          break;

        case 'fallback':
          if (!result || result === '' || result === 'null' || result === 'undefined') {
            result = '(no value)';
          }
          break;

        default:
          break;
      }
    }

    const p = createProgram();
    return complete(p, 'ok', { result }) as StorageProgram<Result>;
  },

  /**
   * Register a provider for a given source type.
   * Uses find + branch to check for duplicates, then put with a generated id.
   */
  register(input: Record<string, unknown>) {
    const sourceType = input.source_type as string;
    const provider = input.provider as string;

    let p = createProgram();
    p = find(p, 'provider', {}, 'allProviders');

    return branch(p,
      (bindings) => {
        const allProviders = bindings.allProviders as Record<string, unknown>[];
        return allProviders.some(
          (pr: Record<string, unknown>) => pr.source_type === sourceType,
        );
      },
      (thenP) => complete(thenP, 'already_registered', { source_type: sourceType }),
      (elseP) => {
        const id = nextId();
        elseP = put(elseP, 'provider', id, { id, source_type: sourceType, provider });
        return complete(elseP, 'ok', {});
      },
    ) as StorageProgram<Result>;
  },
};

// ─── VariableProgram integration ─────────────────────────────────────────────
//
// Builds a canonical VariableProgram expression for entity_field and relation
// source types. The expression uses $ctx.entity.{field} so that the ambient
// context entity is the root data source.
//
// Returns null for source types that have no VariableProgram equivalent;
// the caller falls back to direct traversal in that case.

function buildVariableProgramExpression(
  sourceType: string,
  parsedConfig: Record<string, unknown>,
): string | null {
  switch (sourceType) {
    case 'entity_field': {
      const field = String(parsedConfig.field ?? '');
      if (!field) return null;
      return `$ctx.entity.${field}`;
    }
    case 'entity_reference_display': {
      const referenceField = String(parsedConfig.reference_field ?? '');
      const displayField = String(parsedConfig.display_field ?? parsedConfig.display_mode ?? '');
      if (!referenceField) return null;
      if (displayField) {
        return `$ctx.entity.${referenceField}.${displayField}`;
      }
      return `$ctx.entity.${referenceField}`;
    }
    default:
      return null;
  }
}

/**
 * Try to resolve via VariableProgram. Returns the resolved string value on
 * success, or null if VariableProgram cannot resolve (parse error, provider
 * not registered, platform dispatch placeholder returned, etc.) so that the
 * caller can fall back to the existing direct-traversal logic.
 *
 * The context passed to VariableProgram/resolve is:
 *   { "ambient": { "entity": <contextEntity> } }
 *
 * VariableProgram's $ctx source provider reads from context.ambient.{key},
 * so $ctx.entity.title resolves from context.ambient.entity.title.
 */
async function tryResolveViaVariableProgram(
  expression: string,
  contextEntity: Record<string, unknown>,
): Promise<string | null> {
  // Fresh scratch storage — parse() stores the program; resolve() reads it back.
  const vpStorage: ConceptStorage = createInMemoryStorage();

  // Step 1 — parse the expression into a VariableProgram
  let parseResult: Record<string, unknown>;
  try {
    parseResult = await (variableProgramHandler as Record<string, Function>).parse(
      { expression },
      vpStorage,
    ) as Record<string, unknown>;
  } catch {
    return null;
  }

  if (!parseResult || parseResult.variant !== 'ok') {
    return null;
  }

  const programId = parseResult.program as string;
  const contextJson = JSON.stringify({ ambient: { entity: contextEntity } });

  // Step 2 — resolve the program against the ambient context
  let resolveResult: Record<string, unknown>;
  try {
    resolveResult = await (variableProgramHandler as Record<string, Function>).resolve(
      { program: programId, context: contextJson },
      vpStorage,
    ) as Record<string, unknown>;
  } catch {
    return null;
  }

  if (!resolveResult || resolveResult.variant !== 'ok') {
    return null;
  }

  const value = resolveResult.value as string;

  // Platform-dispatch placeholders mean VariableProgram needs a live provider
  // that is not available in the scratch storage — fall back to direct traversal.
  if (typeof value === 'string' && (value.startsWith('__provider:') || value.startsWith('__transform:'))) {
    return null;
  }

  return value;
}

// Build the base handler from autoInterpret (all actions functional).
// The resolve action is overridden with an imperative version that routes
// entity_field and relation source types through VariableProgram first,
// falling back to the original inline evaluation when VP cannot fully
// resolve the expression.
const _baseHandler = autoInterpret(_handler);

async function resolveImperative(
  input: Record<string, unknown>,
  storage: ConceptStorage,
): Promise<Record<string, unknown>> {
  const sourceType = input.source_type as string;
  const config = input.config as string;
  const context = input.context as string;

  // Fetch registered providers from storage (same as functional path)
  const providers = await storage.find('provider', {});
  const provider = providers.find(
    (pr: Record<string, unknown>) => pr.source_type === sourceType,
  );

  if (!provider) {
    return {
      variant: 'error',
      message: `No provider registered for source type '${sourceType}'.`,
    };
  }

  let parsedConfig: Record<string, unknown>;
  let parsedContext: Record<string, unknown>;

  try {
    parsedConfig = JSON.parse(config);
  } catch {
    return { variant: 'error', message: `Invalid config JSON: ${config}` };
  }

  try {
    parsedContext = JSON.parse(context);
  } catch {
    return { variant: 'error', message: `Invalid context JSON: ${context}` };
  }

  // VariableProgram delegation for entity_field and relation source types
  const vpExpression = buildVariableProgramExpression(sourceType, parsedConfig);
  if (vpExpression !== null) {
    const contextEntity = parsedContext.entity as Record<string, unknown> | undefined;
    if (contextEntity) {
      const vpValue = await tryResolveViaVariableProgram(vpExpression, contextEntity);
      if (vpValue !== null) {
        return { variant: 'ok', data: vpValue };
      }
      // VP returned null — fall through to direct-traversal fallback below
    }
  }

  // Fallback: original direct-traversal logic
  let data: string;

  switch (sourceType) {
    case 'static_value':
      data = String(parsedConfig.value ?? '');
      break;

    case 'entity_field': {
      const field = String(parsedConfig.field ?? '');
      const entity = parsedContext.entity as Record<string, unknown> | undefined;
      if (entity && field && field in entity) {
        const val = entity[field];
        data = val === null || val === undefined
          ? ''
          : typeof val === 'object'
            ? JSON.stringify(val)
            : String(val);
      } else if (parsedContext.entity_id) {
        data = JSON.stringify({ field, entity_id: parsedContext.entity_id });
      } else {
        data = '';
      }
      break;
    }

    case 'widget_embed':
      data = JSON.stringify({
        widget_id: parsedConfig.widget_id,
        context: parsedContext,
      });
      break;

    case 'view_embed':
      data = JSON.stringify({
        view_id: parsedConfig.view_id,
        context: parsedContext,
      });
      break;

    case 'block_embed':
      data = JSON.stringify({
        block_id: parsedConfig.block_id,
        context: parsedContext,
      });
      break;

    case 'menu':
      data = JSON.stringify({
        menu_id: parsedConfig.menu_id,
      });
      break;

    case 'formula':
      data = JSON.stringify({
        expression: parsedConfig.expression,
        context: parsedContext,
      });
      break;

    case 'entity_reference_display':
      data = JSON.stringify({
        reference_field: parsedConfig.reference_field,
        display_mode: parsedConfig.display_mode,
        entity_id: parsedContext.entity_id,
      });
      break;

    default:
      data = JSON.stringify({ config: parsedConfig, context: parsedContext });
      break;
  }

  return { variant: 'ok', data };
}

export const slotSourceHandler: Record<string, Function> & typeof _baseHandler = {
  ..._baseHandler,

  resolve(input: Record<string, unknown>, storage?: ConceptStorage) {
    // Functional mode — no storage provided; delegate to the functional program.
    if (storage === undefined) {
      return (_handler as Record<string, Function>).resolve(input);
    }
    // Imperative compat mode — try VariableProgram first, then fall back.
    return resolveImperative(input, storage);
  },
};
