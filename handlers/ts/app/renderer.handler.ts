// @migrated dsl-constructs 2026-03-18
// Renderer Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';

const rendererHandlerFunctional: FunctionalConceptHandler = {
  render(input: Record<string, unknown>) {
    const renderer = input.renderer as string;
    const tree = input.tree as string;

    let p = createProgram();

    if (!tree) {
      return complete(p, 'error', { message: 'Render tree is required' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    p = spGet(p, 'renderer', renderer, 'existing');

    p = put(p, 'renderer', renderer, {
      renderer,
      renderTree: tree,
      placeholders: JSON.stringify({}),
      cacheability: '{}',
    });

    return complete(p, 'ok', { output: tree }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  autoPlaceholder(input: Record<string, unknown>) {
    const renderer = input.renderer as string;
    const name = input.name as string;

    const placeholder = `{{${name}}}`;

    let p = createProgram();
    p = spGet(p, 'renderer', renderer, 'existing');

    p = put(p, 'renderer', renderer, {
      renderer,
      renderTree: '',
      placeholders: JSON.stringify({ [name]: '' }),
      cacheability: '{}',
    });

    return complete(p, 'ok', { placeholder }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  stream(input: Record<string, unknown>) {
    const renderer = input.renderer as string;
    const tree = input.tree as string;

    let p = createProgram();

    if (!tree) {
      return complete(p, 'error', { message: 'Render tree is required for streaming' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const streamId = `stream-${renderer}-${Date.now()}`;

    p = put(p, 'renderer', renderer, {
      renderer,
      renderTree: tree,
      placeholders: '{}',
      cacheability: '{}',
    });

    return complete(p, 'ok', { streamId }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  mergeCacheability(input: Record<string, unknown>) {
    const renderer = input.renderer as string;
    const tags = input.tags as string;

    let p = createProgram();
    p = spGet(p, 'renderer', renderer, 'existing');

    const incomingTags = JSON.parse(tags || '{}');

    p = put(p, 'renderer', renderer, {
      renderer,
      renderTree: '',
      placeholders: '{}',
      cacheability: JSON.stringify(incomingTags),
    });

    return complete(p, 'ok', { merged: JSON.stringify(incomingTags) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  renderField(input: Record<string, unknown>) {
    const field = input.field as string;
    const formatter = input.formatter as string;
    const formatterOptions = input.formatter_options as string | null;
    const context = input.context as string;

    let p = createProgram();
    return complete(p, 'ok', {
      field,
      formatter,
      formatter_options: formatterOptions,
      context,
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

/** Backward-compatible imperative wrapper — delegates to interpret(). */
export const rendererHandler = wrapFunctional(rendererHandlerFunctional);
/** The raw functional handler returning StorageProgram. */
export { rendererHandlerFunctional };
