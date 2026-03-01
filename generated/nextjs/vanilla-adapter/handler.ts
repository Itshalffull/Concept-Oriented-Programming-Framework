// VanillaAdapter — handler.ts
// Vanilla JavaScript DOM adapter: normalizes widget props into plain DOM
// element representations. Produces standard HTML attributes, inline styles,
// dataset attributes, and event listener descriptors without any framework
// dependency. Targets document.createElement / setAttribute workflows.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  VanillaAdapterStorage,
  VanillaAdapterNormalizeInput,
  VanillaAdapterNormalizeOutput,
} from './types.js';

import {
  normalizeOk,
  normalizeError,
} from './types.js';

export interface VanillaAdapterError {
  readonly code: string;
  readonly message: string;
}

export interface VanillaAdapterHandler {
  readonly normalize: (
    input: VanillaAdapterNormalizeInput,
    storage: VanillaAdapterStorage,
  ) => TE.TaskEither<VanillaAdapterError, VanillaAdapterNormalizeOutput>;
}

// --- Vanilla DOM conventions ---

/** Valid HTML element tags (subset of common ones for validation) */
const HTML_ELEMENTS: ReadonlySet<string> = new Set([
  'div', 'span', 'p', 'a', 'button', 'input', 'textarea', 'select',
  'form', 'label', 'img', 'video', 'audio', 'canvas', 'table',
  'thead', 'tbody', 'tr', 'td', 'th', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'footer',
  'nav', 'main', 'section', 'article', 'aside', 'dialog',
  'details', 'summary', 'template', 'slot',
]);

/** Boolean HTML attributes (no value needed) */
const BOOLEAN_ATTRS: ReadonlySet<string> = new Set([
  'disabled', 'checked', 'readonly', 'required', 'autofocus',
  'autoplay', 'controls', 'loop', 'muted', 'hidden', 'open',
  'multiple', 'selected', 'novalidate', 'formnovalidate',
]);

/** Props that should be set as style properties, not attributes */
const STYLE_PROPS: ReadonlySet<string> = new Set([
  'color', 'background-color', 'backgroundColor', 'font-size', 'fontSize',
  'font-weight', 'fontWeight', 'text-align', 'textAlign', 'display',
  'position', 'width', 'height', 'margin', 'padding', 'border',
  'border-radius', 'borderRadius', 'opacity', 'flex', 'flex-direction',
  'flexDirection', 'align-items', 'alignItems', 'justify-content',
  'justifyContent', 'gap', 'overflow', 'cursor', 'z-index', 'zIndex',
  'box-shadow', 'boxShadow', 'transition', 'transform',
  'min-width', 'minWidth', 'max-width', 'maxWidth',
  'min-height', 'minHeight', 'max-height', 'maxHeight',
]);

/** React-style camelCase to kebab-case for CSS */
const camelToKebab = (s: string): string =>
  s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

const storageError = (error: unknown): VanillaAdapterError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

const parseProps = (raw: string): O.Option<Record<string, unknown>> => {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? O.some(parsed as Record<string, unknown>)
      : O.none;
  } catch {
    return O.none;
  }
};

/** Separate props into attributes, styles, dataset, and event listeners */
const classifyProps = (
  props: Readonly<Record<string, unknown>>,
): {
  readonly attributes: Record<string, unknown>;
  readonly style: Record<string, unknown>;
  readonly dataset: Record<string, unknown>;
  readonly eventListeners: readonly string[];
} => {
  const attributes: Record<string, unknown> = {};
  const style: Record<string, unknown> = {};
  const dataset: Record<string, unknown> = {};
  const eventListeners: string[] = [];

  for (const [key, value] of Object.entries(props)) {
    // data-* attributes -> dataset
    if (key.startsWith('data-')) {
      const dataKey = key.slice(5).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      dataset[dataKey] = value;
      continue;
    }

    // Event handlers (onClick, onchange, etc.)
    if (key.startsWith('on') && key.length > 2) {
      const eventName = key.slice(2).toLowerCase();
      eventListeners.push(eventName);
      continue;
    }

    // Style props
    if (STYLE_PROPS.has(key)) {
      const cssKey = key.includes('-') ? key : camelToKebab(key);
      style[cssKey] = value;
      continue;
    }

    // Inline style object
    if (key === 'style' && typeof value === 'object' && value !== null) {
      for (const [sk, sv] of Object.entries(value as Record<string, unknown>)) {
        const cssKey = sk.includes('-') ? sk : camelToKebab(sk);
        style[cssKey] = sv;
      }
      continue;
    }

    // React className -> class
    if (key === 'className') {
      attributes['class'] = value;
      continue;
    }

    // Boolean attributes
    if (BOOLEAN_ATTRS.has(key)) {
      if (value) attributes[key] = true;
      continue;
    }

    attributes[key] = value;
  }

  return { attributes, style, dataset, eventListeners };
};

/** Resolve HTML element from adapter string */
const resolveElement = (adapter: string): string => {
  const parts = adapter.split('/');
  const tag = (parts[parts.length - 1] ?? 'div').toLowerCase();
  return HTML_ELEMENTS.has(tag) ? tag : 'div';
};

// --- Implementation ---

export const vanillaAdapterHandler: VanillaAdapterHandler = {
  normalize: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const element = resolveElement(input.adapter);

          return pipe(
            parseProps(input.props),
            O.fold(
              () => normalizeError(`Invalid props JSON for vanilla adapter "${input.adapter}"`),
              (parsed) => {
                const { attributes, style, dataset, eventListeners } = classifyProps(parsed);
                const hasStyle = Object.keys(style).length > 0;
                const hasDataset = Object.keys(dataset).length > 0;

                const normalized = JSON.stringify({
                  element,
                  attributes,
                  ...(hasStyle ? { style } : {}),
                  ...(hasDataset ? { dataset } : {}),
                  eventListeners,
                  platform: 'vanilla',
                  runtime: 'browser',
                  framework: 'none',
                });
                return normalizeOk(input.adapter, normalized);
              },
            ),
          );
        },
        storageError,
      ),
      TE.chain((result) =>
        result.variant === 'error'
          ? TE.right(result)
          : pipe(
              TE.tryCatch(
                async () => {
                  await storage.put('vanillaadapter', input.adapter, {
                    adapter: input.adapter,
                    normalized: result.normalized,
                    timestamp: Date.now(),
                  });
                  return result;
                },
                storageError,
              ),
            ),
      ),
    ),
};
