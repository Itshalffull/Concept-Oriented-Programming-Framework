'use client';

/**
 * PaneHeader — Title bar for a windowing system pane
 * Implements clef-base/widgets/pane-header.widget
 * Section 5.11.1
 */

import React, { useReducer, useCallback } from 'react';
import { useKernelInvoke } from '../../../lib/clef-provider';

// ---------------------------------------------------------------------------
// FSM — drag machine (idle | focused | dragging) x size machine (normal | minimized | maximized)
// ---------------------------------------------------------------------------

type DragState = 'idle' | 'focused' | 'dragging';
type SizeState = 'normal' | 'minimized' | 'maximized';

interface PaneHeaderFSM {
  drag: DragState;
  size: SizeState;
}

type PaneHeaderEvent =
  | 'DRAG_START'
  | 'DRAG_END'
  | 'DRAG_CANCEL'
  | 'FOCUS'
  | 'BLUR'
  | 'MAXIMIZE'
  | 'MINIMIZE'
  | 'RESTORE'
  | 'TOGGLE_PIN'
  | 'OPEN_MENU'
  | 'CLOSE'
  | 'ACTIVATE';

function fsmReducer(state: PaneHeaderFSM, event: PaneHeaderEvent): PaneHeaderFSM {
  switch (event) {
    case 'DRAG_START':
      if (state.drag === 'idle' || state.drag === 'focused') {
        return { ...state, drag: 'dragging' };
      }
      return state;
    case 'DRAG_END':
    case 'DRAG_CANCEL':
      if (state.drag === 'dragging') return { ...state, drag: 'idle' };
      return state;
    case 'FOCUS':
      if (state.drag === 'idle') return { ...state, drag: 'focused' };
      return state;
    case 'BLUR':
      if (state.drag === 'focused') return { ...state, drag: 'idle' };
      return state;
    case 'MAXIMIZE':
      if (state.size === 'normal' || state.size === 'minimized') {
        return { ...state, size: 'maximized' };
      }
      return state;
    case 'MINIMIZE':
      if (state.size === 'normal' || state.size === 'maximized') {
        return { ...state, size: 'minimized' };
      }
      return state;
    case 'RESTORE':
      if (state.size === 'minimized' || state.size === 'maximized') {
        return { ...state, size: 'normal' };
      }
      return state;
    default:
      return state;
  }
}

