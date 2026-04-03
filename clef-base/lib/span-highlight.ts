/**
 * span-highlight.ts — HTML content highlighter for TextSpan fragments.
 *
 * Wraps character ranges within a block's HTML content in
 * <span data-span-id="..." class="span-highlight span-{kind}"> elements.
 *
 * Implements §4.2 of text-span-addressing.md.
 *
 * Offset arithmetic operates on the plain-text character positions that
 * TextAnchor records (text-only, tags excluded) — consistent with the
 * offset scheme used throughout the TextAnchor/TextSpan concepts.
 */

import type { SpanFragment } from './use-entity-spans';

// ─── Kind → color mapping ──────────────────────────────────────────────────

/**
 * CSS custom property names for each span kind.
 * These map to the variables declared in globals.css.
 */
const KIND_COLORS: Record<string, string> = {
  highlight:       'var(--span-color-highlight, rgba(253,224,71,0.45))',
  citation:        'var(--span-color-citation, rgba(96,165,250,0.35))',
  excerpt:         'var(--span-color-excerpt, rgba(52,211,153,0.35))',
  'comment-target':'var(--span-color-comment-target, rgba(251,146,60,0.40))',
  'ai-suggestion': 'var(--span-color-ai-suggestion, rgba(167,139,250,0.35))',
  'search-result': 'var(--span-color-search-result, rgba(250,204,21,0.50))',
  redaction:       'var(--span-color-redaction, rgba(100,100,100,0.50))',
};

function kindColor(kind: string, colorOverride?: string): string {
  if (colorOverride) return colorOverride;
  return KIND_COLORS[kind] ?? KIND_COLORS.highlight;
}

// ─── DOM-text splitting helpers ─────────────────────────────────────────────

/**
 * A minimal HTML parse tree node (text or element).
 * We use a purpose-built mini-parser rather than DOMParser to stay
 * in a non-browser context (server components, tests).
 */
type HtmlNode =
  | { kind: 'text'; text: string }
  | { kind: 'tag'; raw: string; selfClosing: boolean };

/**
 * Tokenise an HTML string into a flat list of text nodes and tag tokens.
 * Tags are kept verbatim; text nodes carry raw decoded text.
 *
 * This is intentionally minimal — it handles the subset of HTML that
 * contentEditable blocks emit (no CDATA, no comments, balanced tags).
 */
function tokenise(html: string): HtmlNode[] {
  const nodes: HtmlNode[] = [];
  let i = 0;
  while (i < html.length) {
    if (html[i] === '<') {
      const end = html.indexOf('>', i);
      if (end === -1) {
        // Malformed — treat rest as text
        nodes.push({ kind: 'text', text: html.slice(i) });
        break;
      }
      const raw = html.slice(i, end + 1);
      const selfClosing = raw.endsWith('/>') || /^<(br|hr|img|input|link|meta|area|base|col|embed|param|source|track|wbr)[\s/>]/i.test(raw);
      nodes.push({ kind: 'tag', raw, selfClosing });
      i = end + 1;
    } else {
      const next = html.indexOf('<', i);
      const end = next === -1 ? html.length : next;
      nodes.push({ kind: 'text', text: html.slice(i, end) });
      i = end;
    }
  }
  return nodes;
}

/**
 * Compute plain-text length of an HTML string (tags excluded).
 */
function plainTextLength(html: string): number {
  return html.replace(/<[^>]*>/g, '').length;
}

/**
 * Build an opening highlight span tag for a given fragment.
 */
function openTag(frag: SpanFragment): string {
  const safeName = frag.kind.replace(/[^a-z0-9-]/gi, '-');
  const bg = kindColor(frag.kind, frag.color);
  return (
    `<span data-span-id="${frag.spanId}" ` +
    `class="span-highlight span-${safeName}" ` +
    `style="background: ${bg}; cursor: pointer;" ` +
    `data-span-kind="${frag.kind}">`
  );
}

const CLOSE_TAG = '</span>';

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Apply text-span highlight wrappers to block HTML content.
 *
 * Algorithm:
 * 1. Tokenise the HTML into text nodes and tag tokens.
 * 2. Walk tokens, tracking plain-text character position.
 * 3. At each text node, emit any `openTag`s whose startOffset falls within
 *    the text node's range and any `closeTag`s whose endOffset falls within it.
 * 4. For overlapping spans, tags are nested: the first-opening span wraps
 *    subsequent ones (inner spans close and re-open around shared boundaries).
 *
 * Limitations:
 * - Offsets must be within [0, plainTextLength(html)].
 * - Fragments that start or end inside an HTML tag are clamped to the tag boundary.
 * - Cross-node entity-ref spans are handled naturally because we re-open after tags.
 *
 * @param html       - The block's raw HTML content string
 * @param fragments  - SpanFragment objects for this block, sorted by startOffset
 * @returns Modified HTML string with highlight wrappers inserted
 */
