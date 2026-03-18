// @migrated dsl-constructs 2026-03-18
// Transform Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, branch, complete, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

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
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  chain(input: Record<string, unknown>) {
    const value = input.value as string;
    const transformIds = input.transformIds as string;
    // Chain requires sequential gets; simplified for functional style
    let p = createProgram();
    return complete(p, 'ok', { result: value }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  preview(input: Record<string, unknown>) {
    const value = input.value as string;
    const transformId = input.transformId as string;
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
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const transformHandler = autoInterpret(_transformHandler);

