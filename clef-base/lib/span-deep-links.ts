'use client';

/**
 * span-deep-links.ts — Deep link resolver for TextSpan/TextAnchor URL fragments.
 *
 * Implements §5 of docs/prd/text-span-addressing.md.
 *
 * Three fragment formats are supported:
 *
 *   /content/{entityId}#span={spanId}
 *   /content/{entityId}#anchor={anchorId}
 *   /content/{entityId}#text={prefix},{suffix}
 *
 * The `#text=` form is ephemeral — it resolves by fuzzy-matching prefix/suffix
 * against the current content without persisting any state (Chrome Text
 * Fragments pattern).
 */

import { useEffect, useRef, useCallback } from 'react';
import { useKernelInvoke } from './clef-provider';

// ─── Types ───────────────────────────────────────────────────────────────────

/** A parsed representation of a deep-link URL fragment. */
export type SpanFragment =
  | { type: 'span';   spanId: string }
  | { type: 'anchor'; anchorId: string }
  | { type: 'text';   prefix: string; suffix: string };

/** A single resolved block range that should be highlighted/scrolled to. */
export interface HighlightTarget {
  blockId: string;
  startOffset: number;
  endOffset: number;
  /** Text covered by this target (may be empty if content not available). */
  text: string;
}

/** Result of resolving a deep-link fragment against content. */
export type ResolveResult =
  | { status: 'ok';       targets: HighlightTarget[] }
  | { status: 'stale';    targets: HighlightTarget[] }
  | { status: 'notfound'; message: string }
  | { status: 'broken';   message: string }
  | { status: 'error';    message: string };

/** The invoke signature from useKernelInvoke / ClefProvider.invoke. */
type InvokeFn = (
  concept: string,
  action: string,
  input: Record<string, unknown>,
) => Promise<Record<string, unknown>>;

// ─── parseSpanFragment ───────────────────────────────────────────────────────

/**
 * Parse a URL hash string into a typed SpanFragment descriptor.
 *
 * Accepts the hash with or without the leading `#`.
 * Returns `null` when the fragment does not match any supported format.
 *
 * @example
 *   parseSpanFragment('#span=span-abc')   // { type: 'span', spanId: 'span-abc' }
 *   parseSpanFragment('#anchor=anc-1')    // { type: 'anchor', anchorId: 'anc-1' }
 *   parseSpanFragment('#text=hello, world') // { type: 'text', prefix: 'hello', suffix: ' world' }
 */
export function parseSpanFragment(hash: string): SpanFragment | null {
  // Normalise: strip leading '#' if present
  const fragment = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!fragment) return null;

  // #span={spanId}
  const spanMatch = fragment.match(/^span=(.+)$/);
  if (spanMatch) {
    const spanId = decodeURIComponent(spanMatch[1]);
    if (spanId) return { type: 'span', spanId };
  }

  // #anchor={anchorId}
  const anchorMatch = fragment.match(/^anchor=(.+)$/);
  if (anchorMatch) {
    const anchorId = decodeURIComponent(anchorMatch[1]);
    if (anchorId) return { type: 'anchor', anchorId };
  }

  // #text={prefix},{suffix}
  // The first comma separates prefix from suffix; commas inside values are
  // supported by percent-encoding (consistent with Chrome Text Fragments).
  const textMatch = fragment.match(/^text=(.+)$/);
  if (textMatch) {
    const raw = decodeURIComponent(textMatch[1]);
    const commaIdx = raw.indexOf(',');
    if (commaIdx !== -1) {
      const prefix = raw.slice(0, commaIdx);
      const suffix = raw.slice(commaIdx + 1);
      // Both may be empty strings — only reject if the entire value is blank
      if (prefix || suffix) {
        return { type: 'text', prefix, suffix };
      }
    }
  }

  return null;
}

// ─── resolveSpanFragment ─────────────────────────────────────────────────────

