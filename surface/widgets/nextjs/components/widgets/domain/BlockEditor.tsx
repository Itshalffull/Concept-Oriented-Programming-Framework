'use client';

import {
  forwardRef,
  useCallback,
  useReducer,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { blockEditorReducer } from './BlockEditor.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface BlockDef {
  id: string;
  type: string;
  content?: string;
  children?: BlockDef[];
}

export interface BlockEditorProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
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
  renderBlock?: (block: BlockDef, index: number) => ReactNode;
  /** Slot for the slash menu widget. */
  slashMenu?: ReactNode;
  /** Slot for the selection toolbar widget. */
  selectionToolbar?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const BlockEditor = forwardRef<HTMLDivElement, BlockEditorProps>(function BlockEditor(
  {
    blocks,
    ariaLabel = 'Block editor',
    readOnly = false,
    placeholder = "Type '/' for commands...",
    blockTypes,
    autoFocus = false,
    spellCheck = true,
    onBlocksChange,
    onBlockTypeSelect,
    renderBlock,
    slashMenu,
    selectionToolbar,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(blockEditorReducer, 'editing');

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (readOnly) return;
      if (e.key === '/' && state === 'editing') {
        send({ type: 'SLASH' });
      }
      if (e.key === 'Escape') {
        send({ type: 'ESCAPE' });
      }
    },
    [readOnly, state],
  );

  const dataState =
    state === 'dragging' ? 'dragging' :
    state === 'slashMenuOpen' ? 'slash-open' :
    state === 'selectionActive' ? 'selecting' : 'idle';

  return (
    <div
      ref={ref}
      data-surface-widget=""
      data-widget-name="block-editor"
      data-state={dataState}
      data-readonly={readOnly ? 'true' : 'false'}
      data-block-count={blocks.length}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      <div
        role="document"
        aria-label="Editor content"
        contentEditable={!readOnly}
        suppressContentEditableWarning
        spellCheck={spellCheck}
        data-empty={blocks.length === 0 ? 'true' : 'false'}
        onFocus={() => send({ type: 'FOCUS' })}
        onBlur={() => send({ type: 'BLUR' })}
      >
        {blocks.map((block, index) => (
          <div
            key={block.id}
            role="group"
            aria-label={`Block ${index}: ${block.type}`}
            aria-grabbed={state === 'dragging' ? true : undefined}
            aria-roledescription="content block"
            data-block-type={block.type}
            data-block-id={block.id}
            data-part="block"
            tabIndex={0}
          >
            {!readOnly && (
              <button
                type="button"
                role="button"
                aria-label="Drag to reorder block"
                aria-roledescription="drag handle"
                draggable
                tabIndex={-1}
                data-part="drag-handle"
                onDragStart={() => send({ type: 'DRAG_START' })}
                onDragEnd={() => send({ type: 'DROP' })}
              >
                &#x2630;
              </button>
            )}
            {renderBlock ? (
              renderBlock(block, index)
            ) : (
              <div data-part="block-content">
                {block.content || (
                  <span aria-hidden="true" data-part="placeholder" data-visible="true">
                    {placeholder}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {state === 'slashMenuOpen' && (
        <div data-part="slash-menu" data-state="open" aria-label="Block type palette">
          {slashMenu}
        </div>
      )}

      {state === 'selectionActive' && (
        <div data-part="selection-toolbar" data-state="visible" aria-label="Text formatting toolbar">
          {selectionToolbar}
        </div>
      )}
    </div>
  );
});

BlockEditor.displayName = 'BlockEditor';
export { BlockEditor };
export default BlockEditor;
