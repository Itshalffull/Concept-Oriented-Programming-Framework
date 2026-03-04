// ============================================================
// Card -- Vue 3 Component
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

export interface CardProps {
  variant?: 'elevated' | 'filled' | 'outlined';
  clickable?: boolean;
  href?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  size?: 'sm' | 'md' | 'lg';
  header?: VNode | string;
  media?: VNode | string;
  footer?: VNode | string;
  actions?: VNode | string;
  title?: string;
  description?: string;
  onClick?: () => void;
}

export const Card = defineComponent({
  name: 'Card',

  props: {
    variant: { type: String, default: 'elevated' },
    clickable: { type: Boolean, default: false },
    href: { type: String },
    padding: { type: String, default: 'md' },
    size: { type: String, default: 'md' },
    header: { type: null as unknown as PropType<any> },
    media: { type: null as unknown as PropType<any> },
    footer: { type: null as unknown as PropType<any> },
    actions: { type: null as unknown as PropType<any> },
    title: { type: String },
    description: { type: String },
    onClick: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['click'],

  setup(props, { slots, emit }) {
    const uid = useUid();
    const state = ref<any>(cardInitialState);
    const dispatch = (action: any) => { /* state machine dispatch */ };
    const handleActivate = () => {
      dispatch({ type: 'ACTIVATE' });
      if (props.href) {
        window.location.href = props.href;
      }
      props.onClick?.();
    };
    const handleKeyDown = (e: any) => {
        if (!props.clickable) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleActivate();
        }
      };

    return (): VNode =>
      h('div', {
        'role': props.clickable ? 'article' : 'region',
        'aria-labelledby': props.title ? titleId : undefined,
        'aria-describedby': props.description ? descriptionId : undefined,
        'tabindex': props.clickable ? 0 : undefined,
        'onClick': props.clickable ? handleActivate : undefined,
        'onKeyDown': handleKeyDown,
        'onMouseEnter': () => dispatch({ type: 'HOVER' }),
        'onMouseLeave': () => dispatch({ type: 'UNHOVER' }),
        'onFocus': () => dispatch({ type: 'FOCUS' }),
        'onBlur': () => dispatch({ type: 'BLUR' }),
        'onPointerDown': () => dispatch({ type: 'PRESS' }),
        'onPointerUp': () => dispatch({ type: 'RELEASE' }),
        'data-surface-widget': '',
        'data-widget-name': 'card',
        'data-part': 'root',
        'data-variant': props.variant,
        'data-clickable': props.clickable ? 'true' : 'false',
        'data-state': state.value,
        'data-padding': props.padding,
        'data-size': props.size,
      }, [
        props.header ? h('div', { 'data-part': 'header', 'data-variant': props.variant }, [
            props.title ? h('span', { 'id': titleId, 'data-part': 'title' }, [
                props.title,
              ]) : null,
            props.header,
          ]) : null,
        !props.header && props.title ? h('div', { 'data-part': 'header', 'data-variant': props.variant }, [
            h('span', { 'id': titleId, 'data-part': 'title' }, [
              props.title,
            ]),
            props.description ? h('span', { 'id': descriptionId, 'data-part': 'description' }, [
                props.description,
              ]) : null,
          ]) : null,
        props.media ? h('div', { 'data-part': 'media', 'aria-hidden': 'true' }, [
            props.media,
          ]) : null,
        h('div', { 'data-part': 'body', 'data-padding': props.padding }, slots.default?.()),
        (props.footer || props.actions) ? h('div', { 'data-part': 'footer', 'data-variant': props.variant }, [
            props.footer,
            props.actions ? h('div', {
                'data-part': 'actions',
                'role': 'group',
                'aria-label': 'Card actions',
              }, [
                props.actions,
              ]) : null,
          ]) : null,
      ]);
  },
});

export default Card;