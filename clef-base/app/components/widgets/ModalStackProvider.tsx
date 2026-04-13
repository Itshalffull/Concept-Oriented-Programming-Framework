'use client';

/**
 * ModalStackProvider — centralized modal/popover stack manager for RecursiveBlockEditor.
 *
 * Provides a React context with push/pop/top API so any descendant can open a
 * modal without managing its own open/close useState flags. A single portal
 * mount point at document.body renders all stacked modals in z-order.
 *
 * Focus-trap coordination: only the top-most ModalEntry traps focus; lower
 * entries release their trap while they remain mounted. Escape dismisses the
 * top of the stack. Backdrop click dismisses when dismissOnBackdrop is true.
 *
 * PRD: docs/plans/block-editor-parity-prd.md (PP-modal-stack)
 * Card: PP-modal-stack (efe25d75-d10c-4f1d-8463-7456ee90e66d)
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

// ---------------------------------------------------------------------------
// Public type
// ---------------------------------------------------------------------------

export type ModalEntry = {
  /** Unique identifier for this modal instance. */
  id: string;
  /** Widget spec ID — consumed by the host to dispatch to the correct renderer. */
  widgetId: string;
  /** Props forwarded to the mounted widget. */
  props: Record<string, unknown>;
  /** Called by the stack when the modal should close (Escape, backdrop, pop). */
  onClose: () => void;
  /** When true, clicking the backdrop outside the modal content dismisses it. */
  dismissOnBackdrop: boolean;
  /** Whether this entry participates in focus trapping at all. */
  focusTrapped: boolean;
};

// ---------------------------------------------------------------------------
// Context API
// ---------------------------------------------------------------------------

interface ModalStackContextValue {
  /** Push a new modal onto the stack. Returns the assigned id. */
  pushModal: (entry: Omit<ModalEntry, 'id'> & { id?: string }) => string;
  /** Remove the modal with the given id from the stack. */
  popModal: (id: string) => void;
  /** Return the top-most modal entry, or null if the stack is empty. */
  top: () => ModalEntry | null;
  /** Current stack snapshot (for render). */
  stack: ModalEntry[];
}

const ModalStackContext = createContext<ModalStackContextValue | null>(null);

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * useModalStack — access the modal stack from any descendant of
 * ModalStackProvider. Throws if used outside the provider.
 */
