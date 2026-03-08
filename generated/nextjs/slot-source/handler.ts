// SlotSource — Coordination concept with pluggable providers for retrieving data
// into widget slots and props. Each provider type handles a different data retrieval strategy.
// Pure fp-ts implementation: all errors flow through TaskEither left channel.

import * as TE from 'fp-ts/TaskEither';
import { pipe } from 'fp-ts/function';

import type {
  SlotSourceStorage,
  SlotSourceRegisterInput,
  SlotSourceRegisterOutput,
  SlotSourceResolveInput,
  SlotSourceResolveOutput,
  SlotSourceProcessInput,
  SlotSourceProcessOutput,
} from './types.js';

import {
  registerOk,
  registerAlreadyRegistered,
  resolveOk,
  resolveError,
  processOk,
} from './types.js';

export interface SlotSourceError {
  readonly code: string;
  readonly message: string;
}

const toStorageError = (error: unknown): SlotSourceError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

export interface SlotSourceHandler {
  readonly register: (
    input: SlotSourceRegisterInput,
    storage: SlotSourceStorage,
  ) => TE.TaskEither<SlotSourceError, SlotSourceRegisterOutput>;
  readonly resolve: (
    input: SlotSourceResolveInput,
    storage: SlotSourceStorage,
  ) => TE.TaskEither<SlotSourceError, SlotSourceResolveOutput>;
  readonly process: (
    input: SlotSourceProcessInput,
    storage: SlotSourceStorage,
  ) => TE.TaskEither<SlotSourceError, SlotSourceProcessOutput>;
}

// --- Implementation ---

let idCounter = 0;
function nextId(): string {
  return `source-${++idCounter}`;
}

export const slotSourceHandler: SlotSourceHandler = {
  register: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('provider', {}),
        toStorageError,
      ),
      TE.chain((existing) => {
        const alreadyRegistered = existing.find(
          (p) => p.source_type === input.source_type,
        );

        if (alreadyRegistered) {
          return TE.right(registerAlreadyRegistered(input.source_type));
        }

        const id = nextId();
        return TE.tryCatch(
          async () => {
            await storage.put('provider', id, {
              id,
              source_type: input.source_type,
              provider: input.provider,
            });
            return registerOk();
          },
          toStorageError,
        );
      }),
    ),

  resolve: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('provider', {}),
        toStorageError,
      ),
      TE.chain((providers) => {
        const provider = providers.find(
          (p) => p.source_type === input.source_type,
        );

        if (!provider) {
          return TE.right(
            resolveError(`No provider registered for source type '${input.source_type}'.`),
          );
        }

        // Parse config and context
        let parsedConfig: Record<string, unknown>;
        let parsedContext: Record<string, unknown>;

        try {
          parsedConfig = JSON.parse(input.config);
        } catch {
          return TE.right(resolveError(`Invalid config JSON: ${input.config}`));
        }

        try {
          parsedContext = JSON.parse(input.context);
        } catch {
          return TE.right(resolveError(`Invalid context JSON: ${input.context}`));
        }

        // Resolve based on source type
        let data: string;

        switch (input.source_type) {
          case 'static_value':
            data = String(parsedConfig.value ?? '');
            break;

          case 'entity_field':
            data = JSON.stringify({
              field: parsedConfig.field,
              entity_id: parsedContext.entity_id,
            });
            break;

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

        return TE.right(resolveOk(data));
      }),
    ),

  process: (input, _storage) =>
    pipe(
      TE.right(input),
      TE.map((inp) => {
        let result = inp.data;

        for (const processor of inp.processors) {
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
              // Pass through — in production would format dates
              break;

            case 'image_style':
              // Pass through — in production would apply image styles
              break;

            case 'fallback':
              if (!result || result === '' || result === 'null' || result === 'undefined') {
                result = '(no value)';
              }
              break;

            default:
              // Unknown processor — skip
              break;
          }
        }

        return processOk(result);
      }),
    ),
};
