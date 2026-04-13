// micromark-extension-obsidian-callout — Obsidian callout syntax extension
// for micromark, per docs/plans/virtual-provider-registry-prd.md §4.8.
//
// Recognises the head line of an Obsidian callout block — a GitHub-callout
// superset with optional folding markers `+` / `-` after the keyword:
//
//   > [!note]+ Optional title   # expanded-by-default, foldable
//   > [!warning]- Optional title # collapsed-by-default, foldable
//   > [!tip] Plain title         # not foldable
//
// Body lines remain handled by micromark's built-in blockQuote rules;
// this extension only marks the head line with an `obsidianCalloutHead`
// token plus `foldable` / `defaultOpen` metadata derivable from the
// captured fold marker.
//
// Replaces the standalone obsidian-callout-parse Parse provider.

import type { Extension, Construct, Tokenizer, State, Code } from 'micromark-util-types';

export const KEYWORD_TO_ROLE: Record<string, string> = {
  note: 'note',
  abstract: 'info',
  summary: 'info',
  tldr: 'info',
  info: 'info',
  todo: 'info',
  tip: 'tip',
  hint: 'tip',
  important: 'important',
  success: 'success',
  check: 'success',
  done: 'success',
  question: 'info',
  help: 'info',
  faq: 'info',
  warning: 'warning',
  caution: 'caution',
  attention: 'warning',
  failure: 'danger',
  fail: 'danger',
  missing: 'danger',
  danger: 'danger',
  error: 'danger',
  bug: 'danger',
  example: 'tip',
  quote: 'note',
  cite: 'note',
};

export const OBSIDIAN_CALLOUT_HEAD_RE =
  /^>\s*\[!([A-Za-z][A-Za-z0-9_-]*)\]\s*([+\-])?\s*(.*)$/;

/**
 * Tokenize an Obsidian callout head inside a blockquote. Fires on `[`
 * and consumes through end-of-line, verifying the buffered content
 * matches the Obsidian head pattern.
 */
const tokenizeObsidianCalloutHead: Tokenizer = function (effects, ok, nok) {
  const self = this;
  let buffer = '';

  return start;

  function start(code: Code): State | undefined {
    const events = self.events;
    let sawBlockQuoteMarker = false;
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e[0] === 'enter' && e[1].type === 'blockQuotePrefix') {
        sawBlockQuoteMarker = true;
        break;
      }
      if (e[0] === 'enter' && e[1].type === 'chunkFlow') break;
    }
    if (!sawBlockQuoteMarker) return nok(code);

    if (code !== 91 /* [ */) return nok(code);
    effects.enter('obsidianCalloutHead');
    effects.consume(code);
    buffer = '[';
    return inside;
  }

  function inside(code: Code): State | undefined {
    if (code === null || code === -5 || code === -4 || code === -3) {
      if (!/^\[![A-Za-z][A-Za-z0-9_-]*\]/.test(buffer)) {
        effects.exit('obsidianCalloutHead');
        return nok(code);
      }
      effects.exit('obsidianCalloutHead');
      return ok(code);
    }
    effects.consume(code);
    buffer += String.fromCharCode(typeof code === 'number' ? code : 0);
    return inside;
  }
};

const obsidianCalloutHeadConstruct: Construct = {
  name: 'obsidianCalloutHead',
  tokenize: tokenizeObsidianCalloutHead,
};

/**
 * Factory returning a micromark syntax extension that recognises Obsidian
 * callouts.
 */
export function obsidianCallout(): Extension {
  return {
    flow: {
      [91 /* [ */]: [obsidianCalloutHeadConstruct],
    },
  };
}

/**
 * Pure helper: match a line against the Obsidian callout head pattern.
 * Returns keyword, paletteRole, title, and fold-marker-derived flags.
 */
export function matchObsidianCalloutHead(
  line: string,
): {
  keyword: string;
  paletteRole: string;
  title: string;
  foldable: boolean;
  defaultOpen: boolean;
} | null {
  const m = OBSIDIAN_CALLOUT_HEAD_RE.exec(line);
  if (!m) return null;
  const keyword = m[1].toLowerCase();
  const foldMarker = m[2] ?? '';
  return {
    keyword,
    paletteRole: KEYWORD_TO_ROLE[keyword] ?? 'note',
    title: (m[3] ?? '').trim(),
    foldable: foldMarker === '+' || foldMarker === '-',
    defaultOpen: foldMarker !== '-',
  };
}

export default obsidianCallout;
