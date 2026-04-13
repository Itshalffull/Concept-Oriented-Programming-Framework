'use client';

/**
 * BlockActionsMenu — React adapter for the block-actions-menu.widget spec.
 *
 * Renders the per-block command popover opened by the block-handle ⠿ click.
 * All commands route through ActionBinding/invoke so the menu has no direct
 * concept coupling beyond ActionBinding. The menu is always mounted inside
 * ModalStackProvider which handles Escape dismissal and focus-trapping.
 *
 * Commands:
 *   Duplicate  → ActionBinding("block-duplicate")  → ContentNode/clone + Outline/addChild
 *   Delete     → ActionBinding("block-delete")     → Outline/removeChild
 *   Turn into  → ActionBinding("block-turn-into")  → opens schema-picker, then Schema/applyTo
 *   Copy link  → ActionBinding("block-copy-link")  → clipboard with deep-link
 *
 * Widget spec: surface/widgets/block-actions-menu.widget
 * PRD: docs/plans/block-editor-parity-prd.md §3.3 (block-actions-menu.widget)
 * Card: PP-block-handle (9f205280-2b73-40ff-9b1a-5a58c73dfa15)
 */

import React, { useCallback, useRef } from 'react';
import { useKernelInvoke } from '../../../lib/clef-provider';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface BlockActionsMenuProps {
  blockId: string;
  parentId: string;
  blockIndex: number;
  onClose: () => void;
  onReorder: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const BlockActionsMenu: React.FC<BlockActionsMenuProps> = ({
  blockId,
  parentId,
  blockIndex,
  onClose,
  onReorder,
}) => {
  const invoke = useKernelInvoke();
  const menuRef = useRef<HTMLDivElement>(null);

  // -------------------------------------------------------------------------
  // Keyboard navigation — roving tabindex within menu items
  // -------------------------------------------------------------------------

  const handleMenuKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
    if (!items || items.length === 0) return;

    const activeIndex = Array.from(items).findIndex(
      (el) => el === document.activeElement,
    );

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (activeIndex + 1) % items.length;
      items[next]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (activeIndex - 1 + items.length) % items.length;
      items[prev]?.focus();
    } else if (e.key === 'Tab') {
      // Tab closes the menu rather than navigating outside
      e.preventDefault();
      onClose();
    }
  }, [onClose]);

  // -------------------------------------------------------------------------
  // Command: Duplicate
  // -------------------------------------------------------------------------

  const handleDuplicate = useCallback(async () => {
    onClose();
    try {
      const result = await invoke('ActionBinding', 'invoke', {
        binding: 'block-duplicate',
        context: JSON.stringify({ blockId, parentId, blockIndex }),
      });
      if (result.variant === 'ok') {
        onReorder(); // reload children to show the duplicated block
      } else {
        console.warn('[BlockActionsMenu] block-duplicate returned non-ok:', result.variant);
      }
    } catch (err) {
      console.error('[BlockActionsMenu] block-duplicate failed:', err);
    }
  }, [blockId, parentId, blockIndex, invoke, onClose, onReorder]);

  // -------------------------------------------------------------------------
  // Command: Delete
  // -------------------------------------------------------------------------

  const handleDelete = useCallback(async () => {
    onClose();
    try {
      const result = await invoke('ActionBinding', 'invoke', {
        binding: 'block-delete',
        context: JSON.stringify({ blockId, parentId }),
      });
      if (result.variant === 'ok') {
        onReorder(); // reload children to remove the deleted block
      } else {
        console.warn('[BlockActionsMenu] block-delete returned non-ok:', result.variant);
      }
    } catch (err) {
      console.error('[BlockActionsMenu] block-delete failed:', err);
    }
  }, [blockId, parentId, invoke, onClose, onReorder]);

  // -------------------------------------------------------------------------
  // Command: Turn into (opens schema-picker, then applies schema)
  // -------------------------------------------------------------------------

  const handleTurnInto = useCallback(async () => {
    onClose();
    try {
      const result = await invoke('ActionBinding', 'invoke', {
        binding: 'block-turn-into',
        context: JSON.stringify({ blockId, parentId }),
      });
      if (result.variant !== 'ok') {
        console.warn('[BlockActionsMenu] block-turn-into returned non-ok:', result.variant);
      }
    } catch (err) {
      console.error('[BlockActionsMenu] block-turn-into failed:', err);
    }
  }, [blockId, parentId, invoke, onClose]);

  // -------------------------------------------------------------------------
  // Command: Move to (opens page-picker overlay, then moves block to new parent)
  // -------------------------------------------------------------------------

  const handleMoveTo = useCallback(async () => {
    onClose();
    try {
      const result = await invoke('ActionBinding', 'invoke', {
        binding: 'block-move-to',
        context: JSON.stringify({ blockId, parentId }),
      });
      if (result.variant === 'ok') {
        onReorder();
      } else {
        console.warn('[BlockActionsMenu] block-move-to returned non-ok:', result.variant);
      }
    } catch (err) {
      console.error('[BlockActionsMenu] block-move-to failed:', err);
    }
  }, [blockId, parentId, invoke, onClose, onReorder]);

  // -------------------------------------------------------------------------
  // Command: Copy link
  // -------------------------------------------------------------------------

  const handleCopyLink = useCallback(async () => {
    onClose();
    try {
      const result = await invoke('ActionBinding', 'invoke', {
        binding: 'block-copy-link',
        context: JSON.stringify({ blockId }),
      });
      if (result.variant !== 'ok') {
        console.warn('[BlockActionsMenu] block-copy-link returned non-ok:', result.variant);
      }
    } catch (err) {
      console.error('[BlockActionsMenu] block-copy-link failed:', err);
    }
  }, [blockId, invoke, onClose]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const menuItemStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '6px 12px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: '13px',
    color: 'var(--palette-on-surface)',
    borderRadius: '4px',
    transition: 'background 80ms ease',
  };

  const destructiveItemStyle: React.CSSProperties = {
    ...menuItemStyle,
    color: 'var(--palette-error)',
  };

  return (
    <div
      ref={menuRef}
      data-part="root"
      data-widget="block-actions-menu"
      data-state="open"
      data-block-id={blockId}
      role="dialog"
      aria-label="Block actions"
      aria-modal="false"
      onKeyDown={handleMenuKeyDown}
      style={{
        minWidth: '180px',
        padding: '4px',
        background: 'var(--palette-surface)',
        border: '1px solid var(--palette-outline)',
        borderRadius: '8px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      }}
    >
      <div
        data-part="menu"
        role="menu"
        aria-label="Block actions"
        aria-orientation="vertical"
      >
        {/* Duplicate */}
        <button
          data-part="duplicate-item"
          role="menuitem"
          tabIndex={0}
          onClick={handleDuplicate}
          style={menuItemStyle}
          onFocus={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              'var(--palette-surface-container-high)';
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = '';
          }}
        >
          <span aria-hidden="true">⧉</span>
          Duplicate
        </button>

        {/* Turn into */}
        <button
          data-part="turn-into-item"
          role="menuitem"
          tabIndex={-1}
          aria-haspopup="dialog"
          onClick={handleTurnInto}
          style={menuItemStyle}
          onFocus={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              'var(--palette-surface-container-high)';
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = '';
          }}
        >
          <span aria-hidden="true">↺</span>
          Turn into…
        </button>

        {/* Copy link */}
        <button
          data-part="copy-link-item"
          role="menuitem"
          tabIndex={-1}
          onClick={handleCopyLink}
          style={menuItemStyle}
          onFocus={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              'var(--palette-surface-container-high)';
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = '';
          }}
        >
          <span aria-hidden="true">🔗</span>
          Copy link
        </button>

        {/* Move to */}
        <button
          data-part="move-to-item"
          role="menuitem"
          tabIndex={-1}
          aria-haspopup="dialog"
          onClick={handleMoveTo}
          style={menuItemStyle}
          onFocus={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              'var(--palette-surface-container-high)';
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = '';
          }}
        >
          <span aria-hidden="true">→</span>
          Move to…
        </button>

        {/* Separator */}
        <div
          data-part="separator"
          role="separator"
          aria-hidden="true"
          style={{
            height: '1px',
            background: 'var(--palette-outline-variant)',
            margin: '4px 8px',
          }}
        />

        {/* Delete (destructive) */}
        <button
          data-part="delete-item"
          role="menuitem"
          data-variant="destructive"
          tabIndex={-1}
          aria-label="Delete block"
          onClick={handleDelete}
          style={destructiveItemStyle}
          onFocus={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              'var(--palette-error-container)';
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = '';
          }}
        >
          <span aria-hidden="true">🗑</span>
          Delete
        </button>
      </div>
    </div>
  );
};
