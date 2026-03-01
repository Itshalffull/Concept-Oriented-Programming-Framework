// SvelteAdapter — handler.ts
// Svelte platform adapter: normalizes widget props into Svelte component
// representations. Maps props to Svelte conventions including reactive
// declarations ($:), bind: directives, on: event syntax, transition
// directives, and slot-based composition.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SvelteAdapterStorage,
  SvelteAdapterNormalizeInput,
  SvelteAdapterNormalizeOutput,
} from './types.js';

import {
  normalizeOk,
  normalizeError,
} from './types.js';

export interface SvelteAdapterError {
  readonly code: string;
  readonly message: string;
}

export interface SvelteAdapterHandler {
  readonly normalize: (
    input: SvelteAdapterNormalizeInput,
    storage: SvelteAdapterStorage,
  ) => TE.TaskEither<SvelteAdapterError, SvelteAdapterNormalizeOutput>;
}

// --- Svelte-specific conventions ---

/** Svelte built-in special elements */
const SVELTE_SPECIALS: ReadonlySet<string> = new Set([
  'svelte:self', 'svelte:component', 'svelte:element', 'svelte:window',
  'svelte:document', 'svelte:body', 'svelte:head', 'svelte:options',
  'svelte:fragment',
]);

/** Svelte transition directives */
const SVELTE_TRANSITIONS: ReadonlySet<string> = new Set([
  'fade', 'blur', 'fly', 'slide', 'scale', 'draw', 'crossfade',
]);

/** Map React-style event handlers to Svelte on: directives */
const EVENT_TO_SVELTE: Readonly<Record<string, string>> = {
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
  'onScroll': 'on:scroll',
};

/** Props that become Svelte bind: directives */
const BINDABLE_PROPS: ReadonlySet<string> = new Set([
  'value', 'checked', 'group', 'files', 'this', 'innerHTML',
  'textContent', 'clientWidth', 'clientHeight', 'scrollX', 'scrollY',
  'open', 'currentTime', 'duration', 'paused', 'volume',
]);

const storageError = (error: unknown): SvelteAdapterError => ({
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

/** Transform props into Svelte-native representations */
const transformSvelteProps = (
  props: Readonly<Record<string, unknown>>,
): {
  readonly attrs: Record<string, unknown>;
  readonly bindings: readonly string[];
  readonly events: readonly string[];
  readonly transitions: readonly string[];
} => {
  const attrs: Record<string, unknown> = {};
  const bindings: string[] = [];
  const events: string[] = [];
  const transitions: string[] = [];

  for (const [key, value] of Object.entries(props)) {
    // Map React-style events to Svelte on: syntax
    const svelteEvent = EVENT_TO_SVELTE[key];
    if (svelteEvent !== undefined) {
      attrs[svelteEvent] = value;
      events.push(svelteEvent);
      continue;
    }

    // Detect bind: candidates
    if (BINDABLE_PROPS.has(key)) {
      attrs[`bind:${key}`] = value;
      bindings.push(key);
      continue;
    }

    // Detect transition directives
    if (key === 'transition' && typeof value === 'string' && SVELTE_TRANSITIONS.has(value)) {
      transitions.push(value);
      attrs[`transition:${value}`] = true;
      continue;
    }

    // Detect in/out transitions
    if ((key === 'in' || key === 'out') && typeof value === 'string' && SVELTE_TRANSITIONS.has(value)) {
      transitions.push(`${key}:${value}`);
      attrs[`${key}:${value}`] = true;
      continue;
    }

    // React className -> Svelte class
    if (key === 'className') {
      attrs['class'] = value;
      continue;
    }

    // Svelte uses class: directive for conditional classes
    if (key.startsWith('class:')) {
      attrs[key] = value;
      continue;
    }

    attrs[key] = value;
  }

  return { attrs, bindings, events, transitions };
};

/** Resolve the Svelte component from adapter string */
const resolveComponent = (adapter: string): string => {
  const parts = adapter.split('/');
  const component = parts[parts.length - 1] ?? 'div';
  return SVELTE_SPECIALS.has(component) ? component : component;
};

// --- Implementation ---

export const svelteAdapterHandler: SvelteAdapterHandler = {
  normalize: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const component = resolveComponent(input.adapter);

          return pipe(
            parseProps(input.props),
            O.fold(
              () => normalizeError(`Invalid props JSON for Svelte adapter "${input.adapter}"`),
              (parsed) => {
                const { attrs, bindings, events, transitions } = transformSvelteProps(parsed);
                const isSpecial = SVELTE_SPECIALS.has(component);

                const normalized = JSON.stringify({
                  component,
                  props: attrs,
                  platform: 'svelte',
                  framework: 'svelte',
                  bindings,
                  events,
                  transitions,
                  specialElement: isSpecial,
                  runes: false,
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
                  await storage.put('svelteadapter', input.adapter, {
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
