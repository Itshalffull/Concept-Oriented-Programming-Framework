'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useKernelInvoke } from './clef-provider';

// ─── Types ────────────────────────────────────────────────────────────────

export interface TextSelectionState {
  hasSelection: boolean;
  selectedText: string;
  startBlockId: string | null;
  startOffset: number;
  startPrefix: string;
  startSuffix: string;
  endBlockId: string | null;
  endOffset: number;
  endPrefix: string;
  endSuffix: string;
}

const EMPTY_SELECTION: TextSelectionState = {
  hasSelection: false,
  selectedText: '',
  startBlockId: null,
  startOffset: 0,
  startPrefix: '',
  startSuffix: '',
  endBlockId: null,
  endOffset: 0,
  endPrefix: '',
  endSuffix: '',
};

const CONTEXT_CHARS = 30;

// ─── DOM Helpers ──────────────────────────────────────────────────────────

/**
 * Walk up the DOM from `node` to find the nearest ancestor (or self) that has
 * a `data-block-id` attribute. Returns the attribute value or null.
 */
function findBlockId(node: Node): string | null {
  let current: Node | null = node;
  while (current && current !== document) {
    if (current instanceof Element) {
      const id = current.getAttribute('data-block-id');
      if (id) return id;
    }
    current = current.parentNode;
  }
  return null;
}

/**
 * Extract the plain-text content of a DOM element by stripping HTML tags.
 * This mirrors the text-only offset counting described in §1.2 of the PRD.
 */
function getPlainText(blockElement: Element): string {
  return blockElement.textContent ?? '';
}

/**
 * Compute the text-only character offset for a given DOM range endpoint
 * relative to the block's plain text. The Selection API gives us a container
 * node + offset within that node; we need to map that to an offset within the
 * block's full plain-text string.
 */
function computeTextOffset(container: Node, domOffset: number, blockElement: Element): number {
  // Walk the block element's text nodes in document order, summing lengths
  // until we reach the container node.
  const walker = document.createTreeWalker(blockElement, NodeFilter.SHOW_TEXT);
  let textOffset = 0;

  let node = walker.nextNode();
  while (node) {
    if (node === container) {
      // Found the container — add the dom offset within this text node
      return textOffset + domOffset;
    }
    textOffset += (node.textContent ?? '').length;
    node = walker.nextNode();
  }

  // Fallback: if container is the element itself (not a text node), use domOffset
  // as a character index directly.
  return domOffset;
}

/**
 * Extract ~CONTEXT_CHARS characters before and after the given offset within
 * plain text.
 */
function extractContext(
  plainText: string,
  offset: number,
): { prefix: string; suffix: string } {
  const prefix = plainText.slice(Math.max(0, offset - CONTEXT_CHARS), offset);
  const suffix = plainText.slice(offset, offset + CONTEXT_CHARS);
  return { prefix, suffix };
}

/**
 * Find a `[data-block-id]` element within a root container.
 */
function findBlockElement(root: Element, blockId: string): Element | null {
  return root.querySelector(`[data-block-id="${CSS.escape(blockId)}"]`);
}

// ─── Hook ─────────────────────────────────────────────────────────────────

/**
 * useTextSelection — tracks browser text selections within a BlockEditor
 * container and maps them to TextAnchor-compatible position objects.
 *
 * Attach the returned `containerRef` to the BlockEditor root div.
 * The hook listens for `selectionchange` events and resolves the selection
 * back to (blockId, textOffset, prefix, suffix) pairs for start and end.
 *
 * Section 4.1 of text-span-addressing.md.
 */
export function useTextSelection() {
  const invoke = useKernelInvoke();
  const containerRef = useRef<HTMLElement | null>(null);
  const [selection, setSelection] = useState<TextSelectionState>(EMPTY_SELECTION);

  useEffect(() => {
    const handleSelectionChange = () => {
      const container = containerRef.current;
      if (!container) {
        setSelection(EMPTY_SELECTION);
        return;
      }

      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        setSelection(EMPTY_SELECTION);
        return;
      }

      const range = sel.getRangeAt(0);
      const selectedText = range.toString();
      if (!selectedText) {
        setSelection(EMPTY_SELECTION);
        return;
      }

      // Verify the selection is within our container
      if (!container.contains(range.commonAncestorContainer)) {
        setSelection(EMPTY_SELECTION);
        return;
      }

      // Resolve start position
      const startBlockId = findBlockId(range.startContainer);
      const endBlockId = findBlockId(range.endContainer);

      if (!startBlockId || !endBlockId) {
        setSelection(EMPTY_SELECTION);
        return;
      }

      const startBlockEl = findBlockElement(container, startBlockId);
      const endBlockEl = findBlockElement(container, endBlockId);

      if (!startBlockEl || !endBlockEl) {
        setSelection(EMPTY_SELECTION);
        return;
      }

      const startPlainText = getPlainText(startBlockEl);
      const endPlainText = getPlainText(endBlockEl);

      const startOffset = computeTextOffset(range.startContainer, range.startOffset, startBlockEl);
      const endOffset = computeTextOffset(range.endContainer, range.endOffset, endBlockEl);

      const { prefix: startPrefix, suffix: startSuffix } = extractContext(startPlainText, startOffset);
      const { prefix: endPrefix, suffix: endSuffix } = extractContext(endPlainText, endOffset);

      setSelection({
        hasSelection: true,
        selectedText,
        startBlockId,
        startOffset,
        startPrefix,
        startSuffix,
        endBlockId,
        endOffset,
        endPrefix,
        endSuffix,
      });
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, []);

  /**
   * Create TextAnchor records for start and end, then create a TextSpan
   * linking them. Returns the span ID on success, or null on failure.
   *
   * @param entityRef - The ContentNode ID this span lives in
   * @param kind - Semantic type (highlight, citation, comment-target, etc.)
   * @param label - Optional human-readable label
   */
  const createSpanFromSelection = useCallback(
    async (
      entityRef: string,
      kind: string,
      label?: string,
    ): Promise<string | null> => {
      if (!selection.hasSelection) return null;
      if (!selection.startBlockId || !selection.endBlockId) return null;

      try {
        // Create start anchor
        const startAnchorResult = await invoke('TextAnchor', 'create', {
          entityRef,
          blockId: selection.startBlockId,
          offset: selection.startOffset,
          prefix: selection.startPrefix,
          suffix: selection.startSuffix,
        });
        if (startAnchorResult.variant !== 'ok') return null;
        const startAnchor = startAnchorResult.anchor as string;

        // Create end anchor
        const endAnchorResult = await invoke('TextAnchor', 'create', {
          entityRef,
          blockId: selection.endBlockId,
          offset: selection.endOffset,
          prefix: selection.endPrefix,
          suffix: selection.endSuffix,
        });
        if (endAnchorResult.variant !== 'ok') return null;
        const endAnchor = endAnchorResult.anchor as string;

        // Create the span
        const spanResult = await invoke('TextSpan', 'create', {
          startAnchor,
          endAnchor,
          entityRef,
          kind,
          ...(label ? { label } : {}),
        });
        if (spanResult.variant !== 'ok') return null;
        return spanResult.span as string;
      } catch {
        return null;
      }
    },
    [invoke, selection],
  );

  return {
    selection,
    containerRef,
    createSpanFromSelection,
  };
}
