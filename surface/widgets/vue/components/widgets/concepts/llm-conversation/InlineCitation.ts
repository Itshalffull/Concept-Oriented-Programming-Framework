import { defineComponent, h, ref, computed, type PropType } from 'vue';

export type InlineCitationState = 'idle' | 'previewing' | 'navigating';
export type InlineCitationEvent =
  | { type: 'HOVER' }
  | { type: 'CLICK' }
  | { type: 'LEAVE' }
  | { type: 'NAVIGATE_COMPLETE' };

export function inlineCitationReducer(state: InlineCitationState, event: InlineCitationEvent): InlineCitationState {
  switch (state) {
    case 'idle':
      if (event.type === 'HOVER') return 'previewing';
      if (event.type === 'CLICK') return 'navigating';
      return state;
    case 'previewing':
      if (event.type === 'LEAVE') return 'idle';
      if (event.type === 'CLICK') return 'navigating';
      return state;
    case 'navigating':
      if (event.type === 'NAVIGATE_COMPLETE') return 'idle';
      return state;
    default:
      return state;
  }
}

export const InlineCitation = defineComponent({
  name: 'InlineCitation',
  props: {
    index: { type: Number, required: true },
    title: { type: String, required: true },
    url: { type: String, default: undefined },
    excerpt: { type: String, default: undefined },
    size: { type: String as PropType<'sm' | 'md' | 'lg'>, default: 'sm' },
    showPreviewOnHover: { type: Boolean, default: true },
  },
  emits: ['navigate'],
  setup(props, { emit }) {
    const state = ref<InlineCitationState>('idle');

    function send(event: InlineCitationEvent) {
      state.value = inlineCitationReducer(state.value, event);
    }

    function handleClick() {
      send({ type: 'CLICK' });
      emit('navigate', props.url);
      setTimeout(() => send({ type: 'NAVIGATE_COMPLETE' }), 300);
    }

    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    }

    const showTooltip = computed(() => state.value === 'previewing' && props.showPreviewOnHover);

    return () => {
      const children: any[] = [];

      // Badge
      children.push(h('sup', {
        'data-part': 'badge',
        'data-size': props.size,
        'aria-label': `Citation ${props.index}`,
      }, `[${props.index}]`));

      // Tooltip
      if (showTooltip.value) {
        const tooltipChildren: any[] = [
          h('span', { 'data-part': 'title' }, props.title),
        ];
        if (props.excerpt) {
          tooltipChildren.push(h('span', { 'data-part': 'excerpt' }, props.excerpt));
        }
        if (props.url) {
          tooltipChildren.push(h('a', {
            'data-part': 'link',
            href: props.url,
            target: '_blank',
            rel: 'noopener noreferrer',
            onClick: (e: Event) => { e.preventDefault(); handleClick(); },
          }, 'Open source'));
        }
        children.push(h('div', {
          'data-part': 'tooltip',
          'data-visible': 'true',
          role: 'tooltip',
        }, tooltipChildren));
      }

      return h('span', {
        role: 'link',
        'aria-label': `Citation ${props.index}: ${props.title}`,
        'data-surface-widget': '',
        'data-widget-name': 'inline-citation',
        'data-part': 'root',
        'data-state': state.value,
        tabindex: 0,
        onMouseenter: () => send({ type: 'HOVER' }),
        onMouseleave: () => send({ type: 'LEAVE' }),
        onClick: handleClick,
        onKeydown: handleKeydown,
      }, children);
    };
  },
});

export default InlineCitation;
