// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Transform Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, branch, complete, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// Built-in transforms that don't require storage lookup
const BUILTIN_TRANSFORMS: Record<string, { pluginId: string; description: string }> = {
  'slugify': { pluginId: 'slugify', description: 'Convert to URL-friendly slug' },
  'strip_tags': { pluginId: 'strip_tags', description: 'Remove HTML tags' },
  'html_to_markdown': { pluginId: 'html_to_markdown', description: 'Convert HTML to Markdown' },
};

function applyTransform(pluginId: string, value: string): string {
  switch (pluginId) {
    case 'slugify': return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    case 'strip_tags': return value.replace(/<[^>]*>/g, '');
    case 'html_to_markdown':
      return value.replace(/<b>|<strong>/g, '**').replace(/<\/b>|<\/strong>/g, '**')
        .replace(/<i>|<em>/g, '*').replace(/<\/i>|<\/em>/g, '*').replace(/<[^>]*>/g, '');
    default: return value;
  }
}

const _transformHandler: FunctionalConceptHandler = {
  apply(input: Record<string, unknown>) {
    const value = input.value as string;
    const transformId = input.transformId as string;

    // Check built-in transforms first
    if (BUILTIN_TRANSFORMS[transformId]) {
      const result = applyTransform(BUILTIN_TRANSFORMS[transformId].pluginId, value);
      return complete(createProgram(), 'ok', { result }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = spGet(p, 'transform', transformId, 'transform');
    p = branch(p, 'transform',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const transform = bindings.transform as Record<string, unknown>;
          return applyTransform(transform.pluginId as string, value);
        }, 'result');
        return complete(b2, 'ok', { result: '' });
      },
      (b) => complete(b, 'notfound', { message: `Transform "${transformId}" not found` }),
    );
    return p as StorageProgram<Result>;
  },

  chain(input: Record<string, unknown>) {
    if (!input.value || (typeof input.value === 'string' && (input.value as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'value is required' }) as StorageProgram<Result>;
    }
    const value = input.value as string;
    const transformIds = input.transformIds as string;
    // Apply each transform in sequence using built-ins
    const ids = (transformIds || '').split(',').map(s => s.trim()).filter(Boolean);
    let result = value;
    for (const id of ids) {
      if (BUILTIN_TRANSFORMS[id]) {
        result = applyTransform(BUILTIN_TRANSFORMS[id].pluginId, result);
      }
    }
    return complete(createProgram(), 'ok', { result }) as StorageProgram<Result>;
  },

  preview(input: Record<string, unknown>) {
    const value = input.value as string;
    const transformId = input.transformId as string;

    // Check built-in transforms first
    if (BUILTIN_TRANSFORMS[transformId]) {
      const after = applyTransform(BUILTIN_TRANSFORMS[transformId].pluginId, value);
      return complete(createProgram(), 'ok', { before: value, after }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = spGet(p, 'transform', transformId, 'transform');
    p = branch(p, 'transform',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const transform = bindings.transform as Record<string, unknown>;
          return applyTransform(transform.pluginId as string, value);
        }, 'after');
        return complete(b2, 'ok', { before: value, after: '' });
      },
      (b) => complete(b, 'notfound', { message: `Transform "${transformId}" not found` }),
    );
    return p as StorageProgram<Result>;
  },
};

export const transformHandler = autoInterpret(_transformHandler);

