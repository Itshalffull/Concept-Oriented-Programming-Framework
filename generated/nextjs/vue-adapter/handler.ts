// VueAdapter — handler.ts
// Vue 3 Composition API adapter: normalizes widget props into Vue component
// representations. Maps props to Vue conventions including v-bind, v-on event
// syntax, v-model bindings, Composition API reactivity (ref, computed, watch),
// and template directive annotations (v-if, v-for, v-show).

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  VueAdapterStorage,
  VueAdapterNormalizeInput,
  VueAdapterNormalizeOutput,
} from './types.js';

import {
  normalizeOk,
  normalizeError,
} from './types.js';

export interface VueAdapterError {
  readonly code: string;
  readonly message: string;
}

export interface VueAdapterHandler {
  readonly normalize: (
    input: VueAdapterNormalizeInput,
    storage: VueAdapterStorage,
  ) => TE.TaskEither<VueAdapterError, VueAdapterNormalizeOutput>;
}

// --- Vue 3 conventions ---

/** Vue built-in components */
const VUE_BUILTINS: ReadonlySet<string> = new Set([
  'Transition', 'TransitionGroup', 'KeepAlive', 'Teleport',
  'Suspense', 'component', 'slot',
]);

/** Map React-style event handlers to Vue v-on shorthand */
const EVENT_TO_VUE: Readonly<Record<string, string>> = {
  'onClick': '@click',
  'onChange': '@change',
  'onInput': '@input',
  'onSubmit': '@submit',
  'onFocus': '@focus',
  'onBlur': '@blur',
  'onKeyDown': '@keydown',
  'onKeyUp': '@keyup',
  'onKeyPress': '@keypress',
  'onMouseEnter': '@mouseenter',
  'onMouseLeave': '@mouseleave',
  'onScroll': '@scroll',
};

/** Props that become v-model bindings */
const VMODEL_PROPS: ReadonlySet<string> = new Set([
  'value', 'modelValue', 'checked', 'selected',
]);

/** Vue template directives (recognized in props) */
const VUE_DIRECTIVES: ReadonlySet<string> = new Set([
  'v-if', 'v-else-if', 'v-else', 'v-for', 'v-show', 'v-html',
  'v-text', 'v-slot', 'v-pre', 'v-once', 'v-memo', 'v-cloak',
]);

/** Composition API reactivity indicators */
const COMPOSITION_INDICATORS: ReadonlySet<string> = new Set([
  'ref', 'reactive', 'computed', 'watch', 'watchEffect',
  'toRef', 'toRefs', 'shallowRef', 'shallowReactive',
  'provide', 'inject', 'defineProps', 'defineEmits',
]);

const storageError = (error: unknown): VueAdapterError => ({
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

/** Transform generic props into Vue-native representations */
const transformVueProps = (
  props: Readonly<Record<string, unknown>>,
): {
  readonly attrs: Record<string, unknown>;
  readonly events: readonly string[];
  readonly directives: readonly string[];
  readonly vmodels: readonly string[];
  readonly compositionAPIs: readonly string[];
} => {
  const attrs: Record<string, unknown> = {};
  const events: string[] = [];
  const directives: string[] = [];
  const vmodels: string[] = [];
  const compositionAPIs: string[] = [];

  for (const [key, value] of Object.entries(props)) {
    // Map React-style events to Vue @event syntax
    const vueEvent = EVENT_TO_VUE[key];
    if (vueEvent !== undefined) {
      attrs[vueEvent] = value;
      events.push(vueEvent);
      continue;
    }

    // Detect v-model candidates
    if (VMODEL_PROPS.has(key)) {
      const modelName = key === 'value' || key === 'modelValue' ? 'v-model' : `v-model:${key}`;
      attrs[modelName] = value;
      vmodels.push(modelName);
      continue;
    }

    // Pass through Vue directives directly
    if (VUE_DIRECTIVES.has(key)) {
      attrs[key] = value;
      directives.push(key);
      continue;
    }

    // Detect Composition API usage
    if (COMPOSITION_INDICATORS.has(key)) {
      compositionAPIs.push(key);
      continue;
    }

    // React className -> Vue class (supports both string and object)
    if (key === 'className') {
      attrs['class'] = value;
      continue;
    }

    // Dynamic binding indicator (:prop)
    if (key.startsWith(':') || key.startsWith('v-bind:')) {
      attrs[key] = value;
      continue;
    }

    attrs[key] = value;
  }

  return { attrs, events, directives, vmodels, compositionAPIs };
};

/** Resolve Vue component name from adapter string */
const resolveComponent = (adapter: string): string => {
  const parts = adapter.split('/');
  const component = parts[parts.length - 1] ?? 'div';
  return VUE_BUILTINS.has(component) ? component : component;
};

// --- Implementation ---

export const vueAdapterHandler: VueAdapterHandler = {
  normalize: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const component = resolveComponent(input.adapter);

          return pipe(
            parseProps(input.props),
            O.fold(
              () => normalizeError(`Invalid props JSON for Vue adapter "${input.adapter}"`),
              (parsed) => {
                const { attrs, events, directives, vmodels, compositionAPIs } =
                  transformVueProps(parsed);

                const normalized = JSON.stringify({
                  component,
                  props: attrs,
                  platform: 'vue',
                  framework: 'vue3',
                  compositionAPI: true,
                  events,
                  directives,
                  vmodels,
                  compositionAPIs,
                  sfc: true,
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
                  await storage.put('vueadapter', input.adapter, {
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
