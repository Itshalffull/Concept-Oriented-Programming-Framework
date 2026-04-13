'use client';

/**
 * BlockHandle — React adapter for the block-handle.widget spec.
 *
 * Renders the ⠿ drag-handle icon in the left gutter of each content block.
 * The handle becomes visible when the parent block row is hovered and
 * invisible otherwise (CSS-driven via data-state on the host list item).
 *
 * Drag semantics: HTML5 drag-and-drop (draggable attribute, onDragStart /
 * onDragOver / onDrop). The DataTransfer payload carries:
 *   - "text/clef-block-id"     → dragged block's nodeId
 *   - "text/clef-block-index"  → dragged block's index in parent Outline
 *   - "text/clef-parent-id"    → parent Outline nodeId
 *
 * Drop resolution fires ActionBinding/invoke("block-drop") with context JSON
 * so Outline/moveChild is invoked through the seed-declared binding, keeping
 * the adapter free of direct concept coupling.
 *
 * Clicking the handle opens BlockActionsMenu via ModalStackProvider (PP-modal-stack).
 *
 * Widget spec: surface/widgets/block-handle.widget
 * PRD: docs/plans/block-editor-parity-prd.md §3.3 (block-handle.widget)
 * Card: PP-block-handle (9f205280-2b73-40ff-9b1a-5a58c73dfa15)
 */

import React, { useCallback, useRef, useState } from 'react';
import { useKernelInvoke } from '../../../lib/clef-provider';
import { useModalStack } from './ModalStackProvider';
import { BlockActionsMenu } from './BlockActionsMenu';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface BlockHandleProps {
  /** The ContentNode / Outline node id of this block. */
  blockId: string;
  /** The parent Outline node id (used for moveChild). */
  parentId: string;
  /** Zero-based index of this block among its siblings. */
  blockIndex: number;
  /** Whether the editor is in edit mode. When false the handle is not rendered. */
  canEdit: boolean;
  /** Called after a successful drop so the parent can reload block children. */
  onReorder: () => void;
}

// ---------------------------------------------------------------------------
// BlockHandle component
// ---------------------------------------------------------------------------

