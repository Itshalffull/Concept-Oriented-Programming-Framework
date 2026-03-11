// ============================================================
// StateMachineDiagram -- Vue 3 Component
//
// Clef Surface widget. Vue 3 Composition API with h() render.
// ============================================================

import {
  defineComponent,
  h,
  type PropType,
  type VNode,
  ref,
} from 'vue';

export interface StateDef {
  name: string;
  flags: string[];
}

export interface TransitionDef {
  id?: string;
  from: string;
  to: string;
  label: string;
}

export interface StateMachineDiagramProps {
  /** State definitions. */
  states: StateDef[];
  /** Transition definitions. */
  transitions: TransitionDef[];
  /** Accessible label. */
  ariaLabel?: string;
  /** Read-only mode. */
  readOnly?: boolean;
  /** Available flags. */
  availableFlags?: string[];
  /** Called when states change. */
  onStatesChange?: (states: StateDef[]) => void;
  /** Called when transitions change. */
  onTransitionsChange?: (transitions: TransitionDef[]) => void;
  /** State form slot. */
  stateForm?: VNode | string;
  /** Transition form slot. */
  transitionForm?: VNode | string;
  /** Confirm dialog slot. */
  confirmDialog?: VNode | string;
}

export const StateMachineDiagram = defineComponent({
  name: 'StateMachineDiagram',

  props: {
    states: { type: Array as PropType<any[]>, required: true as const },
    transitions: { type: Array as PropType<any[]>, required: true as const },
    ariaLabel: { type: String, default: 'State machine diagram' },
    readOnly: { type: Boolean, default: false },
    availableFlags: { type: Array as PropType<any[]>, default: () => (['initial', 'published', 'default-revision']) },
    onStatesChange: { type: Array as PropType<any[]> },
    onTransitionsChange: { type: Array as PropType<any[]> },
    stateForm: { type: null as unknown as PropType<any> },
    transitionForm: { type: null as unknown as PropType<any> },
    confirmDialog: { type: null as unknown as PropType<any> },
  },

  setup(props, { slots, emit }) {
    const state = ref<any>('viewing');
    const send = (action: any) => { /* state machine dispatch */ };

    return (): VNode =>
      h('div', {
        'role': 'listitem',
        'aria-label': `Transition: ${t.from} to ${t.to} via ${t.label}`,
        'data-from': t.from,
        'data-to': t.to,
        'tabindex': 0,
        'onClick': () => send({ type: 'EDIT_TRANSITION', id: tid }),
        'onKeyDown': (e) => handleTransitionKeyDown(e, tid),
      }, [
        h('span', { 'data-part': 'transition-from' }, [
          t.from,
        ]),
        h('span', { 'data-part': 'transition-arrow', 'aria-hidden': 'true' }, [
          '\u2192',
        ]),
        h('span', { 'data-part': 'transition-to' }, [
          t.to,
        ]),
        h('span', { 'data-part': 'transition-label' }, [
          t.label,
        ]),
      ]);
  },
});

export default StateMachineDiagram;