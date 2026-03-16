// ============================================================
// NavigationMenu -- Vue 3 Component
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

export interface NavigationMenuItem {
  type: 'trigger' | 'link';
  label: string;
  href?: string;
  active?: boolean;
  content?: VNode | string;
}

export interface NavigationMenuProps {
  items: NavigationMenuItem[];
  orientation?: 'horizontal' | 'vertical';
  delayDuration?: number;
  skipDelayDuration?: number;
  onNavigate?: (href: string) => void;
  variant?: string;
  size?: string;
}

export const NavigationMenu = defineComponent({
  name: 'NavigationMenu',

  props: {
    items: { type: Array as PropType<any[]>, required: true as const },
    orientation: { type: String, default: 'horizontal' },
    delayDuration: { type: Number, default: 200 },
    skipDelayDuration: { type: Number, default: 300 },
    onNavigate: { type: Function as PropType<(...args: any[]) => any> },
    variant: { type: String },
    size: { type: String },
  },

  emits: ['navigate'],

  setup(props, { slots, emit }) {
    const uid = useUid();
    const state = ref<any>({ openItem: null, mobileExpanded: false, });
    const dispatch = (action: any) => { /* state machine dispatch */ };
    const handleOpen = (index: number) => {
        if (unhoverTimerRef.value) {
          clearTimeout(unhoverTimerRef.value);
          unhoverTimerRef.value = null;
        }
        hoverTimerRef.value = setTimeout(() => {
          dispatch({ type: 'OPEN', index });
        }, state.value.openItem !== null ? 0 : props.delayDuration);
      };

    const handleClose = () => {
      if (hoverTimerRef.value) {
        clearTimeout(hoverTimerRef.value);
        hoverTimerRef.value = null;
      }
      unhoverTimerRef.value = setTimeout(() => {
        dispatch({ type: 'CLOSE' });
      }, props.skipDelayDuration);
    };
    const handleItemClick = (index: number) => {
        if (state.value.openItem === index) {
          dispatch({ type: 'CLOSE' });
        } else {
          dispatch({ type: 'OPEN', index });
        }
      };

    const handleLinkClick = (href?: string) => {
        dispatch({ type: 'NAVIGATE' });
        if (href) props.onNavigate?.(href);
      };
    const handleKeyDown = (e: any, index: number, item: NavigationMenuItem) => {
        switch (e.key) {
          case 'ArrowDown':
            if (item.type === 'trigger') {
              e.preventDefault();
              dispatch({ type: 'OPEN', index });
            }
            break;
          case 'Escape':
            e.preventDefault();
            dispatch({ type: 'CLOSE' });
            break;
          case 'Enter':
          case ' ':
            if (item.type === 'trigger') {
              e.preventDefault();
              handleItemClick(index);
            }
            break;
          default:
            break;
        }
      };

    return (): VNode =>
      h('div', {
        'data-part': 'item',
        'data-state': itemState,
        'onPointerEnter': () => {
                  if (item.type === 'trigger') handleOpen(index);
                },
        'onPointerLeave': () => {
                  if (item.type === 'trigger') handleClose();
                },
      }, [
        item.type === 'trigger' ? [
                    h('button', {
                      'id': triggerId,
                      'type': 'button',
                      'role': 'menuitem',
                      'aria-haspopup': 'true',
                      'aria-expanded': isOpen,
                      'aria-controls': contentId,
                      'data-part': 'trigger',
                      'data-state': itemState,
                      'tabindex': 0,
                      'onClick': () => handleItemClick(index),
                      'onKeyDown': (e) => handleKeyDown(e, index, item),
                    }, [
                      item.label,
                    ]),
                    isOpen && item.content ? h('div', {
            'id': contentId,
            'role': 'menu',
            'aria-labelledby': triggerId,
            'data-part': 'content',
            'data-state': itemState,
            'data-orientation': props.orientation,
          }, [
            item.content,
          ]) : null,
                  ] : null,
      ]);
  },
});

export default NavigationMenu;