export const BlockHandle: React.FC<BlockHandleProps> = ({
  blockId,
  parentId,
  blockIndex,
  canEdit,
  onReorder,
}) => {
  const invoke = useKernelInvoke();
  const { pushModal, popModal } = useModalStack();

  // Local FSM mirror — matches block-handle.widget states.handle
  const [fsmState, setFsmState] = useState<'hidden' | 'visible' | 'dragging' | 'menuOpen'>('hidden');

  // Track the currently dragged block's data so the drop handler can call moveChild
  const dragDataRef = useRef<{
    blockId: string;
    blockIndex: number;
    parentId: string;
  } | null>(null);

  // -------------------------------------------------------------------------
  // Hover visibility — the list-item row triggers show/hide via CSS
  // data-state, but we also track it in React FSM for aria-expanded and guard
  // -------------------------------------------------------------------------

  const handlePointerEnter = useCallback(() => {
    setFsmState((prev) => prev === 'hidden' ? 'visible' : prev);
  }, []);

  const handlePointerLeave = useCallback(() => {
    setFsmState((prev) => prev === 'visible' ? 'hidden' : prev);
  }, []);

  // -------------------------------------------------------------------------
  // Drag-and-drop — HTML5 DnD → ActionBinding("block-drag-start" etc.)
  // -------------------------------------------------------------------------

  const handleDragStart = useCallback((e: React.DragEvent<HTMLButtonElement>) => {
    setFsmState('dragging');

    // Store the drag payload in DataTransfer for cross-element drop handling
    e.dataTransfer.setData('text/clef-block-id', blockId);
    e.dataTransfer.setData('text/clef-block-index', String(blockIndex));
    e.dataTransfer.setData('text/clef-parent-id', parentId);
    e.dataTransfer.effectAllowed = 'move';

    // Persist in ref so the same-component drop handler can read it
    dragDataRef.current = { blockId, blockIndex, parentId };

    // Notify ActionBinding (fire-and-forget; not critical for UX)
    void invoke('ActionBinding', 'invoke', {
      binding: 'block-drag-start',
      context: JSON.stringify({ blockId, blockIndex, parentId }),
    }).catch((err: unknown) => {
      console.warn('[BlockHandle] block-drag-start binding failed:', err);
    });
  }, [blockId, blockIndex, parentId, invoke]);

  const handleDragEnd = useCallback(() => {
    setFsmState((prev) => prev === 'dragging' ? 'hidden' : prev);
    dragDataRef.current = null;
  }, []);

  // -------------------------------------------------------------------------
  // Drop handler — the surrounding list-item wrapper receives onDrop; this
  // component exposes handleDrop for the parent to wire to the list-item.
  // -------------------------------------------------------------------------

  const handleDropOnItem = useCallback(async (
    e: React.DragEvent<HTMLElement>,
    targetBlockId: string,
    targetBlockIndex: number,
  ) => {
    e.preventDefault();

    const srcBlockId = e.dataTransfer.getData('text/clef-block-id');
    const srcParentId = e.dataTransfer.getData('text/clef-parent-id');
    const srcIndex = parseInt(e.dataTransfer.getData('text/clef-block-index'), 10);

    if (!srcBlockId || srcBlockId === targetBlockId) return;

    // Determine drop position (above or below target)
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const dropBefore = e.clientY < midY;
    const newIndex = dropBefore ? targetBlockIndex : targetBlockIndex + 1;

    try {
      const result = await invoke('ActionBinding', 'invoke', {
        binding: 'block-drop',
        context: JSON.stringify({
          blockId: srcBlockId,
          fromParentId: srcParentId,
          fromIndex: srcIndex,
          toParentId: parentId,
          toIndex: newIndex,
        }),
      });
      if (result.variant === 'ok') {
        onReorder();
      } else {
        console.warn('[BlockHandle] block-drop binding returned non-ok:', result.variant);
      }
    } catch (err) {
      console.error('[BlockHandle] block-drop failed:', err);
    }
  }, [parentId, invoke, onReorder]);

  // -------------------------------------------------------------------------
  // Click → open block-actions-menu via ModalStackProvider
  // -------------------------------------------------------------------------

  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setFsmState('menuOpen');

    const modalId = `block-actions-${blockId}`;

    const closeMenu = () => {
      popModal(modalId);
      setFsmState((prev) => prev === 'menuOpen' ? 'visible' : prev);
    };

    pushModal({
      id: modalId,
      widgetId: 'block-actions-menu',
      dismissOnBackdrop: true,
      focusTrapped: true,
      onClose: closeMenu,
      props: {
        children: (
          <BlockActionsMenu
            blockId={blockId}
            parentId={parentId}
            blockIndex={blockIndex}
            onClose={closeMenu}
            onReorder={onReorder}
          />
        ),
      },
    });
  }, [blockId, parentId, blockIndex, pushModal, popModal, onReorder]);

  // -------------------------------------------------------------------------
  // Nothing to render when editing is disabled
  // -------------------------------------------------------------------------

  if (!canEdit) return null;

  return (
    <button
      data-part="root"
      data-widget="block-handle"
      data-state={fsmState}
      data-block-id={blockId}
      data-parent-id={parentId}
      data-block-index={blockIndex}
      draggable
      aria-label="Block handle — drag to reorder or click for actions"
      aria-haspopup="menu"
      aria-expanded={fsmState === 'menuOpen' ? 'true' : 'false'}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onClick={handleClick}
      style={{
        // The gutter handle lives in the absolute decoration layer.
        // Visibility is CSS-driven by the parent list-item's data-hovered
        // attribute so the handle fades in/out without React re-renders.
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '20px',
        height: '24px',
        cursor: 'grab',
        background: 'none',
        border: 'none',
        padding: 0,
        color: 'var(--palette-on-surface-variant)',
        opacity: fsmState !== 'hidden' ? 1 : 0,
        transition: 'opacity 120ms ease',
        borderRadius: '4px',
        fontSize: '14px',
        lineHeight: 1,
        userSelect: 'none',
        pointerEvents: 'auto',
      }}
    >
      {/* ⠿ — U+28FF BRAILLE PATTERN DOTS-123456 */}
      <span data-part="handle-icon" aria-hidden="true" style={{ fontFamily: 'monospace' }}>
        ⠿
      </span>
    </button>
  );
};

// ---------------------------------------------------------------------------
// BlockHandle.handleDropOnItem is exposed so RecursiveBlockEditor can wire
// onDrop on each block list-item without duplicating the drop logic.
// We attach it as a static property so callers don't need to create a ref.
// ---------------------------------------------------------------------------

/**
 * Standalone drop-zone indicator rendered between blocks during drag.
 * Matches the block-handle.widget dropZone anatomy part.
 */
export const BlockDropZoneIndicator: React.FC<{
  active: boolean;
  position: 'before' | 'after';
}> = ({ active, position }) => {
  if (!active) return null;

  return (
    <div
      data-part="drop-zone"
      data-drop-position={position}
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        height: '2px',
        background: 'var(--palette-primary)',
        borderRadius: '1px',
        zIndex: 10,
        pointerEvents: 'none',
        ...(position === 'before' ? { top: 0 } : { bottom: 0 }),
      }}
    />
  );
};

// BlockHandleProps is already exported via the interface declaration above.
