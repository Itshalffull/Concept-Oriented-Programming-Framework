'use client';

/**
 * KeyboardHelpModal — thin wrapper that mounts KeybindingEditor in mode="view".
 *
 * Modal chrome (title bar, close button, Esc handler) is owned here.
 * All shortcut data, search, category filter, and chord rendering are
 * delegated to KeybindingEditor.
 *
 * Clicking a row in the list switches the modal to edit mode in-place
 * (mode="edit", context=bindingId) so the user can re-record a chord
 * without leaving the modal.
 *
 * Opening: RecursiveBlockEditor dispatches Cmd+/ or ? to openKeyboardHelp()
 * which pushes this modal via ModalStackProvider.pushModal.
 * Closing: Escape (handled by ModalStackProvider and the local keydown guard)
 * or the close button.
 *
 * Widget spec: surface/widgets/keyboard-help-modal.widget
 * PRD:         docs/plans/keybinding-prd.md Phase C
 * Card:        KB-07
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KeybindingEditor } from './KeybindingEditor';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface KeyboardHelpModalProps {
  /** Called when the modal requests closure. */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const KeyboardHelpModal: React.FC<KeyboardHelpModalProps> = ({
  onClose,
}) => {
  // ------------------------------------------------------------------
  // Mode state — starts as view, switches to edit when a row is clicked
  // ------------------------------------------------------------------

  const [editorMode, setEditorMode] = useState<'view' | 'edit'>('view');
  const [selectedBindingId, setSelectedBindingId] = useState<string | null>(null);

  const handleSelectBinding = useCallback((bindingId: string) => {
    setSelectedBindingId(bindingId);
    setEditorMode('edit');
  }, []);

  const handleBackToView = useCallback(() => {
    setSelectedBindingId(null);
    setEditorMode('view');
  }, []);

  // ------------------------------------------------------------------
  // Keyboard: Escape closes (belt-and-suspenders alongside ModalStackProvider)
  // ------------------------------------------------------------------

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        if (editorMode === 'edit') {
          // First Esc: return to view mode rather than closing the modal
          handleBackToView();
        } else {
          onClose();
        }
      }
    }
    document.addEventListener('keydown', onKeyDown, { capture: true });
    return () => document.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [onClose, editorMode, handleBackToView]);

  // ------------------------------------------------------------------
  // Focus: move focus into the editor area on mount
  // ------------------------------------------------------------------

  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Let the KeybindingEditor search input receive initial focus
    const firstInput = containerRef.current?.querySelector<HTMLElement>(
      'input[type="search"], input[type="text"], input',
    );
    firstInput?.focus();
  }, []);

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------

  return (
    <div
      data-part="root"
      data-state="open"
      data-widget="keyboard-help-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: 'min(760px, 92vw)',
        maxHeight: '82vh',
        background: 'var(--palette-surface, #ffffff)',
        borderRadius: '10px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
        overflow: 'hidden',
      }}
    >
      {/* ------------------------------------------------------------------ */}
      {/* header                                                              */}
      {/* ------------------------------------------------------------------ */}
      <div
        data-part="header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px 12px',
          borderBottom: '1px solid var(--palette-outline-variant, #e5e7eb)',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {editorMode === 'edit' && (
            <button
              data-part="back-button"
              aria-label="Back to keyboard shortcuts list"
              onClick={handleBackToView}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: '6px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: 'var(--palette-on-surface-variant, #6b7280)',
                fontSize: '1rem',
                flexShrink: 0,
              }}
            >
              {/* Left-arrow icon */}
              <svg
                aria-hidden="true"
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 1L3 7l6 6" />
              </svg>
            </button>
          )}
          <h2
            data-part="title"
            style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--palette-on-surface, #111827)',
            }}
          >
            {editorMode === 'edit' ? 'Edit Keybinding' : 'Keyboard Shortcuts'}
          </h2>
        </div>

        <button
          data-part="close-button"
          aria-label="Close keyboard shortcuts"
          onClick={onClose}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 28,
            borderRadius: '6px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: 'var(--palette-on-surface-variant, #6b7280)',
            fontSize: '1.1rem',
            flexShrink: 0,
          }}
          onMouseOver={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              'var(--palette-surface-container-high, #e5e7eb)';
          }}
          onMouseOut={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          }}
        >
          {/* X icon */}
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M1 1l12 12M13 1L1 13" />
          </svg>
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* body — KeybindingEditor fills the remaining space                  */}
      {/* ------------------------------------------------------------------ */}
      <div
        ref={containerRef}
        data-part="panel"
        style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        <KeybindingEditor
          mode={editorMode}
          context={selectedBindingId}
          onSelectBinding={handleSelectBinding}
        />
      </div>
    </div>
  );
};

export default KeyboardHelpModal;
