'use client';

/**
 * PageTitle — React adapter for the page-title.widget spec.
 *
 * Renders a single contenteditable region for the page title above the
 * block tree. On blur (or after debounce), dispatches ContentNode/setTitle
 * via the ActionBinding "page-title-set". Enter and Tab move focus to
 * the first child block via the optional onRequestFirstBlockFocus callback.
 *
 * Widget spec: surface/widgets/page-title.widget
 * Anatomy parts (data-part attributes): root, titleInput
 *
 * FSM states (data-state on root): idle, focused, editing
 * Parallel machine name: edit
 *
 * Seed: clef-base/seeds/ActionBinding.page-title.seeds.yaml
 * Card: PP-page-title
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useKernelInvoke } from '../../../lib/clef-provider';

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface PageTitleProps {
  /** The ContentNode id whose title this widget manages */
  pageId: string;
  /** Current title (controlled — re-renders when parent updates) */
  title?: string;
  /** Placeholder shown when title is empty */
  placeholder?: string;
  /** When true, the title is not editable */
  readOnly?: boolean;
  /** When true, focus the titleInput on mount */
  autoFocus?: boolean;
  /** Called when Enter or Tab is pressed, so RecursiveBlockEditor can move
   *  focus to the first child block */
  onRequestFirstBlockFocus?: () => void;
  /** Called after a successful ContentNode/setTitle completion */
  onTitleSaved?: (title: string) => void;
}

// ---------------------------------------------------------------------------
// FSM state — mirrors the page-title.widget spec edit machine exactly
// ---------------------------------------------------------------------------

type PageTitleState = 'idle' | 'focused' | 'editing';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const DEBOUNCE_MS = 500;

export const PageTitle: React.FC<PageTitleProps> = ({
  pageId,
  title: titleProp = '',
  placeholder = 'Untitled',
  readOnly = false,
  autoFocus = false,
  onRequestFirstBlockFocus,
  onTitleSaved,
}) => {
  const invoke = useKernelInvoke();

  // ------- FSM state -------
  const [fsmState, setFsmState] = useState<PageTitleState>('idle');

  // ------- Local title text — owned by this component between saves -------
  const [localTitle, setLocalTitle] = useState(titleProp);

  // Sync controlled prop into local state when parent updates (e.g. on reload)
  useEffect(() => {
    setLocalTitle(titleProp);
  }, [titleProp]);

  // ------- Refs -------
  const inputRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestTitleRef = useRef(localTitle);
  useEffect(() => { latestTitleRef.current = localTitle; }, [localTitle]);

  // Auto-focus on mount when requested
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Sync contenteditable content when controlled title changes from outside
  useEffect(() => {
    if (inputRef.current && fsmState === 'idle') {
      // Only update DOM when not editing to avoid cursor jumps
      if (inputRef.current.textContent !== titleProp) {
        inputRef.current.textContent = titleProp;
      }
    }
  }, [titleProp, fsmState]);

  // ---------------------------------------------------------------------------
  // Save — dispatches ContentNode/setTitle via ActionBinding "page-title-set"
  // ---------------------------------------------------------------------------

  const saveTitle = useCallback(async (title: string) => {
    try {
      const result = await invoke('ActionBinding', 'invoke', {
        binding: 'page-title-set',
        context: JSON.stringify({ pageId, title }),
      });
      if (result.variant === 'ok') {
        onTitleSaved?.(title);
      } else {
        console.warn('[PageTitle] setTitle returned non-ok:', result.variant, result);
      }
    } catch (err) {
      console.error('[PageTitle] setTitle failed:', err);
    }
  }, [invoke, pageId, onTitleSaved]);

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  const handleFocus = useCallback(() => {
    if (readOnly) return;
    setFsmState('focused');
  }, [readOnly]);

  const handleBlur = useCallback(() => {
    // Cancel any pending debounce and save immediately on blur
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setFsmState('idle');
    saveTitle(latestTitleRef.current);
  }, [saveTitle]);

  const handleInput = useCallback(() => {
    if (readOnly) return;
    const text = inputRef.current?.textContent ?? '';
    setLocalTitle(text);
    latestTitleRef.current = text;
    setFsmState('editing');

    // Debounce — reset timer on each input
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      saveTitle(latestTitleRef.current);
    }, DEBOUNCE_MS);
  }, [readOnly, saveTitle]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter') {
      // Enter: prevent newline in contenteditable, move focus to first block
      e.preventDefault();
      // Cancel debounce and save before handing off focus
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      saveTitle(latestTitleRef.current);
      setFsmState('idle');
      inputRef.current?.blur();
      onRequestFirstBlockFocus?.();
    } else if (e.key === 'Tab') {
      // Tab: move focus to first block without creating a new block
      e.preventDefault();
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      saveTitle(latestTitleRef.current);
      setFsmState('idle');
      inputRef.current?.blur();
      onRequestFirstBlockFocus?.();
    }
  }, [saveTitle, onRequestFirstBlockFocus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      data-part="root"
      data-state={fsmState}
      data-read-only={readOnly ? 'true' : 'false'}
      style={{
        padding: 'var(--spacing-lg) var(--spacing-lg) var(--spacing-sm)',
        position: 'relative',
      }}
    >
      <div
        ref={inputRef}
        data-part="titleInput"
        role="textbox"
        aria-label="Page title"
        aria-multiline="false"
        aria-readonly={readOnly ? 'true' : 'false'}
        aria-placeholder={placeholder}
        data-placeholder={placeholder}
        contentEditable={readOnly ? 'false' : 'true'}
        suppressContentEditableWarning
        onFocus={handleFocus}
        onBlur={handleBlur}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        style={{
          fontSize: 'var(--typography-heading-xl-size, 2rem)',
          fontWeight: 'var(--typography-heading-xl-weight, 700)',
          lineHeight: '1.2',
          outline: 'none',
          border: 'none',
          background: 'transparent',
          color: localTitle
            ? 'var(--palette-on-surface)'
            : 'var(--palette-on-surface-variant)',
          cursor: readOnly ? 'default' : 'text',
          minHeight: '1.2em',
          width: '100%',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          // Show placeholder via CSS content when empty and not focused
          // (actual placeholder rendered via data-placeholder + CSS)
        }}
      >
        {/* Initial render populates via titleProp; thereafter the DOM is
            owned by contenteditable. We set textContent in a useEffect. */}
        {localTitle || ''}
      </div>
    </div>
  );
};

export default PageTitle;
