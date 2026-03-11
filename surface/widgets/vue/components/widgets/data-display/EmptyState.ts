// ============================================================
// EmptyState -- Vue 3 Component
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

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: VNode | string;
  action?: VNode | string;
  size?: 'sm' | 'md' | 'lg';
}

export const EmptyState = defineComponent({
  name: 'EmptyState',

  props: {
    title: { type: String, required: true as const },
    description: { type: String },
    icon: { type: null as unknown as PropType<any> },
    action: { type: null as unknown as PropType<any> },
    size: { type: String, default: 'md' },
  },

  setup(props, { slots, emit }) {
    const uid = useUid();

    return (): VNode =>
      h('div', {
        'role': 'region',
        'aria-labelledby': titleId,
        'aria-describedby': props.description ? descriptionId : undefined,
        'data-surface-widget': '',
        'data-widget-name': 'empty-state',
        'data-part': 'empty-state',
        'data-state': state.value,
        'data-size': props.size,
      }, [
        props.icon ? h('div', {
            'data-part': 'icon',
            'data-visible': 'true',
            'aria-hidden': 'true',
          }, [
            props.icon,
          ]) : null,
        h('h3', { 'id': titleId, 'data-part': 'title' }, [
          props.title,
        ]),
        props.description ? h('p', {
            'id': descriptionId,
            'data-part': 'description',
            'data-visible': 'true',
          }, [
            props.description,
          ]) : null,
        props.action ? h('div', { 'data-part': 'action' }, [
            props.action,
          ]) : null,
        slots.default?.(),
      ]);
  },
});

export default EmptyState;