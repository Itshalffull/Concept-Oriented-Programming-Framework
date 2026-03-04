// ============================================================
// BlockEditor -- Vue 3 Component
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

export interface BlockDef {
  id: string;
  type: string;
  content?: string;
  children?: BlockDef[];
}

export interface BlockEditorProps {
  /** Array of content blocks. */
  blocks: BlockDef[];
  /** Accessible label. */
  ariaLabel?: string;
  /** Read-only mode. */
  readOnly?: boolean;
  /** Placeholder text for empty blocks. */
  placeholder?: string;
  /** Available block type names. */
  blockTypes?: string[];
  /** Auto-focus on mount. */
  autoFocus?: boolean;
  /** Enable browser spellcheck. */
  spellCheck?: boolean;
  /** Called when blocks change. */
  onBlocksChange?: (blocks: BlockDef[]) => void;
  /** Called when a block type is selected from slash menu. */
  onBlockTypeSelect?: (type: string) => void;
  /** Render prop for custom block rendering. */
  renderBlock?: (block: BlockDef, index: number) => VNode | string;
  /** Slot for the slash menu widget. */
  slashMenu?: VNode | string;
  /** Slot for the selection toolbar widget. */
  selectionToolbar?: VNode | string;
}

export const BlockEditor = defineComponent({
  name: 'BlockEditor',

  props: {
    blocks: { type: Array as PropType<any[]>, required: true as const },
    ariaLabel: { type: String, default: 'Block editor' },
    readOnly: { type: Boolean, default: false },
    placeholder: { type: String, default: "Type '/' for commands..." },
    blockTypes: { type: Array as PropType<any[]> },
    autoFocus: { type: Boolean, default: false },
    spellCheck: { type: Boolean, default: true },
    onBlocksChange: { type: Array as PropType<any[]> },
    onBlockTypeSelect: { type: Function as PropType<(...args: any[]) => any> },
    renderBlock: { type: Function as PropType<(...args: any[]) => any> },
    slashMenu: { type: null as unknown as PropType<any> },
    selectionToolbar: { type: null as unknown as PropType<any> },
  },

  setup(props, { slots, emit }) {
    const state = ref<any>('editing');
    const send = (action: any) => { /* state machine dispatch */ };

    return (): VNode =>
      h('div', {
        'data-surface-widget': '',
        'data-widget-name': 'block-editor',
        'data-state': dataState,
        'data-readonly': props.readOnly ? 'true' : 'false',
        'data-block-count': props.blocks.length,
        'onKeyDown': handleKeyDown,
      }, [
        h('div', {
          'role': 'document',
          'aria-label': 'Editor content',
          'contenteditable': !props.readOnly,
          'suppressContentEditableWarning': true,
          'spellcheck': props.spellCheck,
          'data-empty': props.blocks.length === 0 ? 'true' : 'false',
          'onFocus': () => send({ type: 'FOCUS' }),
          'onBlur': () => send({ type: 'BLUR' }),
        }, [
          props.blocks.map((block, index) => (
          <div
            key={block.id}
            role="group"
            aria-label={`Block ${index}: ${block.type}`}
            aria-grabbed={state.value === 'dragging' ? true : undefined}
            aria-roledescription="content block"
            data-block-type={block.type}
            data-block-id={block.id}
            data-part="block"
            tabIndex={0}
          >
            {!props.readOnly ? h('button', {
              'type': 'button',
              'role': 'button',
              'aria-label': 'Drag to reorder block',
              'aria-roledescription': 'drag handle',
              'draggable': true,
              'tabindex': -1,
              'data-part': 'drag-handle',
              'onDragStart': () => send({ type: 'DRAG_START' }),
              'onDragEnd': () => send({ type: 'DROP' }),
            }, '&#x2630;') : null,
        ]),
        state.value === 'slashMenuOpen' ? h('div', {
            'data-part': 'slash-menu',
            'data-state': 'open',
            'aria-label': 'Block type palette',
          }, [
            props.slashMenu,
          ]) : null,
        state.value === 'selectionActive' ? h('div', {
            'data-part': 'selection-toolbar',
            'data-state': 'visible',
            'aria-label': 'Text formatting toolbar',
          }, [
            props.selectionToolbar,
          ]) : null,
      ]);
  },
});
});)

export default BlockEditor;