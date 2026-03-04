// ============================================================
// Avatar -- Vue 3 Component
//
// Clef Surface widget. Vue 3 Composition API with h() render.
// ============================================================

import {
  defineComponent,
  h,
  type PropType,
  type VNode,
  ref,
  onMounted,
  onUnmounted,
  watch,
} from 'vue';

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
}

export interface AvatarProps {
  src?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  delayMs?: number;
}

export const Avatar = defineComponent({
  name: 'Avatar',

  props: {
    src: { type: String },
    name: { type: String, default: '' },
    size: { type: String, default: 'md' },
    delayMs: { type: Number, default: 0 },
  },

  setup(props, { slots, emit }) {
    const state = ref<any>('loading');
    const send = (action: any) => { /* state machine dispatch */ };
    const prevSrcRef = ref<any>(props.src);
    const handleLoad = () => {
      if (props.delayMs > 0) {
        setTimeout(() => send({ type: 'LOAD_SUCCESS' }), props.delayMs);
      } else {
        send({ type: 'LOAD_SUCCESS' });
      }
    };
    const handleError = () => {
      send({ type: 'LOAD_ERROR' });
    };
    const isLoaded = state.value === 'loaded';
    onMounted(() => {
      if (prevSrcRef.value !== props.src) {
      prevSrcRef.value = props.src;
      send({ type: 'INVALIDATE' });
      }
    });

    return (): VNode =>
      h('div', {
        'role': 'img',
        'aria-label': props.name,
        'data-surface-widget': '',
        'data-widget-name': 'avatar',
        'data-part': 'root',
        'data-size': props.size,
        'data-state': state.value,
      }, [
        props.src ? h('img', {
            'src': props.src,
            'alt': props.name,
            'data-part': 'image',
            'data-visible': isLoaded ? 'true' : 'false',
            'onLoad': handleLoad,
            'onError': handleError,
            'style': isLoaded ? undefined : { display: 'none' },
          }) : null,
        h('span', {
          'data-part': 'fallback',
          'data-visible': isLoaded ? 'false' : 'true',
          'aria-hidden': 'true',
          'style': isLoaded ? { display: 'none' } : undefined,
        }, [
          getInitials(props.name),
        ]),
      ]);
  },
});

export default Avatar;