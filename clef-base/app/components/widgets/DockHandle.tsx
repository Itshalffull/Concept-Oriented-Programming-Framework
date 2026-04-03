'use client';

/**
 * DockHandle — Drag-and-drop dock target overlay
 * Implements clef-base/widgets/dock-handle.widget
 * Section 5.11.2
 */

import React, { useReducer, useCallback } from 'react';

// ---------------------------------------------------------------------------
// FSM — visibility machine (hidden | visible | hovering)
// ---------------------------------------------------------------------------

type VisibilityState = 'hidden' | 'visible' | 'hovering';

type DockEvent =
  | { type: 'SHOW' }
  | { type: 'HIDE' }
  | { type: 'POINTER_ENTER_TARGET'; target: DockPosition }
  | { type: 'POINTER_LEAVE_TARGET' }
  | { type: 'DROP'; target: DockPosition };

export type DockPosition = 'top' | 'bottom' | 'left' | 'right' | 'center';

interface DockHandleFSM {
  visibility: VisibilityState;
}

function fsmReducer(state: DockHandleFSM, event: DockEvent): DockHandleFSM {
  switch (event.type) {
    case 'SHOW':
      if (state.visibility === 'hidden') return { visibility: 'visible' };
      return state;
    case 'HIDE':
      return { visibility: 'hidden' };
    case 'POINTER_ENTER_TARGET':
      if (state.visibility === 'visible') return { visibility: 'hovering' };
      return state;
    case 'POINTER_LEAVE_TARGET':
      if (state.visibility === 'hovering') return { visibility: 'visible' };
      return state;
    case 'DROP':
      if (state.visibility === 'hovering') return { visibility: 'hidden' };
      return state;
    default:
      return state;
  }
}

const initialFSM: DockHandleFSM = { visibility: 'hidden' };

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DockHandleProps {
  /** The currently hovered/active target position */
  activeTarget?: DockPosition | null;
  /** Identifier for the dock zone this overlay belongs to */
  zoneId?: string;
  /** Show the center (tab) target */
  showCenter?: boolean;
  showTop?: boolean;
  showBottom?: boolean;
  showLeft?: boolean;
  showRight?: boolean;
  /** Whether the overlay is visible (controlled) */
  visible?: boolean;
  /** Called when a drop target is activated */
  onDrop?: (target: DockPosition) => void;
  /** Called when the active hover target changes */
  onHoverTarget?: (target: DockPosition | null) => void;
  /** Called when Escape dismisses the overlay */
  onHide?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Style for an individual directional target button */
function targetStyle(position: DockPosition, isActive: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'absolute',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: 'var(--radius-md)',
    border: '2px solid var(--palette-primary)',
    background: isActive ? 'var(--palette-primary-container)' : 'var(--palette-surface)',
    color: 'var(--palette-on-surface)',
    cursor: 'pointer',
    fontSize: '1rem',
    opacity: 0.9,
    transition: 'background 0.1s, transform 0.1s',
    transform: isActive ? 'scale(1.1)' : 'scale(1)',
  };

  switch (position) {
    case 'top':
      return { ...base, top: '10%', left: '50%', transform: `translateX(-50%) ${isActive ? 'scale(1.1)' : 'scale(1)'}` };
    case 'bottom':
      return { ...base, bottom: '10%', left: '50%', transform: `translateX(-50%) ${isActive ? 'scale(1.1)' : 'scale(1)'}` };
    case 'left':
      return { ...base, left: '10%', top: '50%', transform: `translateY(-50%) ${isActive ? 'scale(1.1)' : 'scale(1)'}` };
    case 'right':
      return { ...base, right: '10%', top: '50%', transform: `translateY(-50%) ${isActive ? 'scale(1.1)' : 'scale(1)'}` };
    case 'center':
      return { ...base, top: '50%', left: '50%', transform: `translate(-50%, -50%) ${isActive ? 'scale(1.1)' : 'scale(1)'}` };
  }
}

/** Arrow glyph labels for each position */
const POSITION_LABELS: Record<DockPosition, string> = {
  top: '▲',
  bottom: '▼',
  left: '◀',
  right: '▶',
  center: '⊕',
};