/**
 * Resolve a parsed deep-link fragment to a set of HighlightTargets.
 *
 * - `span`   → calls TextSpan/resolve to obtain block+offset fragments
 * - `anchor` → calls TextAnchor/resolve for a single position
 * - `text`   → ephemeral resolution: calls TextAnchor/create with a
 *               synthetic ID, resolves it, then deletes it (no persisted state)
 *
 * @param fragment       - Parsed fragment from parseSpanFragment
 * @param currentContent - JSON-serialised blocks string for the entity
 * @param invoke         - Kernel invoke function (from useKernelInvoke)
 * @param entityRef      - ContentNode ID (required for the `text` form)
 */
export async function resolveSpanFragment(
  fragment: SpanFragment,
  currentContent: string,
  invoke: InvokeFn,
  entityRef?: string,
): Promise<ResolveResult> {
  // ── span form ──────────────────────────────────────────────────────────────
  if (fragment.type === 'span') {
    let result: Record<string, unknown>;
    try {
      result = await invoke('TextSpan', 'resolve', {
        span: fragment.spanId,
        currentContent,
      });
    } catch (err) {
      return { status: 'error', message: String(err) };
    }

    if (result.variant === 'notfound') {
      return { status: 'notfound', message: String(result.message ?? 'Span not found') };
    }
    if (result.variant === 'broken') {
      return { status: 'broken', message: String(result.message ?? 'Span is broken') };
    }
    if (result.variant === 'ok' || result.variant === 'stale') {
      const targets = parseFragmentsField(result.fragments);
      return {
        status: result.variant as 'ok' | 'stale',
        targets,
      };
    }
    return { status: 'error', message: `Unexpected variant: ${String(result.variant)}` };
  }

  // ── anchor form ────────────────────────────────────────────────────────────
  if (fragment.type === 'anchor') {
    let result: Record<string, unknown>;
    try {
      result = await invoke('TextAnchor', 'resolve', {
        anchor: fragment.anchorId,
        currentContent,
      });
    } catch (err) {
      return { status: 'error', message: String(err) };
    }

    if (result.variant === 'notfound') {
      return { status: 'notfound', message: String(result.message ?? 'Anchor not found') };
    }
    if (result.variant === 'orphaned') {
      return { status: 'broken', message: String(result.message ?? 'Anchor is orphaned') };
    }
    if (result.variant === 'ok' || result.variant === 'relocated') {
      const blockId = String(result.blockId ?? '');
      const offset  = Number(result.offset  ?? 0);
      const status  = result.variant === 'ok' ? 'ok' as const : 'stale' as const;
      return {
        status,
        // An anchor is a point, not a range; expose a zero-width target so
        // callers can still scroll to the correct block.
        targets: [{ blockId, startOffset: offset, endOffset: offset, text: '' }],
      };
    }
    return { status: 'error', message: `Unexpected variant: ${String(result.variant)}` };
  }

  // ── text form (ephemeral anchor — Chrome Text Fragments pattern) ───────────
  if (fragment.type === 'text') {
    if (!entityRef) {
      return { status: 'error', message: 'entityRef is required for text= deep links' };
    }

    const ephemeralId = `__deeplink_text_${Date.now()}_${Math.random().toString(36).slice(2)}`;

    // Create a temporary anchor — used only for resolution, deleted immediately.
    let createResult: Record<string, unknown>;
    try {
      createResult = await invoke('TextAnchor', 'create', {
        anchor: ephemeralId,
        entityRef,
        blockId:    '',           // unknown at URL-parse time; relocation will find the block
        offset:     0,
        prefix:     fragment.prefix,
        suffix:     fragment.suffix,
        contentHash: '',
      });
    } catch (err) {
      return { status: 'error', message: String(err) };
    }

    if (createResult.variant !== 'ok') {
      return {
        status: 'error',
        message: String(createResult.message ?? 'Could not create ephemeral anchor for text= fragment'),
      };
    }

    // Resolve the ephemeral anchor
    let resolveResult: Record<string, unknown>;
    try {
      resolveResult = await invoke('TextAnchor', 'resolve', {
        anchor: ephemeralId,
        currentContent,
      });
    } catch (err) {
      // Best-effort cleanup even on resolve failure
      void invoke('TextAnchor', 'delete', { anchor: ephemeralId }).catch(() => undefined);
      return { status: 'error', message: String(err) };
    }

    // Clean up the ephemeral anchor — fire-and-forget, non-blocking.
    void invoke('TextAnchor', 'delete', { anchor: ephemeralId }).catch(() => undefined);

    if (resolveResult.variant === 'orphaned') {
      return { status: 'broken', message: 'Text fragment not found in current content' };
    }
    if (resolveResult.variant === 'ok' || resolveResult.variant === 'relocated') {
      const blockId = String(resolveResult.blockId ?? '');
      const offset  = Number(resolveResult.offset  ?? 0);
      const contextLen = fragment.prefix.length + fragment.suffix.length;
      const status  = resolveResult.variant === 'ok' ? 'ok' as const : 'stale' as const;
      return {
        status,
        targets: [{
          blockId,
          startOffset: Math.max(0, offset - fragment.prefix.length),
          endOffset:   offset + fragment.suffix.length,
          // Width approximated from the context strings; actual text requires
          // the caller to slice from rendered content.
          text: '',
        }],
      };
    }
    return { status: 'error', message: `Unexpected variant: ${String(resolveResult.variant)}` };
  }

  return { status: 'error', message: 'Unknown fragment type' };
}

