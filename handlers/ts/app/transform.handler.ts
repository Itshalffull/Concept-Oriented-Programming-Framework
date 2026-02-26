// Transform Concept Implementation
import type { ConceptHandler } from '@clef/kernel';

export const transformHandler: ConceptHandler = {
  async apply(input, storage) {
    const value = input.value as string;
    const transformId = input.transformId as string;

    const transform = await storage.get('transform', transformId);
    if (!transform) {
      return { variant: 'notfound', message: `Transform "${transformId}" not found` };
    }

    // Plugin-dispatched to transform_plugin provider
    const pluginId = transform.pluginId as string;
    let result = value;

    switch (pluginId) {
      case 'slugify':
        result = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        break;
      case 'strip_tags':
        result = value.replace(/<[^>]*>/g, '');
        break;
      case 'html_to_markdown':
        result = value
          .replace(/<b>|<strong>/g, '**')
          .replace(/<\/b>|<\/strong>/g, '**')
          .replace(/<i>|<em>/g, '*')
          .replace(/<\/i>|<\/em>/g, '*')
          .replace(/<[^>]*>/g, '');
        break;
      case 'type_cast':
      case 'default_value':
      case 'lookup':
      case 'concat':
      case 'split':
      case 'format':
      case 'truncate':
      case 'regex_replace':
      case 'date_format':
      case 'json_extract':
      case 'expression':
        // Delegate to registered provider at runtime
        break;
    }

    return { variant: 'ok', result };
  },

  async chain(input, storage) {
    const value = input.value as string;
    const transformIds = input.transformIds as string;

    const ids = transformIds.split(',').map(id => id.trim()).filter(Boolean);
    let current = value;

    for (const id of ids) {
      const transform = await storage.get('transform', id);
      if (!transform) {
        return { variant: 'error', message: `Transform "${id}" not found`, failedAt: id };
      }

      // Apply each transform in sequence
      const pluginId = transform.pluginId as string;
      switch (pluginId) {
        case 'slugify':
          current = current.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
          break;
        case 'strip_tags':
          current = current.replace(/<[^>]*>/g, '');
          break;
        default:
          break;
      }
    }

    return { variant: 'ok', result: current };
  },

  async preview(input, storage) {
    const value = input.value as string;
    const transformId = input.transformId as string;

    const transform = await storage.get('transform', transformId);
    if (!transform) {
      return { variant: 'notfound', message: `Transform "${transformId}" not found` };
    }

    // Run apply internally for preview
    const pluginId = transform.pluginId as string;
    let after = value;

    switch (pluginId) {
      case 'slugify':
        after = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        break;
      case 'strip_tags':
        after = value.replace(/<[^>]*>/g, '');
        break;
      default:
        break;
    }

    return { variant: 'ok', before: value, after };
  },
};
