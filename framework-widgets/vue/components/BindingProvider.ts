// ============================================================
// BindingProvider — Vue 3 Component
//
// Provide/inject for COIF concept binding. Creates a reactive
// signal map that descendant components can consume. Bridges
// COIF WritableSignals into Vue refs so that changes propagate
// through Vue's reactivity system.
// ============================================================

import {
  defineComponent,
  h,
  ref,
  reactive,
  provide,
  onMounted,
  onUnmounted,
  watch,
  type Ref,
  type InjectionKey,
  type PropType,
  type VNode,
} from 'vue';

import type {
  BindingConfig,
  BindingMode,
  Signal,
  WritableSignal,
} from '../../shared/types.js';

// --- Injection types ---

export interface BindingContext {
  /** The concept name this binding serves */
  concept: string;
  /** Binding mode */
  mode: BindingMode;
  /** Reactive refs keyed by signal name */
  values: Record<string, Ref<unknown>>;
  /** Update a signal value */
  setValue: (name: string, value: unknown) => void;
  /** Read a signal value */
  getValue: (name: string) => unknown;
  /** Subscribe to a signal */
  subscribe: (name: string, listener: (value: unknown) => void) => (() => void) | undefined;
}

export const BINDING_KEY: InjectionKey<BindingContext> = Symbol('coif-binding');

// --- Component ---

export const BindingProvider = defineComponent({
  name: 'BindingProvider',

  props: {
    /** Binding configuration with concept name, mode, and signal map */
    config: {
      type: Object as PropType<BindingConfig>,
      required: true,
    },
    /** HTML wrapper tag */
    tag: {
      type: String as PropType<string>,
      default: 'div',
    },
    /** Initial values to seed the reactive signal map */
    initialValues: {
      type: Object as PropType<Record<string, unknown>>,
      default: () => ({}),
    },
  },

  emits: {
    /** Emitted when any signal value changes */
    'signal-change': (_payload: { name: string; value: unknown }) => true,
  },

  setup(props, { slots, emit }) {
    // Internal map of COIF signals (from config or freshly created)
    const signalMap = new Map<string, Signal | WritableSignal>();

    // Reactive Vue refs mirroring each signal's current value
    const values = reactive<Record<string, Ref<unknown>>>({});

    // Cleanup functions for subscriptions
    const unsubscribers: (() => void)[] = [];

    // Initialize signals from config.signalMap, create Vue ref mirrors
    function initSignals(): void {
      for (const [name, signal] of Object.entries(props.config.signalMap)) {
        signalMap.set(name, signal);

        // Create a Vue ref initialized from the signal's current value
        const initial = props.initialValues[name] ?? signal.get();
        const vueRef = ref(initial);
        values[name] = vueRef;

        // Subscribe to COIF signal changes -> update Vue ref
        const unsub = signal.subscribe((newValue: unknown) => {
          vueRef.value = newValue;
          emit('signal-change', { name, value: newValue });
        });
        unsubscribers.push(unsub);

        // Watch Vue ref changes -> push back to writable signals
        if (isWritable(signal)) {
          watch(vueRef, (newVal) => {
            if (newVal !== signal.get()) {
              (signal as WritableSignal).set(newVal);
            }
          });
        }
      }
    }

    function isWritable(signal: Signal): signal is WritableSignal {
      return typeof (signal as WritableSignal).set === 'function';
    }

    // --- Public API for descendants ---

    function setValue(name: string, value: unknown): void {
      const signal = signalMap.get(name);
      if (signal && isWritable(signal)) {
        (signal as WritableSignal).set(value);
      }
      if (values[name]) {
        values[name].value = value;
      }
    }

    function getValue(name: string): unknown {
      const vueRef = values[name];
      return vueRef ? vueRef.value : undefined;
    }

    function subscribe(name: string, listener: (value: unknown) => void): (() => void) | undefined {
      const signal = signalMap.get(name);
      if (signal) {
        return signal.subscribe(listener);
      }
      return undefined;
    }

    // Build and provide the binding context
    const context: BindingContext = reactive({
      concept: props.config.concept,
      mode: props.config.mode,
      values,
      setValue,
      getValue,
      subscribe,
    });

    provide(BINDING_KEY, context);

    onMounted(() => {
      initSignals();
    });

    onUnmounted(() => {
      for (const unsub of unsubscribers) {
        unsub();
      }
      unsubscribers.length = 0;
      signalMap.clear();
    });

    return (): VNode =>
      h(
        props.tag,
        {
          class: 'coif-binding-provider',
          'data-concept': props.config.concept,
          'data-binding-mode': props.config.mode,
        },
        slots.default?.({
          values,
          setValue,
          getValue,
        }),
      );
  },
});

export default BindingProvider;
