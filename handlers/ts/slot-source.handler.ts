// @migrated dsl-constructs 2026-03-18
// ============================================================
// SlotSource Handler
//
// Coordination concept with pluggable providers for retrieving
// data into widget slots and props. Each provider type handles
// a different data retrieval strategy.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, find, put, complete, completeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `source-${++idCounter}`;
}

export function resetSlotSourceCounter(): void {
  idCounter = 0;
}

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const sourceType = input.source_type as string;
    const provider = input.provider as string;

    let p = createProgram();
    p = find(p, 'provider', {}, 'existing');

    return completeFrom(p, 'ok', (bindings) => {
      const existing = bindings.existing as Record<string, unknown>[];
      const alreadyRegistered = existing.find(
        (pr: Record<string, unknown>) => pr.source_type === sourceType,
      );

      if (alreadyRegistered) {
        return { variant: 'already_registered', source_type: sourceType };
      }

      return {};
    }) as StorageProgram<Result>;
  },

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
};

export const slotSourceHandler = autoInterpret(_handler);
