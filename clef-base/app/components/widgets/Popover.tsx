'use client';

/**
 * Popover — React adapter for the anchored-popover widget spec.
 *
 * Viewport-aware anchored popover. Renders children in a portal at
 * document.body to escape ancestor overflow:hidden clipping. Computes
 * a fixed pixel position from a DOMRect anchor, flips to the alternate
 * placement when the preferred side overflows the viewport, and clamps
 * both axes to keep the panel fully visible regardless of scroll position.
 *
 * Widget spec: surface/widgets/popover.widget
 *
 * Known-future migration sites (follow-up PRs — do NOT refactor here):
 *   - QuickCapture menu            (app/components/QuickCaptureMenu.tsx)
 *   - Concept-action picker         (app/components/widgets/ConceptActionPicker.tsx)
 *   - Inline cell editor popover    (app/components/widgets/InlineCellEditor.tsx)
 *   - FieldsPopover                 (app/components/widgets/FieldsPopover.tsx)
 *   - FilterPopover                 (app/components/widgets/FilterPopover.tsx)
 *   - SortPopover                   (app/components/widgets/SortPopover.tsx)
 *   - GroupPopover                  (app/components/widgets/GroupPopover.tsx)
 *   - FieldHeaderPopover            (app/components/widgets/FieldHeaderPopover.tsx)
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PopoverPlacement =
  | 'auto'
  | 'bottom-start'
  | 'bottom-end'
  | 'top-start'
  | 'top-end'
  | 'right-start'
  | 'right-end'
  | 'left-start'
  | 'left-end';

export interface PopoverProps {
  /** The anchor element or a DOMRect (in viewport coordinates). */
  anchor: HTMLElement | DOMRect | null;
  /** Whether the popover is open. */
  open: boolean;
  /** Called when the popover should close. */
  onClose: () => void;
  /** Preferred placement relative to the anchor. Default: "auto". */
  placement?: PopoverPlacement;
  /** Spacing in px between anchor and popover edge. Default: 8. */
  gap?: number;
  /** Fixed popover width in px. */
  width?: number;
  /** Fixed popover height in px (or undefined for auto). */
  height?: number;
  /** Whether clicking outside closes the popover. Default: true. */
  modal?: boolean;
  /** Content rendered inside the panel. */
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Placement math
// ---------------------------------------------------------------------------

interface Rect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

interface Position {
  top: number;
  left: number;
  placement: PopoverPlacement;
}

/**
 * Compute fixed-position coordinates for the popover panel.
 *
 * Algorithm:
 * 1. Get the anchor rect in viewport coordinates.
 * 2. Try the preferred placement first.
 * 3. If the preferred side overflows the viewport, flip to the opposite.
 * 4. Clamp the position on the cross-axis so the panel stays fully visible.
 */
