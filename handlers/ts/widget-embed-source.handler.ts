// @migrated dsl-constructs 2026-03-18
// ============================================================
// WidgetEmbedSource Handler
//
// SlotSource provider that embeds another widget's rendered output.
// Registers with PluginRegistry under slot_source_provider.
// See Architecture doc Section 16.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `wes-${++idCounter}`;
}

let registered = false;

const _handler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    if (registered) {
      const p = createProgram();
      return complete(p, 'already_registered', {}) as StorageProgram<Result>;
    }

    registered = true;
    let p = createProgram();
    p = put(p, 'widget-embed-source', '__registered', { value: true });

    return complete(p, 'ok', { provider_name: 'widget_embed' }) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const widgetId = input.widget_id as string;
    const widgetProps = input.widget_props as string;
    const renderMode = input.render_mode as string | undefined;
    const context = input.context as string;

    if (!widgetId) {
      const p = createProgram();
      return complete(p, 'error', { message: 'widget_id is required' }) as StorageProgram<Result>;
    }

    // Parse widget props
    let parsedProps: Record<string, unknown>;
    try {
      parsedProps = JSON.parse(widgetProps || '{}');
    } catch {
      const p = createProgram();
      return complete(p, 'error', { message: `Invalid widget_props JSON: ${widgetProps}` }) as StorageProgram<Result>;
    }

    // Parse context
    let parsedContext: Record<string, unknown>;
    try {
      parsedContext = JSON.parse(context || '{}');
    } catch {
      const p = createProgram();
      return complete(p, 'error', { message: `Invalid context JSON: ${context}` }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'widget', widgetId, 'widget');

    return branch(p, 'widget',
      (thenP) => {
        const mode = renderMode || 'inline';
        const id = nextId();
        thenP = put(thenP, 'widget-embed-source', id, {
          id,
          widget_id: widgetId,
          widget_props: widgetProps,
          render_mode: mode,
          createdAt: new Date().toISOString(),
        });

        const data = JSON.stringify({
          widget_id: widgetId,
          props: parsedProps,
          render_mode: mode,
          context: parsedContext,
          rendered: true,
        });

        return complete(thenP, 'ok', { data });
      },
      (elseP) => complete(elseP, 'widget_not_found', { widget_id: widgetId }),
    ) as StorageProgram<Result>;
  },
};

export const widgetEmbedSourceHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetWidgetEmbedSource(): void {
  idCounter = 0;
  registered = false;
}
