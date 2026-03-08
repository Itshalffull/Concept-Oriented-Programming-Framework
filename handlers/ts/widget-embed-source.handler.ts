// ============================================================
// WidgetEmbedSource Handler
//
// SlotSource provider that embeds another widget's rendered output.
// Registers with PluginRegistry under slot_source_provider.
// See Architecture doc Section 16.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `wes-${++idCounter}`;
}

let registered = false;

export const widgetEmbedSourceHandler: ConceptHandler = {
  async register(_input: Record<string, unknown>, storage: ConceptStorage) {
    if (registered) {
      return { variant: 'already_registered' };
    }

    registered = true;
    await storage.put('widget-embed-source', '__registered', { value: true });

    return { variant: 'ok', provider_name: 'widget_embed' };
  },

  async resolve(input: Record<string, unknown>, storage: ConceptStorage) {
    const widgetId = input.widget_id as string;
    const widgetProps = input.widget_props as string;
    const renderMode = input.render_mode as string | undefined;
    const context = input.context as string;

    if (!widgetId) {
      return { variant: 'error', message: 'widget_id is required' };
    }

    // Parse widget props
    let parsedProps: Record<string, unknown>;
    try {
      parsedProps = JSON.parse(widgetProps || '{}');
    } catch {
      return { variant: 'error', message: `Invalid widget_props JSON: ${widgetProps}` };
    }

    // Parse context
    let parsedContext: Record<string, unknown>;
    try {
      parsedContext = JSON.parse(context || '{}');
    } catch {
      return { variant: 'error', message: `Invalid context JSON: ${context}` };
    }

    // Look up the widget definition
    const widget = await storage.get('widget', widgetId);
    if (!widget) {
      return { variant: 'widget_not_found', widget_id: widgetId };
    }

    // Simulate widget rendering — in production this delegates to the
    // widget render pipeline
    const mode = renderMode || 'inline';
    const data = JSON.stringify({
      widget_id: widgetId,
      props: parsedProps,
      render_mode: mode,
      context: parsedContext,
      rendered: true,
    });

    const id = nextId();
    await storage.put('widget-embed-source', id, {
      id,
      widget_id: widgetId,
      widget_props: widgetProps,
      render_mode: mode,
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok', data };
  },
};

/** Reset internal state. Useful for testing. */
export function resetWidgetEmbedSource(): void {
  idCounter = 0;
  registered = false;
}
