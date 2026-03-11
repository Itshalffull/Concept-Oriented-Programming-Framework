// ============================================================
// ContextMenu -- Vue 3 Component
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

export interface ContextMenuItem {
  /** Display label for the menu item. */
  label: string;
  /** Action identifier emitted on selection. */
  action: string;
  /** Optional icon name. */
  icon?: string;
  /** Whether the item is disabled. */
  disabled?: boolean;
  /** Whether the item represents a destructive action. */
  destructive?: boolean;
  /** Set to 'separator' to render a visual divider. */
  type?: 'item' | 'separator' | 'label';
}

export interface ContextMenuProps {
  /** Menu items to render. */
  items?: ContextMenuItem[];
  /** Callback invoked when a menu item is selected. */
  onSelect?: (action: string) => void;
  /** The trigger region (children receive the right-click handler). */
}

export const ContextMenu = defineComponent({
  name: 'ContextMenu',

  props: {
    items: { type: Array as PropType<any[]>, default: () => ([], onSelect, children, ...rest) },
  },

  emits: ['select'],

  setup(props, { slots, emit }) {
    const state = ref<any>('closed');
    const send = (action: any) => { /* state machine dispatch */ };
    const triggerRef = ref<any>(null);
    const contentRef = ref<any>(null);
    const positionerRef = ref<any>(null);
    const pointerPosition = ref<any>({ x: 0, y: 0 });
    const anchorRef = ref<any>(null);
    const handleContextMenu = (e: ReactMouseEvent) => {
    e.preventDefault();
    pointerPosition.value = { x: e.clientX, y: e.clientY };
    // Move anchor to pointer coordinates
    if (anchorRef.value) {
      anchorRef.value.style.position = 'fixed';
      anchorRef.value.style.left = `${e.clientX}px`;
      anchorRef.value.style.top = `${e.clientY}px`;
      anchorRef.value.style.width = '0px';
      anchorRef.value.style.height = '0px';
      anchorRef.value.style.pointerEvents = 'none';
    }
    send({ type: 'CONTEXT_MENU' });
  };
    const handleSelect = (action: string) => {
      send({ type: 'SELECT' });
      onSelect?.(action);
    };

  // Outside click
  useOutsideClick(contentRef, () => {
    send({ type: 'OUTSIDE_CLICK' });
  }, isOpen);

  // Escape key and keyboard navigation
  (() => {
    if (!isOpen) return;

    const actionItems = props.items.filter(
      (item) => item.type !== 'separator' && item.type !== 'label',
    );

    const onKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          send({ type: 'ESCAPE' });
          break;
        case 'ArrowDown': {
          e.preventDefault();
          setHighlightedIndex(
            highlightedIndex < actionItems.length - 1 ? highlightedIndex + 1 : 0,
          );
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          setHighlightedIndex(
            highlightedIndex > 0 ? highlightedIndex - 1 : actionItems.length - 1,
          );
          break;
        }
        case 'Home':
          e.preventDefault();
          setHighlightedIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setHighlightedIndex(actionItems.length - 1);
          break;
        case 'Enter':
        case ' ': {
          e.preventDefault();
          const item = actionItems[highlightedIndex];
          if (item && !item.disabled) {
            handleSelect(item.action);
          }
          break;
        }
        default:
          break;
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  };

    return (): VNode =>
      h('div', {
        'data-part': 'item',
        'role': 'menuitem',
        'tabindex': -1,
        'aria-disabled': item.disabled || undefined,
        'data-destructive': item.destructive || undefined,
        'data-highlighted': actionIndex === highlightedIndex || undefined,
        'onClick': () => {
                    if (!item.disabled) handleSelect(item.action);
                  },
        'onPointerEnter': () => setHighlightedIndex(actionIndex),
      }, [
        item.label,
      ]);
  },
});)

export default ContextMenu;