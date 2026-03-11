// ============================================================
// Menu -- Vue 3 Component
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

let _uid = 0;
function useUid(): string { return `vue-${++_uid}`; }

export interface MenuItem {
  type: 'item' | 'separator' | 'group';
  label?: string;
  icon?: VNode | string;
  shortcut?: string;
  disabled?: boolean;
  onSelect?: () => void;
  items?: MenuItem[];
  groupLabel?: string;
}

export interface MenuProps {
  trigger: VNode | string;
  items: MenuItem[];
  open?: boolean;
  defaultOpen?: boolean;
  placement?: string;
  closeOnSelect?: boolean;
  loop?: boolean;
  typeahead?: boolean;
  onOpenChange?: (open: boolean) => void;
  variant?: string;
  size?: string;
}

export const Menu = defineComponent({
  name: 'Menu',

  props: {
    trigger: { type: null as unknown as PropType<any>, required: true as const },
    items: { type: Array as PropType<any[]>, required: true as const },
    open: { type: Boolean },
    defaultOpen: { type: Boolean, default: false },
    placement: { type: String, default: 'bottom-start' },
    closeOnSelect: { type: Boolean, default: true },
    loop: { type: Boolean, default: false },
    typeahead: { type: Boolean, default: true },
    onOpenChange: { type: Function as PropType<(...args: any[]) => any> },
    variant: { type: String },
    size: { type: String },
  },

  emits: ['open-change', 'select'],

  setup(props, { slots, emit }) {
    const uid = useUid();
    const internalState = ref<any>(props.defaultOpen ? 'open' : 'closed');
    const dispatch = (action: any) => { /* state machine dispatch */ };
    const highlightedIndex = ref<any>(-1);
    const setHighlightedIndex = (v: any) => { highlightedIndex.value = typeof v === 'function' ? v(highlightedIndex.value) : v; };
    const rootRef = ref<any>(null);
    const triggerRef = ref<any>(null);
    const contentRef = ref<any>(null);
    const handleOpen = () => {
      if (!isControlled) dispatch({ type: 'OPEN' });
      props.onOpenChange?.(true);
    };
    const handleClose = () => {
      if (!isControlled) dispatch({ type: 'CLOSE' });
      props.onOpenChange?.(false);
      triggerRef.value?.focus();
    };
    const handleToggle = () => {
      if (isOpen) handleClose();
      else handleOpen();
    };
    const handleSelect = (item: MenuItem) => {
        item.onSelect?.();
        if (props.closeOnSelect) {
          handleClose();
        }
      };
    const handleTriggerKeyDown = (e: any) => {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleOpen();
        }
      };
    const handleContentKeyDown = (e: any) => {
        const count = flatItems.length;
        if (count === 0) return;

        switch (e.key) {
          case 'ArrowDown': {
            e.preventDefault();
            const next = props.loop
              ? (highlightedIndex + 1) % count
              : Math.min(highlightedIndex + 1, count - 1);
            setHighlightedIndex(next);
            const items = contentRef.value?.querySelectorAll('[role="menuitem"]');
            (props.items?.[next] as HTMLElement)?.focus();
            break;
          }
          case 'ArrowUp': {
            e.preventDefault();
            const prev = props.loop
              ? (highlightedIndex - 1 + count) % count
              : Math.max(highlightedIndex - 1, 0);
            setHighlightedIndex(prev);
            const items = contentRef.value?.querySelectorAll('[role="menuitem"]');
            (props.items?.[prev] as HTMLElement)?.focus();
            break;
          }
          case 'Home':
            e.preventDefault();
            setHighlightedIndex(0);
            (contentRef.value?.querySelectorAll('[role="menuitem"]')?.[0] as HTMLElement)?.focus();
            break;
          case 'End':
            e.preventDefault();
            setHighlightedIndex(count - 1);
            (contentRef.value?.querySelectorAll('[role="menuitem"]')?.[count - 1] as HTMLElement)?.focus();
            break;
          case 'Escape':
            e.preventDefault();
            handleClose();
            break;
          case 'Enter':
          case ' ':
            e.preventDefault();
            if (highlightedIndex >= 0 && highlightedIndex < flatItems.length) {
              handleSelect(flatItems[highlightedIndex]);
            }
            break;
          default:
            // Typeahead: match first character of item labels
            if (props.typeahead && e.key.length === 1) {
              const char = e.key.toLowerCase();
              const matchIndex = flatItems.findIndex(
                (item, idx) =>
                  idx > highlightedIndex &&
                  item.label?.toLowerCase().startsWith(char)
              );
              const fallbackIndex = flatItems.findIndex((item) =>
                item.label?.toLowerCase().startsWith(char)
              );
              const target = matchIndex >= 0 ? matchIndex : fallbackIndex;
              if (target >= 0) {
                setHighlightedIndex(target);
                const items = contentRef.value?.querySelectorAll('[role="menuitem"]');
                (props.items?.[target] as HTMLElement)?.focus();
              }
            }
            break;
        }
      };
    const triggerId = `menu-trigger-${id}`;
    const contentId = `menu-content-${id}`;
    const isControlled = props.open !== undefined;
    const isOpen = currentState === 'open';
    const dataState = isOpen ? 'open' : 'closed';
    const flatItems = props.items.filter((item) => item.type === 'item' && !item.disabled);
    onMounted(() => {
      if (isOpen && contentRef.value) {
      const firstItem = contentRef.value.querySelector('[role="menuitem"]') as HTMLElement | null;
      firstItem?.focus();
      setHighlightedIndex(0);
      }
    });

    return (): VNode =>
      h('div', {
        'ref': (node) => {
          rootRef.value = node;
        },
        'data-surface-widget': '',
        'data-widget-name': 'menu',
        'data-part': 'root',
        'data-state': dataState,
        'data-variant': props.variant,
        'data-size': props.size,
      }, [
        h('button', {
          'ref': triggerRef,
          'id': triggerId,
          'type': 'button',
          'aria-haspopup': 'menu',
          'aria-expanded': isOpen,
          'aria-controls': contentId,
          'data-part': 'trigger',
          'data-state': dataState,
          'onClick': handleToggle,
          'onKeyDown': handleTriggerKeyDown,
        }, [
          props.trigger,
        ]),
        isOpen ? h('div', {
            'data-part': 'positioner',
            'data-placement': props.placement,
            'data-state': dataState,
            'style': { position: 'absolute' },
          }, [
            h('div', {
              'ref': contentRef,
              'id': contentId,
              'role': 'menu',
              'aria-labelledby': triggerId,
              'data-part': 'content',
              'data-state': dataState,
              'tabindex': -1,
              'onKeyDown': handleContentKeyDown,
            }, [
              renderItems(props.items),
            ]),
          ]) : null,
      ]);
  },
});

export default Menu;