// ─── useSpanDeepLink ─────────────────────────────────────────────────────────

/**
 * React hook that reads the current URL hash, resolves any span/anchor/text
 * deep link, and scrolls to + highlights the target on mount.
 *
 * Integrates with the existing clef-base navigation pattern:
 * - Uses useKernelInvoke for concept calls (consistent with useEntitySpans)
 * - Fires once on mount (and again when entityRef or content change)
 * - Attaches a CSS class `span-deep-link-target` to matched DOM elements
 *   so the page can style the scroll target
 *
 * @param entityRef      - ContentNode ID for the current page
 * @param currentContent - JSON-serialised blocks string for the entity
 */
export function useSpanDeepLink(
  entityRef: string | undefined,
  currentContent: string,
): void {
  const invoke = useKernelInvoke();
  // Track the last applied hash so we don't re-scroll unnecessarily
  const lastHash = useRef<string | null>(null);

  const resolveAndScroll = useCallback(async () => {
    if (typeof window === 'undefined' || !entityRef) return;

    const hash = window.location.hash;
    if (!hash || hash === lastHash.current) return;

    const fragment = parseSpanFragment(hash);
    if (!fragment) return;

    lastHash.current = hash;

    const result = await resolveSpanFragment(
      fragment,
      currentContent,
      invoke,
      entityRef,
    );

    if (result.status === 'error' || result.status === 'notfound' || result.status === 'broken') {
      return;
    }

    const { targets } = result;
    if (!targets || targets.length === 0) return;

    // First target determines the scroll destination.
    const primary = targets[0];

    // Remove any previous deep-link highlight markers
    document
      .querySelectorAll('[data-deep-link-block]')
      .forEach(el => {
        el.removeAttribute('data-deep-link-block');
        el.classList.remove('span-deep-link-target');
      });

    // Find the block element in the DOM via data-block-id attribute.
    // BlockEditor renders blocks with data-block-id={blockId} (§4.1).
    const blockEl = primary.blockId
      ? document.querySelector<HTMLElement>(`[data-block-id="${primary.blockId}"]`)
      : null;

    if (blockEl) {
      blockEl.setAttribute('data-deep-link-block', 'true');
      blockEl.classList.add('span-deep-link-target');
      blockEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } else {
      // Fallback: scroll to the first span with a matching data-span-id attribute
      // (relevant for the `span` form when the span is already rendered).
      if (fragment.type === 'span') {
        const spanEl = document.querySelector<HTMLElement>(
          `[data-span-id="${fragment.spanId}"]`,
        );
        if (spanEl) {
          spanEl.classList.add('span-deep-link-target');
          spanEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }

    // Highlight the block range using a temporary highlight span overlay when
    // the resolved target has a non-zero width.
    if (primary.startOffset < primary.endOffset && blockEl) {
      applyDeepLinkHighlight(blockEl, primary.startOffset, primary.endOffset);
    }
  }, [entityRef, currentContent, invoke]);

  useEffect(() => {
    void resolveAndScroll();
  }, [resolveAndScroll]);
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Parse the `fragments` field from a TextSpan/resolve response into an array
 * of HighlightTarget objects. Accepts both JSON string and array forms.
 */
function parseFragmentsField(raw: unknown): HighlightTarget[] {
  let items: Array<Record<string, unknown>> = [];

  if (typeof raw === 'string') {
    try {
      items = JSON.parse(raw) as typeof items;
    } catch {
      return [];
    }
  } else if (Array.isArray(raw)) {
    items = raw as typeof items;
  } else {
    return [];
  }

  return items.map(f => ({
    blockId:     String(f.blockId     ?? ''),
    startOffset: Number(f.startOffset ?? 0),
    endOffset:   Number(f.endOffset   ?? 0),
    text:        String(f.text        ?? ''),
  }));
}

/**
 * Inject a temporary highlight overlay inside a block element for the resolved
 * character range.  This uses a CSS custom property `--deep-link-highlight` so
 * the host application can theme the colour without touching this file.
 *
 * The overlay is removed after 3 seconds so it does not interfere with normal
 * span rendering.
 */
function applyDeepLinkHighlight(
  blockEl: HTMLElement,
  startOffset: number,
  endOffset: number,
): void {
  // Walk text nodes inside blockEl, inserting a temporary <mark> around
  // the character range [startOffset, endOffset] in plain-text coordinates.
  const treeWalker = document.createTreeWalker(blockEl, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let node: Text | null = treeWalker.nextNode() as Text | null;
  while (node) {
    textNodes.push(node);
    node = treeWalker.nextNode() as Text | null;
  }

  let plainPos = 0;
  const injected: HTMLElement[] = [];

  for (const textNode of textNodes) {
    const len = textNode.textContent?.length ?? 0;
    const nodeEnd = plainPos + len;

    const overlapStart = Math.max(startOffset, plainPos);
    const overlapEnd   = Math.min(endOffset,   nodeEnd);

    if (overlapStart < overlapEnd) {
      const localStart = overlapStart - plainPos;
      const localEnd   = overlapEnd   - plainPos;

      // Split the text node and wrap the middle segment in a <mark>
      const before = textNode.textContent?.slice(0, localStart) ?? '';
      const middle = textNode.textContent?.slice(localStart, localEnd) ?? '';
      const after  = textNode.textContent?.slice(localEnd) ?? '';

      const mark = document.createElement('mark');
      mark.className = 'span-deep-link-highlight';
      mark.style.cssText =
        'background: var(--deep-link-highlight, rgba(250,204,21,0.55)); ' +
        'border-radius: 2px; transition: background 0.4s;';
      mark.textContent = middle;

      const parent = textNode.parentNode;
      if (parent) {
        const afterNode = after ? document.createTextNode(after) : null;
        parent.insertBefore(document.createTextNode(before), textNode);
        parent.insertBefore(mark, textNode);
        if (afterNode) parent.insertBefore(afterNode, textNode);
        parent.removeChild(textNode);
        injected.push(mark);
      }
    }

    plainPos = nodeEnd;
    if (plainPos >= endOffset) break;
  }

  // Remove the temporary highlight after 3 seconds
  if (injected.length > 0) {
    setTimeout(() => {
      for (const mark of injected) {
        const parent = mark.parentNode;
        if (parent) {
          // Replace <mark> with its text content
          parent.replaceChild(
            document.createTextNode(mark.textContent ?? ''),
            mark,
          );
          parent.normalize(); // merge adjacent text nodes
        }
      }
      blockEl.removeAttribute('data-deep-link-block');
      blockEl.classList.remove('span-deep-link-target');
    }, 3000);
  }
}
