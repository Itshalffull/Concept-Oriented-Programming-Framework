// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// BrowserAdapter Handler
//
// Transforms framework-neutral props into browser Web API bindings:
// addEventListener, DOM events, Web Components attributes.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, put, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _browserAdapterHandler: FunctionalConceptHandler = {
  normalize(input: Record<string, unknown>) {
    const adapter = input.adapter as string;
    const props = input.props as string;

    if (!props || props.trim() === '') {
      let p = createProgram();
      return complete(p, 'error', { message: 'Props cannot be empty' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(props);
    } catch {
      let p = createProgram();
      return complete(p, 'error', { message: 'Props must be valid JSON' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const normalized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(parsed)) {
      if (key.startsWith('aria-') || key.startsWith('data-')) {
        normalized[key] = value;
        continue;
      }
      if (key === 'class') {
        const classes = typeof value === 'string' ? value.split(/\s+/).filter(Boolean) : value;
        normalized['classList'] = classes;
        continue;
      }
      if (key.startsWith('on')) {
        const eventType = key.slice(2).toLowerCase();
        normalized[`addEventListener:${eventType}`] = {
          addEventListener: { type: eventType, listener: value },
        };
        continue;
      }
      if (key === 'style') {
        normalized['style'] = { __cssStyleDeclaration: true, value };
        continue;
      }
      if (key === 'slot') {
        normalized['slot'] = value;
        continue;
      }
      if (key === 'part') {
        normalized['part'] = value;
        continue;
      }
      normalized[key] = { setAttribute: { name: key, value } };
    }

    let p = createProgram();
    p = put(p, 'output', adapter, { adapter, normalized: JSON.stringify(normalized) });
    return complete(p, 'ok', { adapter, normalized: JSON.stringify(normalized) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const browserAdapterHandler = autoInterpret(_browserAdapterHandler);

