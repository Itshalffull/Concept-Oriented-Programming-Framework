// ReactAdapter — handler.ts
// React platform adapter: normalizes widget props into React component
// representations. Classifies components as controlled vs uncontrolled,
// maps event handlers to React synthetic event conventions, and annotates
// hook dependencies (useState, useEffect, useMemo) for render optimization.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ReactAdapterStorage,
  ReactAdapterNormalizeInput,
  ReactAdapterNormalizeOutput,
} from './types.js';

import {
  normalizeOk,
  normalizeError,
} from './types.js';

export interface ReactAdapterError {
  readonly code: string;
  readonly message: string;
}

export interface ReactAdapterHandler {
  readonly normalize: (
    input: ReactAdapterNormalizeInput,
    storage: ReactAdapterStorage,
  ) => TE.TaskEither<ReactAdapterError, ReactAdapterNormalizeOutput>;
}

// --- React-specific conventions ---

/** HTML attributes that need React-specific renaming */
const HTML_TO_REACT: Readonly<Record<string, string>> = {
  'class': 'className',
  'for': 'htmlFor',
  'tabindex': 'tabIndex',
  'readonly': 'readOnly',
  'maxlength': 'maxLength',
  'minlength': 'minLength',
  'autocomplete': 'autoComplete',
  'autofocus': 'autoFocus',
  'crossorigin': 'crossOrigin',
  'novalidate': 'noValidate',
  'enctype': 'encType',
  'formaction': 'formAction',
  'formmethod': 'formMethod',
  'formtarget': 'formTarget',
  'colspan': 'colSpan',
  'rowspan': 'rowSpan',
  'cellpadding': 'cellPadding',
  'cellspacing': 'cellSpacing',
  'accesskey': 'accessKey',
  'contenteditable': 'contentEditable',
  'spellcheck': 'spellCheck',
};

/** CSS-like prop names that become React style object keys */
const CSS_STYLE_PROPS: ReadonlySet<string> = new Set([
  'background-color', 'font-size', 'font-weight', 'text-align',
  'border-radius', 'line-height', 'margin-top', 'margin-bottom',
  'padding-top', 'padding-bottom', 'flex-direction', 'align-items',
  'justify-content', 'min-width', 'max-width', 'min-height', 'max-height',
]);

/** Event handler props that React wraps in SyntheticEvent */
const EVENT_PROPS: ReadonlySet<string> = new Set([
  'onClick', 'onChange', 'onSubmit', 'onFocus', 'onBlur',
  'onKeyDown', 'onKeyUp', 'onKeyPress', 'onMouseEnter',
  'onMouseLeave', 'onScroll', 'onDrag', 'onDrop',
]);

/** Hook indicators in props signal stateful components */
const HOOK_INDICATORS: ReadonlySet<string> = new Set([
  'useState', 'useEffect', 'useMemo', 'useCallback', 'useRef', 'useReducer',
]);

const storageError = (error: unknown): ReactAdapterError => ({
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

/** Convert kebab-case CSS property to camelCase React style key */
const kebabToCamel = (s: string): string =>
  s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/** Separate CSS-like props into a style object and remaining props */
const extractStyleProps = (
  props: Readonly<Record<string, unknown>>,
): { readonly style: Record<string, unknown>; readonly rest: Record<string, unknown> } => {
  const style: Record<string, unknown> = {};
  const rest: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    if (CSS_STYLE_PROPS.has(key)) {
      style[kebabToCamel(key)] = value;
    } else {
      rest[key] = value;
    }
  }

  // Merge with any existing inline style
  if (typeof rest['style'] === 'object' && rest['style'] !== null) {
    Object.assign(style, rest['style']);
  }

  return { style, rest };
};

/** Map HTML attributes to React-specific names */
const normalizeReactAttrs = (props: Record<string, unknown>): Record<string, unknown> => {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    const reactKey = HTML_TO_REACT[key];
    result[reactKey ?? key] = value;
  }
  return result;
};

/** Detect hooks used by inspecting prop keys */
const detectHooks = (props: Readonly<Record<string, unknown>>): readonly string[] =>
  Object.keys(props).filter((k) => HOOK_INDICATORS.has(k));

/** Detect event handlers present in props */
const detectEvents = (props: Readonly<Record<string, unknown>>): readonly string[] =>
  Object.keys(props).filter((k) => EVENT_PROPS.has(k));

/** Resolve the target React element/component */
const resolveComponent = (adapter: string): string => {
  const parts = adapter.split('/');
  return parts[parts.length - 1] ?? 'div';
};

// --- Implementation ---

export const reactAdapterHandler: ReactAdapterHandler = {
  normalize: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const component = resolveComponent(input.adapter);

          return pipe(
            parseProps(input.props),
            O.fold(
              () => normalizeError(`Invalid props JSON for React adapter "${input.adapter}"`),
              (parsed) => {
                const reactAttrs = normalizeReactAttrs(parsed);
                const { style, rest } = extractStyleProps(reactAttrs);
                const hooks = detectHooks(parsed);
                const events = detectEvents(reactAttrs);
                const hasStyle = Object.keys(style).length > 0;

                const finalProps: Record<string, unknown> = { ...rest };
                if (hasStyle) finalProps['style'] = style;

                const normalized = JSON.stringify({
                  component,
                  props: finalProps,
                  platform: 'react',
                  jsx: true,
                  hooks,
                  events,
                  controlled: events.includes('onChange') && rest['value'] !== undefined,
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
                  await storage.put('reactadapter', input.adapter, {
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
