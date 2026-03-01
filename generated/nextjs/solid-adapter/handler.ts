// SolidAdapter — handler.ts
// SolidJS platform adapter: normalizes widget props into SolidJS component
// representations. Maps props to SolidJS conventions including fine-grained
// reactivity signals (createSignal, createEffect, createMemo), JSX spread
// semantics, and SolidJS-specific control flow (Show, For, Switch/Match).

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SolidAdapterStorage,
  SolidAdapterNormalizeInput,
  SolidAdapterNormalizeOutput,
} from './types.js';

import {
  normalizeOk,
  normalizeError,
} from './types.js';

export interface SolidAdapterError {
  readonly code: string;
  readonly message: string;
}

export interface SolidAdapterHandler {
  readonly normalize: (
    input: SolidAdapterNormalizeInput,
    storage: SolidAdapterStorage,
  ) => TE.TaskEither<SolidAdapterError, SolidAdapterNormalizeOutput>;
}

// --- SolidJS conventions ---

/** SolidJS control flow components */
const SOLID_CONTROL_FLOW: ReadonlySet<string> = new Set([
  'Show', 'For', 'Index', 'Switch', 'Match', 'Suspense',
  'ErrorBoundary', 'Portal', 'Dynamic',
]);

/** HTML attributes that differ in SolidJS JSX compared to React */
const SOLID_ATTR_MAP: Readonly<Record<string, string>> = {
  'className': 'class',
  'htmlFor': 'for',
  'tabIndex': 'tabindex',
  'readOnly': 'readonly',
  'autoFocus': 'autofocus',
  'autoComplete': 'autocomplete',
};

/** SolidJS reactivity primitives detected in props */
const SIGNAL_INDICATORS: ReadonlySet<string> = new Set([
  'createSignal', 'createEffect', 'createMemo', 'createResource',
  'createStore', 'produce', 'reconcile',
]);

/** Event handler naming in Solid uses on: prefix for native events */
const REACT_TO_SOLID_EVENT: Readonly<Record<string, string>> = {
  'onClick': 'on:click',
  'onChange': 'on:change',
  'onInput': 'on:input',
  'onSubmit': 'on:submit',
  'onFocus': 'on:focus',
  'onBlur': 'on:blur',
  'onKeyDown': 'on:keydown',
  'onKeyUp': 'on:keyup',
  'onMouseEnter': 'on:mouseenter',
  'onMouseLeave': 'on:mouseleave',
};

const storageError = (error: unknown): SolidAdapterError => ({
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

/** Normalize React-style attributes to SolidJS equivalents */
const normalizeSolidAttrs = (props: Readonly<Record<string, unknown>>): Record<string, unknown> => {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(props)) {
    // Map React-style attrs to Solid HTML attrs
    const solidAttr = SOLID_ATTR_MAP[key];
    if (solidAttr !== undefined) {
      result[solidAttr] = value;
      continue;
    }

    // Map React-style event handlers to Solid on: syntax
    const solidEvent = REACT_TO_SOLID_EVENT[key];
    if (solidEvent !== undefined) {
      result[solidEvent] = value;
      continue;
    }

    // SolidJS supports classList={{ active: true }} instead of className logic
    if (key === 'classList' && typeof value === 'object') {
      result['classList'] = value;
      continue;
    }

    // Pass ref as-is (SolidJS uses ref similarly)
    result[key] = value;
  }

  return result;
};

/** Detect which SolidJS reactivity primitives are indicated */
const detectSignals = (props: Readonly<Record<string, unknown>>): readonly string[] =>
  Object.keys(props).filter((k) => SIGNAL_INDICATORS.has(k));

/** Detect SolidJS event handlers */
const detectEvents = (props: Record<string, unknown>): readonly string[] =>
  Object.keys(props).filter((k) => k.startsWith('on:'));

/** Resolve component from adapter string */
const resolveComponent = (adapter: string): string => {
  const parts = adapter.split('/');
  const component = parts[parts.length - 1] ?? 'div';
  return SOLID_CONTROL_FLOW.has(component) ? component : component;
};

// --- Implementation ---

export const solidAdapterHandler: SolidAdapterHandler = {
  normalize: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const component = resolveComponent(input.adapter);

          return pipe(
            parseProps(input.props),
            O.fold(
              () => normalizeError(`Invalid props JSON for SolidJS adapter "${input.adapter}"`),
              (parsed) => {
                const solidProps = normalizeSolidAttrs(parsed);
                const signals = detectSignals(parsed);
                const events = detectEvents(solidProps);
                const isControlFlow = SOLID_CONTROL_FLOW.has(component);

                const normalized = JSON.stringify({
                  component,
                  props: solidProps,
                  platform: 'solid',
                  framework: 'solidjs',
                  jsx: true,
                  signals,
                  events,
                  controlFlow: isControlFlow,
                  fineGrainedReactivity: true,
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
                  await storage.put('solidadapter', input.adapter, {
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
