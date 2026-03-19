// ============================================================
// SlotSource Handler
//
// Coordination concept with pluggable providers for retrieving
// data into widget slots and props. Each provider type handles
// a different data retrieval strategy.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `source-${++idCounter}`;
}

export function resetSlotSourceCounter(): void {
  idCounter = 0;
}

export const slotSourceHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const sourceType = input.source_type as string;
    const provider = input.provider as string;

    // Check if already registered
    const existing = await storage.find('provider', {});
    const alreadyRegistered = existing.find(
      (p: Record<string, unknown>) => p.source_type === sourceType,
    );

    if (alreadyRegistered) {
      return { variant: 'already_registered', source_type: sourceType };
    }

    const id = nextId();
    await storage.put('provider', id, {
      id,
      source_type: sourceType,
      provider,
    });

    return { variant: 'ok' };
  },

  async resolve(input: Record<string, unknown>, storage: ConceptStorage) {
    const sourceType = input.source_type as string;
    const config = input.config as string;
    const context = input.context as string;

    // Find the provider for this source type
    const providers = await storage.find('provider', {});
    const provider = providers.find(
      (p: Record<string, unknown>) => p.source_type === sourceType,
    );

    if (!provider) {
      return {
        variant: 'error',
        message: `No provider registered for source type '${sourceType}'.`,
      };
    }

    // Parse config and context
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

    // Resolve based on source type
    let data: string;

    switch (sourceType) {
      case 'static_value':
        data = String(parsedConfig.value ?? '');
        break;

      case 'entity_field':
        // In a real implementation, this would look up the entity field
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

    return { variant: 'ok', data };
  },

  async process(input: Record<string, unknown>, storage: ConceptStorage) {
    const data = input.data as string;
    const processors = input.processors as string[];

    let result = data;

    for (const processor of processors) {
      switch (processor) {
        case 'truncate':
          // Truncate to 100 chars by default
          if (result.length > 100) {
            result = result.slice(0, 100) + '...';
          }
          break;

        case 'strip_html':
          result = result.replace(/<[^>]*>/g, '');
          break;

        case 'date_format':
          // Pass through — in a real implementation would format dates
          break;

        case 'image_style':
          // Pass through — in a real implementation would apply image styles
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

    return { variant: 'ok', result };
  },
};