export function highlightBlockContent(html: string, fragments: SpanFragment[]): string {
  if (!fragments || fragments.length === 0) return html;

  // Filter to valid fragments and sort by startOffset ascending
  const frags = fragments
    .filter(f => f.startOffset < f.endOffset)
    .sort((a, b) => a.startOffset - b.startOffset);

  if (frags.length === 0) return html;

  const tokens = tokenise(html);
  let result = '';
  let plainPos = 0; // current plain-text cursor position

  // Track which spans are currently "open" (we have emitted their openTag
  // but not yet their closeTag)
  const openSpans: SpanFragment[] = [];

  for (const token of tokens) {
    if (token.kind === 'tag') {
      // Before emitting a tag, close any open spans so we don't nest spans
      // across element boundaries (avoids malformed HTML like <b><span></b>).
      // We re-open them after the tag if they haven't ended yet.
      const toReopen: SpanFragment[] = [...openSpans];
      if (openSpans.length > 0) {
        for (let i = openSpans.length - 1; i >= 0; i--) {
          result += CLOSE_TAG;
        }
        openSpans.length = 0;
      }

      result += token.raw;

      // Re-open spans that are still active after this tag
      for (const span of toReopen) {
        if (span.endOffset > plainPos) {
          result += openTag(span);
          openSpans.push(span);
        }
      }
    } else {
      // Text node — handle span open/close events within this node
      const text = token.text;
      const nodeEnd = plainPos + text.length;
      let textCursor = 0; // offset within `text`

      // Process all events (opens and closes) that fall within this text node
      // We merge opens (frags with startOffset in [plainPos, nodeEnd)) and
      // closes (openSpans with endOffset in (plainPos, nodeEnd]) into a
      // sorted event list.
      type Event =
        | { at: number; type: 'open'; frag: SpanFragment }
        | { at: number; type: 'close'; frag: SpanFragment };

      const events: Event[] = [];

      for (const frag of frags) {
        if (frag.startOffset >= plainPos && frag.startOffset < nodeEnd) {
          events.push({ at: frag.startOffset, type: 'open', frag });
        }
      }
      for (const frag of openSpans) {
        if (frag.endOffset > plainPos && frag.endOffset <= nodeEnd) {
          events.push({ at: frag.endOffset, type: 'close', frag });
        }
      }

      // Sort events: earlier offset first; closes before opens at same position
      events.sort((a, b) => {
        if (a.at !== b.at) return a.at - b.at;
        // close before open at same position
        if (a.type === 'close' && b.type === 'open') return -1;
        if (a.type === 'open' && b.type === 'close') return 1;
        return 0;
      });

      for (const evt of events) {
        const localAt = evt.at - plainPos; // offset within text
        // Emit text up to this event
        result += text.slice(textCursor, localAt);
        textCursor = localAt;

        if (evt.type === 'open') {
          result += openTag(evt.frag);
          openSpans.push(evt.frag);
        } else {
          // Close: we need to close the innermost open spans back to (and including) this one,
          // then re-open the ones that are still active (deeper nesting)
          let idx = -1;
          for (let i = openSpans.length - 1; i >= 0; i--) {
            if (openSpans[i].spanId === evt.frag.spanId) { idx = i; break; }
          }
          if (idx !== -1) {
            // Close from innermost to this span
            const toReopen2: SpanFragment[] = [];
            for (let i = openSpans.length - 1; i > idx; i--) {
              result += CLOSE_TAG;
              toReopen2.unshift(openSpans[i]);
            }
            result += CLOSE_TAG; // close the target span
            openSpans.splice(idx, openSpans.length - idx);
            // Re-open the ones that were nested inside
            for (const s of toReopen2) {
              result += openTag(s);
              openSpans.push(s);
            }
          }
        }
      }

      // Emit remaining text after last event
      result += text.slice(textCursor);
      plainPos = nodeEnd;
    }
  }

  // Close any spans still open at end of content
  for (let i = openSpans.length - 1; i >= 0; i--) {
    result += CLOSE_TAG;
  }

  return result;
}
