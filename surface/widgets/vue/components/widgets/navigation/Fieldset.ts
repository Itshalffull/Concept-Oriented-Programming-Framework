// ============================================================
// Fieldset -- Vue 3 Component
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

let _uid = 0;
function useUid(): string { return `vue-${++_uid}`; }

export interface FieldsetProps {
  label: string;
  disabled?: boolean;
  collapsible?: boolean;
  defaultOpen?: boolean;
  description?: string;
  variant?: string;
  size?: string;
}

export const Fieldset = defineComponent({
  name: 'Fieldset',

  props: {
    label: { type: String, required: true as const },
    disabled: { type: Boolean, default: false },
    collapsible: { type: Boolean, default: false },
    defaultOpen: { type: Boolean, default: true },
    description: { type: String },
    variant: { type: String },
    size: { type: String },
  },

  setup(props, { slots, emit }) {
    const uid = useUid();
    const disclosureState = ref<any>(props.defaultOpen ? 'expanded' : 'collapsed');
    const dispatch = (action: any) => { /* state machine dispatch */ };
    const handleToggle = () => {
      if (!props.collapsible) return;
      dispatch({ type: 'TOGGLE' });
    };
    const handleKeyDown = (e: any) => {
        if (!props.collapsible) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleToggle();
        }
      };
    const legendId = `fieldset-legend-${id}`;
    const descriptionId = `fieldset-desc-${id}`;
    const isOpen = disclosureState.value === 'expanded';
    const dataState = props.collapsible ? (isOpen ? 'open' : 'closed') : 'static';

    return (): VNode =>
      h('fieldset', {
        'role': 'group',
        'aria-labelledby': legendId,
        'aria-describedby': props.description ? descriptionId : undefined,
        'aria-disabled': props.disabled ? 'true' : 'false',
        'disabled': props.disabled,
        'data-surface-widget': '',
        'data-widget-name': 'fieldset',
        'data-part': 'root',
        'data-disabled': props.disabled ? 'true' : 'false',
        'data-collapsible': props.collapsible ? 'true' : 'false',
        'data-state': dataState,
        'data-variant': props.variant,
        'data-size': props.size,
      }, [
        h('legend', {
          'id': legendId,
          'role': props.collapsible ? 'button' : undefined,
          'aria-expanded': props.collapsible ? isOpen : undefined,
          'tabindex': props.collapsible ? 0 : undefined,
          'data-part': 'legend',
          'onClick': props.collapsible ? handleToggle : undefined,
          'onKeyDown': props.collapsible ? handleKeyDown : undefined,
        }, [
          props.label,
        ]),
        props.description ? h('span', { 'id': descriptionId, 'data-part': 'description' }, [
            props.description,
          ]) : null,
        h('div', {
          'data-part': 'content',
          'data-state': dataState,
          'hidden': props.collapsible ? !isOpen : false,
        }, slots.default?.()),
      ]);
  },
});

export default Fieldset;