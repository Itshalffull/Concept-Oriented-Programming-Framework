// ============================================================
// WidgetMachine — Vue 3 Component
//
// Spawns a headless Clef Surface state machine and connects its state
// to Vue's reactivity system. Exposes machine state, connected
// props, and a send() method to descendant components through
// provide/inject. Uses Vue-specific v-on event handler format
// and class binding objects in the render output.
// ============================================================

import {
  defineComponent,
  h,
  ref,
  reactive,
  computed,
  watch,
  provide,
  onMounted,
  onUnmounted,
  type InjectionKey,
  type PropType,
  type VNode,
} from 'vue';

import type {
  WidgetSpec,
  MachineState,
  ConnectedProps,
} from '../../shared/types.js';

import { createMachine } from '../../shared/surface-bridge.js';

// --- Injection types ---

export interface WidgetMachineContext {
  /** Current machine state */
  state: MachineState;
  /** Connected props keyed by anatomy part */
  connectedProps: ConnectedProps;
  /** Send an event to the machine */
  send: (event: { type: string; [key: string]: unknown }) => void;
  /** Widget spec metadata */
  spec: WidgetSpec;
}

export const WIDGET_MACHINE_KEY: InjectionKey<WidgetMachineContext> = Symbol('surface-widget-machine');

// --- Component ---

export const WidgetMachine = defineComponent({
  name: 'WidgetMachine',

  props: {
    /** Widget specification describing anatomy, machine, and a11y */
    spec: {
      type: Object as PropType<WidgetSpec>,
      required: true,
    },
    /** Initial machine context overrides */
    initialContext: {
      type: Object as PropType<Record<string, unknown>>,
      default: () => ({}),
    },
    /** HTML wrapper tag */
    tag: {
      type: String as PropType<string>,
      default: 'div',
    },
  },

  emits: {
    /** Emitted when the machine transitions to a new state */
    'state-change': (_state: MachineState) => true,
    /** Emitted for every event sent to the machine */
    'event-sent': (_event: { type: string; [key: string]: unknown }) => true,
  },

  setup(props, { slots, emit }) {
    // Spawn the headless machine
    let machine = createMachine(props.spec, props.initialContext);

    // Reactive Vue refs mirroring machine state
    const machineState = reactive<MachineState>({
      current: machine.state.get().current,
      context: { ...machine.state.get().context },
    });

    const connectedProps = ref<ConnectedProps>(machine.connect());

    // Subscribe to machine state changes
    let unsubscribe: (() => void) | null = null;

    function subscribeToMachine(): void {
      unsubscribe = machine.state.subscribe((newState) => {
        machineState.current = newState.current;
        // Deep-copy context into reactive object
        for (const key of Object.keys(machineState.context)) {
          delete machineState.context[key];
        }
        Object.assign(machineState.context, newState.context);

        connectedProps.value = machine.connect();
        emit('state-change', { ...newState });
      });
    }

    // Wrapped send that also emits for Vue event listeners
    function send(event: { type: string; [key: string]: unknown }): void {
      emit('event-sent', event);
      machine.send(event);
    }

    // Provide machine context to descendants
    const provided = reactive<WidgetMachineContext>({
      state: machineState,
      connectedProps: connectedProps.value,
      send,
      spec: props.spec,
    });

    // Keep provided.connectedProps in sync
    watch(connectedProps, (val) => {
      provided.connectedProps = val;
    });

    provide(WIDGET_MACHINE_KEY, provided);

    onMounted(() => {
      subscribeToMachine();
    });

    // Reinitialize machine when spec changes
    watch(
      () => props.spec,
      (newSpec) => {
        unsubscribe?.();
        machine.destroy();
        machine = createMachine(newSpec, props.initialContext);
        const initial = machine.state.get();
        machineState.current = initial.current;
        Object.assign(machineState.context, initial.context);
        connectedProps.value = machine.connect();
        provided.spec = newSpec;
        subscribeToMachine();
      },
    );

    onUnmounted(() => {
      unsubscribe?.();
      machine.destroy();
    });

    // Class binding object (Vue-specific pattern)
    const rootClasses = computed(() => ({
      'surface-widget-machine': true,
      [`surface-widget-machine--${props.spec.name}`]: true,
      [`surface-widget-machine--state-${machineState.current}`]: true,
      'surface-widget-machine--has-context': Object.keys(machineState.context).length > 0,
    }));

    // Build data attributes from boolean context flags
    const dataAttrs = computed<Record<string, string>>(() => {
      const attrs: Record<string, string> = {
        'data-widget': props.spec.name,
        'data-state': machineState.current,
      };
      for (const [key, value] of Object.entries(machineState.context)) {
        if (typeof value === 'boolean') {
          attrs[`data-${key}`] = String(value);
        }
      }
      return attrs;
    });

    return (): VNode =>
      h(
        props.tag,
        {
          class: rootClasses.value,
          ...dataAttrs.value,
        },
        slots.default?.({
          state: machineState,
          connectedProps: connectedProps.value,
          send,
        }),
      );
  },
});

export default WidgetMachine;