export function useModalStack(): ModalStackContextValue {
  const ctx = useContext(ModalStackContext);
  if (!ctx) {
    throw new Error('useModalStack must be used inside <ModalStackProvider>');
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface ModalStackProviderProps {
  children: React.ReactNode;
}

export const ModalStackProvider: React.FC<ModalStackProviderProps> = ({ children }) => {
  const [stack, setStack] = useState<ModalEntry[]>([]);
  const counterRef = useRef(0);

  const pushModal = useCallback(
    (entry: Omit<ModalEntry, 'id'> & { id?: string }): string => {
      const id = entry.id ?? `modal-${++counterRef.current}`;
      const full: ModalEntry = { ...entry, id };
      setStack((prev) => [...prev, full]);
      return id;
    },
    [],
  );

  const popModal = useCallback((id: string) => {
    setStack((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const top = useCallback((): ModalEntry | null => {
    return stack[stack.length - 1] ?? null;
  }, [stack]);

  // Keyboard: Escape closes top of stack.
  //
  // KB-16 registers a "kb-modal-esc" KeyBinding seed in the "app.modal" scope
  // so the keyboard-help overlay and future automation can discover this
  // shortcut. The actual close logic remains here because the ActionBinding
  // target (ModalStack/close) is a synthetic surface action that does not yet
  // have a kernel handler. Once a ModalStack handler is wired the hardcoded
  // listener below can be retired. Until then both co-exist safely: this
  // handler fires in the document capture phase; the global dispatcher from
  // useKeyBindings (installed at AppShell) also fires in capture phase but
  // invokes ActionBinding/invoke which no-ops against the synthetic target.
  useEffect(() => {
    if (stack.length === 0) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      const topEntry = stack[stack.length - 1];
      if (!topEntry) return;
      e.stopPropagation();
      topEntry.onClose();
      popModal(topEntry.id);
    }

    document.addEventListener('keydown', onKeyDown, { capture: true });
    return () => {
      document.removeEventListener('keydown', onKeyDown, { capture: true });
    };
  }, [stack, popModal]);

  const value: ModalStackContextValue = { pushModal, popModal, top, stack };

  return (
    <ModalStackContext.Provider value={value}>
      {children}
      <ModalStackPortal stack={stack} topId={stack[stack.length - 1]?.id ?? null} onPop={popModal} />
    </ModalStackContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Portal mount point — single mount at document.body
// ---------------------------------------------------------------------------

interface ModalStackPortalProps {
  stack: ModalEntry[];
  topId: string | null;
  onPop: (id: string) => void;
}

const ModalStackPortal: React.FC<ModalStackPortalProps> = ({ stack, topId, onPop }) => {
  const [mounted, setMounted] = useState(false);

  // Defer portal to client — avoids SSR mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || stack.length === 0) return null;

  return createPortal(
    <div
      data-part="modal-stack-root"
      aria-live="assertive"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        pointerEvents: 'none', // stack container passes clicks through to backdrops below
      }}
    >
      {stack.map((entry, index) => {
        const isTop = entry.id === topId;
        const zBase = 1000 + index * 10;

        return (
          <ModalLayer
            key={entry.id}
            entry={entry}
            isTop={isTop}
            zIndex={zBase}
            onPop={onPop}
          />
        );
      })}
    </div>,
    document.body,
  );
};

// ---------------------------------------------------------------------------
// Individual modal layer — backdrop + content shell
// ---------------------------------------------------------------------------

interface ModalLayerProps {
  entry: ModalEntry;
  isTop: boolean;
  zIndex: number;
  onPop: (id: string) => void;
}

// Derive a sanitised scope segment from a modal widget ID.
// e.g. "command-palette" → "app.modal.command-palette"
function modalScope(widgetId: string): string {
  const segment = widgetId.replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  return `app.modal.${segment}`;
}

const ModalLayer: React.FC<ModalLayerProps> = ({ entry, isTop, zIndex, onPop }) => {
  const contentRef = useRef<HTMLDivElement>(null);

  // Focus trap: when this entry is top and focusTrapped, move focus into content
  useEffect(() => {
    if (!isTop || !entry.focusTrapped) return;
    const el = contentRef.current;
    if (!el) return;

    // Find the first focusable element and focus it
    const focusable = el.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const first = focusable[0];
    if (first) {
      first.focus();
    } else {
      el.focus();
    }
  }, [isTop, entry.focusTrapped]);

  // Tab-trap: keep Tab/Shift+Tab within modal content when it is top
  useEffect(() => {
    if (!isTop || !entry.focusTrapped) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab') return;
      const el = contentRef.current;
      if (!el) return;

      const focusable = Array.from(
        el.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((node) => !node.closest('[hidden]'));

      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (active === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isTop, entry.focusTrapped]);

  function handleBackdropClick() {
    if (!entry.dismissOnBackdrop) return;
    entry.onClose();
    onPop(entry.id);
  }

  return (
    // Backdrop — only top entry gets pointer-events so lower layers don't intercept
    <div
      data-part="modal-backdrop"
      data-modal-id={entry.id}
      data-top={isTop ? 'true' : 'false'}
      onClick={isTop ? handleBackdropClick : undefined}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex,
        pointerEvents: isTop ? 'auto' : 'none',
        background: isTop ? 'rgba(0,0,0,0.35)' : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Modal content shell — click stops propagation so backdrop click only fires outside */}
      <div
        ref={contentRef}
        data-part="modal-content"
        data-widget={entry.widgetId}
        data-keybinding-scope={isTop ? modalScope(entry.widgetId) : undefined}
        role="dialog"
        aria-modal={isTop ? 'true' : 'false'}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          zIndex: zIndex + 1,
          pointerEvents: 'auto',
          outline: 'none',
          // Basic shell styling — individual widgets apply their own visual treatment
          background: 'var(--palette-surface, #fff)',
          borderRadius: '8px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
          maxWidth: '90vw',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
      >
        {/*
          Widget dispatch placeholder.
          The widgetId is stored in data-widget for the widget interpreter to
          pick up. Props are serialized onto data-props for the same reason.
          In Phase 1 the host wraps actual widget components directly via
          entry.props.children when the caller needs immediate rendering.
        */}
        {entry.props.children as React.ReactNode ?? null}
      </div>
    </div>
  );
};