function computePosition(
  anchorRect: Rect,
  panelRect: Rect,
  placement: PopoverPlacement,
  gap: number,
): Position {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const EDGE = gap; // minimum gap from viewport edge

  // Determine the primary axis (which side of anchor to place on)
  type Side = 'bottom' | 'top' | 'right' | 'left';
  const extractSide = (p: PopoverPlacement): Side => {
    if (p === 'auto') return 'bottom';
    return p.split('-')[0] as Side;
  };
  const extractAlign = (p: PopoverPlacement): 'start' | 'end' => {
    if (p === 'auto') return 'start';
    const parts = p.split('-');
    return (parts[1] as 'start' | 'end') || 'start';
  };

  // Try a given side and return the position if it fits, else null
  const tryPlace = (side: Side, align: 'start' | 'end'): Position | null => {
    let top: number;
    let left: number;

    if (side === 'bottom') {
      top = anchorRect.bottom + gap;
      left = align === 'start' ? anchorRect.left : anchorRect.right - panelRect.width;
    } else if (side === 'top') {
      top = anchorRect.top - panelRect.height - gap;
      left = align === 'start' ? anchorRect.left : anchorRect.right - panelRect.width;
    } else if (side === 'right') {
      top = align === 'start' ? anchorRect.top : anchorRect.bottom - panelRect.height;
      left = anchorRect.right + gap;
    } else { // left
      top = align === 'start' ? anchorRect.top : anchorRect.bottom - panelRect.height;
      left = anchorRect.left - panelRect.width - gap;
    }

    // Check if this placement fits the viewport (on the primary axis)
    if (side === 'bottom' && top + panelRect.height > vh - EDGE) return null;
    if (side === 'top' && top < EDGE) return null;
    if (side === 'right' && left + panelRect.width > vw - EDGE) return null;
    if (side === 'left' && left < EDGE) return null;

    return { top, left, placement: `${side}-${align}` as PopoverPlacement };
  };

  // Opposite sides for flipping
  const oppositeSide: Record<Side, Side> = {
    bottom: 'top', top: 'bottom', right: 'left', left: 'right',
  };

  const side = extractSide(placement);
  const align = extractAlign(placement);

  // Try preferred, then flip
  let pos = tryPlace(side, align)
    ?? tryPlace(oppositeSide[side], align)
    ?? {
      top: side === 'bottom' || side === 'top'
        ? (side === 'bottom' ? anchorRect.bottom + gap : anchorRect.top - panelRect.height - gap)
        : align === 'start' ? anchorRect.top : anchorRect.bottom - panelRect.height,
      left: side === 'right' || side === 'left'
        ? (side === 'right' ? anchorRect.right + gap : anchorRect.left - panelRect.width - gap)
        : align === 'start' ? anchorRect.left : anchorRect.right - panelRect.width,
      placement: `${side}-${align}` as PopoverPlacement,
    };

  // Clamp on both axes
  pos.left = Math.max(EDGE, Math.min(pos.left, vw - panelRect.width - EDGE));
  pos.top = Math.max(EDGE, Math.min(pos.top, vh - panelRect.height - EDGE));

  return pos;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const Popover: React.FC<PopoverProps> = ({
  anchor,
  open,
  onClose,
  placement = 'auto',
  gap = 8,
  width,
  height,
  modal = true,
  children,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const [computedPlacement, setComputedPlacement] = useState<PopoverPlacement>(placement);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // ---------------------------------------------------------------------------
  // Compute position
  // ---------------------------------------------------------------------------

  const updatePosition = useCallback(() => {
    if (!open || !anchor || !panelRef.current) return;

    const anchorRect: Rect =
      anchor instanceof HTMLElement
        ? anchor.getBoundingClientRect()
        : anchor as Rect;

    const panelEl = panelRef.current;
    const panelRect: Rect = {
      top: 0,
      left: 0,
      right: panelEl.offsetWidth,
      bottom: panelEl.offsetHeight,
      width: width ?? panelEl.offsetWidth,
      height: height ?? panelEl.offsetHeight,
    };
    if (width) panelRect.width = width;
    if (height) panelRect.height = height;

    const pos = computePosition(anchorRect, panelRect, placement, gap);
    setPosition({ top: pos.top, left: pos.left });
    setComputedPlacement(pos.placement);
  }, [open, anchor, placement, gap, width, height]);

  // Recompute on open, anchor change, resize, scroll
  useEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    // Record anchor for focus-return
    if (anchor instanceof HTMLElement) {
      previousFocusRef.current = anchor;
    } else if (document.activeElement instanceof HTMLElement) {
      previousFocusRef.current = document.activeElement;
    }

    // Initial position (panel may not have rendered yet — use a frame)
    const frameId = requestAnimationFrame(updatePosition);

    const handleResize = () => updatePosition();
    const handleScroll = () => updatePosition();

    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [open, anchor, updatePosition]);

  // ---------------------------------------------------------------------------
  // Focus trap
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!open || !modal || !panelRef.current) return;

    // Do NOT steal focus when the current active element is inside a
    // contentEditable region (e.g. the block editor). The block editor manages
    // its own focus via restoreFocusToBlock and must not be interrupted by
    // a popover that opens concurrently (e.g. during an async Tab-indent
    // handler). Stealing focus here would cause the Tab-indent focus restoration
    // to fight with the popover's focus management, producing the "jumps back"
    // regression. See: surface/widgets/block-editor.widget invariant
    // "Tab indents and preserves focus".
    const activeEl = document.activeElement as HTMLElement | null;
    const activeIsContentEditable =
      activeEl != null &&
      (activeEl.isContentEditable ||
        activeEl.closest('[contenteditable="true"]') != null);

    if (!activeIsContentEditable) {
      // Focus first focusable element inside the panel
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length > 0) {
        (focusable[0] as HTMLElement).focus();
      } else {
        panelRef.current.focus();
      }
    }

    // Trap Tab key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !panelRef.current) return;

      const focusableEls = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.closest('[hidden]'));

      if (focusableEls.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusableEls[0];
      const last = focusableEls[focusableEls.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      // Return focus to the previous element, but only when the previous
      // element is NOT inside a contentEditable region. The block editor
      // calls restoreFocusToBlock after async operations; if we call
      // .focus() on a contentEditable host here, we race against that
      // and can land focus on the wrong element (or the wrong position).
      const prev = previousFocusRef.current;
      const prevIsContentEditable =
        prev != null &&
        (prev.isContentEditable ||
          prev.closest('[contenteditable="true"]') != null);
      if (!prevIsContentEditable) {
        prev?.focus?.();
      }
    };
  }, [open, modal]);

  // ---------------------------------------------------------------------------
  // Escape key
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [open, onClose]);

  // ---------------------------------------------------------------------------
  // Portal rendering
  // ---------------------------------------------------------------------------

  if (!open || typeof document === 'undefined') return null;

  const panelStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 9999,
    ...(position ? { top: position.top, left: position.left } : { top: -9999, left: -9999 }),
    ...(width != null ? { width } : {}),
    ...(height != null ? { height } : {}),
  };

  return createPortal(
    <div data-part="root" data-state={open ? 'open' : 'closed'}>
      {/* Backdrop — invisible, covers full viewport to capture outside clicks */}
      {modal && (
        <div
          data-part="backdrop"
          aria-hidden="true"
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9998,
          }}
        />
      )}

      {/* Panel — the actual popover content */}
      <div
        ref={panelRef}
        data-part="panel"
        data-state={open ? 'open' : 'closed'}
        data-placement={computedPlacement}
        role="dialog"
        aria-modal={modal ? 'true' : 'false'}
        tabIndex={-1}
        style={panelStyle}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
};

Popover.displayName = 'Popover';
export default Popover;