const ARIA_LABELS: Record<DockPosition, string> = {
  top: 'Dock above',
  bottom: 'Dock below',
  left: 'Dock to the left',
  right: 'Dock to the right',
  center: 'Dock as tab',
};

const DATA_PARTS: Record<DockPosition, string> = {
  top: 'top-target',
  bottom: 'bottom-target',
  left: 'left-target',
  right: 'right-target',
  center: 'center-target',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const DockHandle: React.FC<DockHandleProps> = ({
  activeTarget = null,
  zoneId = '',
  showCenter = true,
  showTop = true,
  showBottom = true,
  showLeft = true,
  showRight = true,
  visible: controlledVisible,
  onDrop,
  onHoverTarget,
  onHide,
  className,
  style,
}) => {
  const [fsm, dispatch] = useReducer(fsmReducer, initialFSM);

  // Support controlled visibility: if the parent passes visible, sync into FSM
  // We derive effective visibility: controlled prop takes precedence over internal FSM
  const effectiveVisibility: VisibilityState = (() => {
    if (controlledVisible === true && fsm.visibility === 'hidden') return 'visible';
    if (controlledVisible === false) return 'hidden';
    return fsm.visibility;
  })();

  const isHidden = effectiveVisibility === 'hidden';

  const handlePointerEnter = useCallback(
    (target: DockPosition) => {
      dispatch({ type: 'POINTER_ENTER_TARGET', target });
      onHoverTarget?.(target);
    },
    [onHoverTarget],
  );

  const handlePointerLeave = useCallback(() => {
    dispatch({ type: 'POINTER_LEAVE_TARGET' });
    onHoverTarget?.(null);
  }, [onHoverTarget]);

  const handleDrop = useCallback(
    (target: DockPosition) => {
      dispatch({ type: 'DROP', target });
      onDrop?.(target);
    },
    [onDrop],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        dispatch({ type: 'HIDE' });
        onHide?.();
      }
    },
    [onHide],
  );

  const positions: { pos: DockPosition; show: boolean }[] = [
    { pos: 'top', show: showTop },
    { pos: 'bottom', show: showBottom },
    { pos: 'left', show: showLeft },
    { pos: 'right', show: showRight },
    { pos: 'center', show: showCenter },
  ];

  return (
    <div
      role="group"
      aria-label="Dock target selector"
      aria-live="polite"
      aria-hidden={isHidden ? 'true' : 'false'}
      data-part="root"
      data-state={effectiveVisibility}
      data-zone={zoneId}
      hidden={isHidden}
      onKeyDown={handleKeyDown}
      className={className}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 100,
        pointerEvents: isHidden ? 'none' : 'auto',
        ...style,
      }}
    >
      {/* Directional target buttons */}
      {positions.map(({ pos, show }) => {
        if (!show) return null;
        const isActive = activeTarget === pos;
        return (
          <button
            key={pos}
            type="button"
            role="button"
            aria-label={ARIA_LABELS[pos]}
            aria-pressed={isActive ? 'true' : 'false'}
            data-part={DATA_PARTS[pos]}
            data-target={pos}
            data-active={isActive ? 'true' : 'false'}
            tabIndex={0}
            onPointerEnter={() => handlePointerEnter(pos)}
            onPointerLeave={handlePointerLeave}
            onClick={() => handleDrop(pos)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleDrop(pos);
              }
            }}
            style={targetStyle(pos, isActive)}
          >
            {POSITION_LABELS[pos]}
          </button>
        );
      })}

      {/* Preview overlay — shown only when hovering a target */}
      <div
        aria-hidden="true"
        data-part="preview-overlay"
        data-state={effectiveVisibility}
        data-target={activeTarget ?? undefined}
        hidden={effectiveVisibility !== 'hovering'}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--palette-primary-container)',
          opacity: 0.25,
          pointerEvents: 'none',
          borderRadius: 'var(--radius-sm)',
          border: '2px dashed var(--palette-primary)',
          transition: 'opacity 0.15s',
        }}
      />
    </div>
  );
};

export default DockHandle;