const initialFSM: PaneHeaderFSM = { drag: 'idle', size: 'normal' };

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PaneHeaderProps {
  /** Pane title label */
  title?: string;
  /** Optional icon element rendered before the title */
  icon?: React.ReactNode;
  /** Whether the pane is currently pinned */
  pinned?: boolean;
  /** Show the close button */
  closable?: boolean;
  /** Show the minimize button */
  minimizable?: boolean;
  /** Show the maximize/restore button */
  maximizable?: boolean;
  /** Show the overflow menu button */
  showMenu?: boolean;
  /** Disable all interactive controls */
  disabled?: boolean;
  /** Called when the user initiates a drag on the drag handle */
  onDragStart?: (e: React.PointerEvent) => void;
  /** Called when the drag ends */
  onDragEnd?: (e: React.PointerEvent) => void;
  /** Called when the pin button is toggled */
  onTogglePin?: () => void;
  /** Called when the minimize button is pressed */
  onMinimize?: () => void;
  /** Called when the maximize/restore button is pressed */
  onMaximize?: () => void;
  /** Called when the restore button is pressed (same element as maximize) */
  onRestore?: () => void;
  /** Called when the overflow menu button is pressed */
  onOpenMenu?: () => void;
  /** Called when the close button is pressed */
  onClose?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PaneHeader: React.FC<PaneHeaderProps> = ({
  title = '',
  icon,
  pinned = false,
  closable = true,
  minimizable = true,
  maximizable = true,
  showMenu = true,
  disabled = false,
  onDragStart,
  onDragEnd,
  onTogglePin,
  onMinimize,
  onMaximize,
  onRestore,
  onOpenMenu,
  onClose,
  className,
  style,
}) => {
  const invoke = useKernelInvoke();
  const [fsm, dispatch] = useReducer(fsmReducer, initialFSM);

  const handleDragStart = useCallback(
    (e: React.PointerEvent) => {
      dispatch('DRAG_START');
      onDragStart?.(e);
    },
    [onDragStart],
  );

  const handleDragEnd = useCallback(
    (e: React.PointerEvent) => {
      dispatch('DRAG_END');
      onDragEnd?.(e);
    },
    [onDragEnd],
  );

  const handleMinimize = useCallback(() => {
    if (fsm.size === 'minimized') {
      dispatch('RESTORE');
      onRestore?.();
    } else {
      dispatch('MINIMIZE');
      onMinimize?.();
    }
  }, [fsm.size, onMinimize, onRestore]);

  const handleMaximize = useCallback(() => {
    if (fsm.size === 'maximized') {
      dispatch('RESTORE');
      onRestore?.();
    } else {
      dispatch('MAXIMIZE');
      onMaximize?.();
    }
  }, [fsm.size, onMaximize, onRestore]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'M':
          if (!e.metaKey && !e.ctrlKey) {
            e.preventDefault();
            handleMaximize();
          }
          break;
        case 'Escape':
          dispatch('BLUR');
          break;
        default:
          break;
      }
    },
    [handleMaximize],
  );

  const dragCursor = fsm.drag === 'dragging' ? 'grabbing' : 'grab';

  return (
    <div
      role="toolbar"
      aria-label={`Pane: ${title}`}
      aria-orientation="horizontal"
      data-part="root"
      data-state={fsm.drag}
      data-size={fsm.size}
      data-pinned={pinned ? 'true' : 'false'}
      onKeyDown={handleKeyDown}
      className={className}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--spacing-xs)',
        padding: '0 var(--spacing-sm)',
        height: '2.25rem',
        background: 'var(--palette-surface-variant)',
        borderBottom: '1px solid var(--palette-outline-variant)',
        userSelect: 'none',
        ...style,
      }}
    >
      {/* Drag handle — left region */}
      <div
        role="button"
        aria-label="Drag pane to reposition"
        aria-grabbed={fsm.drag === 'dragging' ? 'true' : 'false'}
        data-part="drag-handle"
        data-state={fsm.drag}
        tabIndex={0}
        onPointerDown={handleDragStart}
        onPointerUp={handleDragEnd}
        onFocus={() => dispatch('FOCUS')}
        onBlur={() => dispatch('BLUR')}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') dispatch('ACTIVATE' as PaneHeaderEvent);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--spacing-xs)',
          flex: 1,
          minWidth: 0,
          cursor: dragCursor,
          padding: '0 var(--spacing-xs)',
        }}
      >
        {/* Icon */}
        {icon && (
          <span
            data-part="icon"
            aria-hidden="true"
            style={{
              flexShrink: 0,
              fontSize: 'var(--typography-body-sm-size)',
              color: 'var(--palette-on-surface-variant)',
            }}
          >
            {icon}
          </span>
        )}

        {/* Title */}
        <span
          data-part="title"
          aria-current="true"
          title={title}
          style={{
            fontSize: 'var(--typography-label-md-size)',
            fontWeight: 'var(--typography-label-md-weight)',
            color: 'var(--palette-on-surface)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </span>
      </div>

      {/* Action buttons group */}
      <div
        role="group"
        aria-label="Pane actions"
        data-part="actions"
        style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}
      >
        {/* Pin button */}
        <button
          type="button"
          role="button"
          aria-label={`Pin pane: ${title}`}
          aria-pressed={pinned ? 'true' : 'false'}
          data-part="pin-button"
          data-pinned={pinned ? 'true' : 'false'}
          disabled={disabled}
          onClick={() => { dispatch('TOGGLE_PIN'); onTogglePin?.(); }}
          style={{
            background: 'none',
            border: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            color: pinned ? 'var(--palette-primary)' : 'var(--palette-on-surface-variant)',
            padding: '4px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.8rem',
            lineHeight: 1,
            opacity: disabled ? 0.4 : 1,
          }}
        >
          📌
        </button>

        {/* Minimize button */}
        {minimizable && (
          <button
            type="button"
            role="button"
            aria-label={`Minimize pane: ${title}`}
            aria-disabled={fsm.size === 'minimized' ? 'true' : 'false'}
            data-part="minimize-button"
            data-state={fsm.size}
            disabled={disabled || fsm.size === 'minimized'}
            onClick={handleMinimize}
            style={{
              background: 'none',
              border: 'none',
              cursor: disabled || fsm.size === 'minimized' ? 'not-allowed' : 'pointer',
              color: 'var(--palette-on-surface-variant)',
              padding: '4px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              lineHeight: 1,
              opacity: disabled || fsm.size === 'minimized' ? 0.4 : 1,
            }}
          >
            −
          </button>
        )}

        {/* Maximize / Restore button */}
        {maximizable && (
          <button
            type="button"
            role="button"
            aria-label={
              fsm.size === 'maximized'
                ? `Restore pane: ${title}`
                : `Maximize pane: ${title}`
            }
            aria-pressed={fsm.size === 'maximized' ? 'true' : 'false'}
            data-part="maximize-button"
            data-state={fsm.size}
            disabled={disabled}
            onClick={handleMaximize}
            style={{
              background: 'none',
              border: 'none',
              cursor: disabled ? 'not-allowed' : 'pointer',
              color: 'var(--palette-on-surface-variant)',
              padding: '4px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              lineHeight: 1,
              opacity: disabled ? 0.4 : 1,
            }}
          >
            {fsm.size === 'maximized' ? '⊡' : '□'}
          </button>
        )}

        {/* Overflow menu button */}
        {showMenu && (
          <button
            type="button"
            role="button"
            aria-label="More pane actions"
            aria-haspopup="menu"
            data-part="menu-button"
            disabled={disabled}
            onClick={() => { dispatch('OPEN_MENU'); onOpenMenu?.(); }}
            style={{
              background: 'none',
              border: 'none',
              cursor: disabled ? 'not-allowed' : 'pointer',
              color: 'var(--palette-on-surface-variant)',
              padding: '4px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              lineHeight: 1,
              opacity: disabled ? 0.4 : 1,
            }}
          >
            ⋯
          </button>
        )}

        {/* Close button */}
        {closable && (
          <button
            type="button"
            role="button"
            aria-label={`Close pane: ${title}`}
            data-part="close-button"
            disabled={disabled}
            onClick={() => { dispatch('CLOSE'); onClose?.(); }}
            style={{
              background: 'none',
              border: 'none',
              cursor: disabled ? 'not-allowed' : 'pointer',
              color: 'var(--palette-on-surface-variant)',
              padding: '4px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.8rem',
              lineHeight: 1,
              opacity: disabled ? 0.4 : 1,
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};

export default PaneHeader;
