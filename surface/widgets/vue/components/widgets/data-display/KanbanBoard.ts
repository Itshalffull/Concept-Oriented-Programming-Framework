// ============================================================
// KanbanBoard -- Vue 3 Component
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

export interface KanbanColumn {
  id: string;
  title: string;
  items: KanbanItem[];
}

export interface KanbanItem {
  id: string;
  title: string;
  [key: string]: unknown;
}

export interface KanbanBoardProps {
  columns: KanbanColumn[];
  draggable?: boolean;
  ariaLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  onCardMove?: (cardId: string, fromColumn: string, toColumn: string, toIndex: number) => void;
  onCardActivate?: (cardId: string) => void;
  onAddCard?: (columnId: string) => void;
  renderCard?: (item: KanbanItem, columnId: string) => VNode | string;
}

export const KanbanBoard = defineComponent({
  name: 'KanbanBoard',

  props: {
    columns: { type: Array as PropType<any[]>, required: true as const },
    draggable: { type: Boolean, default: true },
    ariaLabel: { type: String, default: 'Kanban board' },
    size: { type: String, default: 'md' },
    onCardMove: { type: Function as PropType<(...args: any[]) => any> },
    onCardActivate: { type: Function as PropType<(...args: any[]) => any> },
    onAddCard: { type: Function as PropType<(...args: any[]) => any> },
    renderCard: { type: Function as PropType<(...args: any[]) => any> },
  },

  emits: ['card-move', 'card-activate'],

  setup(props, { slots, emit }) {
    const uid = useUid();
    const state = ref<any>(kanbanBoardInitialState);
    const dispatch = (action: any) => { /* state machine dispatch */ };
    const handleDragStart = (e: any, cardId: string, columnId: string) => {
        if (!props.draggable) return;
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', cardId);
        dispatch({ type: 'DRAG_START', cardId, columnId });
      };
    const handleDragEnter = (e: any, columnId: string) => {
        if (!props.draggable) return;
        e.preventDefault();
        dispatch({ type: 'DRAG_ENTER_COLUMN', columnId });
      };
    const handleDragOver = (e: any) => {
        if (!props.draggable) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
      };

    return (): VNode =>
      h('div', {
        'aria-roledescription': 'card',
        'aria-grabbed': isDragged ? 'true' : 'false',
        'draggable': props.draggable ? 'true' : 'false',
        'tabindex': -1,
        'data-state': isDragged ? 'dragging' : 'idle',
        'onDragStart': (e) => handleDragStart(e, item.id, column.id),
        'onDragEnd': () => dispatch({ type: 'DROP' }),
        'onKeyDown': (e) => handleCardKeyDown(e, item.id, column.id),
        'onFocus': () => dispatch({ type: 'FOCUS_CARD' }),
        'onBlur': () => dispatch({ type: 'BLUR' }),
      }, [
        props.renderCard ? props.renderCard(item, column.id) : item.title,
      ]);
  },
});

export default KanbanBoard;