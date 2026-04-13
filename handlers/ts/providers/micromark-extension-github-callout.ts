// micromark-extension-github-callout — GitHub-flavoured callout syntax
// extension for micromark, per docs/plans/virtual-provider-registry-prd.md
// §4.8.
//
// Recognises the head line of a GitHub callout block:
//
//   > [!NOTE] Optional title
//
// Accepted keywords (case-insensitive): NOTE, TIP, IMPORTANT, WARNING,
// CAUTION. The body lines (continuation blockquote lines) remain handled
// by micromark's built-in blockQuote construct, so downstream consumers
// see a normal blockQuote token tree with an additional
// `githubCalloutHead` token marking the head line.
//
// Replaces the standalone github-callout-parse Parse provider. One
// markdown slot + an optional extension entry in the provider manifest
// yields the same capability without per-dialect slot proliferation.

import type { Extension, Construct, Tokenizer, State, Code } from 'micromark-util-types';

const ACCEPTED_KEYWORDS = new Set([
  'NOTE',
  'TIP',
  'IMPORTANT',
  'WARNING',
  'CAUTION',
]);

export const KEYWORD_TO_ROLE: Record<string, string> = {
  NOTE: 'note',
  TIP: 'tip',
  IMPORTANT: 'important',
  WARNING: 'warning',
  CAUTION: 'caution',
};

// `> [!KEYWORD] Optional title`
export const GITHUB_CALLOUT_HEAD_RE =
  /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$/i;

/**
 * Tokenize a GitHub callout head line. Called after micromark's blockQuote
 * start (the `>` marker) has matched; we consume the rest of the line if
 * it looks like `[!KEYWORD] ...` and emit a single `githubCalloutHead`
 * token. Otherwise we defer (nok) and normal blockquote tokenisation
 * proceeds.
 */
const tokenizeGithubCalloutHead: Tokenizer = function (effects, ok, nok) {
  const self = this;
  let buffer = '';

  return start;

  function start(code: Code): State | undefined {
    // Only fire after `>` + optional whitespace.
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
    effects.enter('githubCalloutHead');
    effects.consume(code);
    buffer = '[';
    return inside;
  }

  function inside(code: Code): State | undefined {
    if (code === null || code === -5 || code === -4 || code === -3) {
      const match = /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i.exec(buffer);
      if (!match) {
        effects.exit('githubCalloutHead');
        return nok(code);
      }
      effects.exit('githubCalloutHead');
      return ok(code);
    }
    effects.consume(code);
    buffer += String.fromCharCode(typeof code === 'number' ? code : 0);
    return inside;
  }
};

const githubCalloutHeadConstruct: Construct = {
  name: 'githubCalloutHead',
  tokenize: tokenizeGithubCalloutHead,
};

/**
 * Factory returning a micromark syntax extension that recognises
 * GitHub-flavoured callouts.
 */
export function githubCallout(): Extension {
  return {
    // Hook into flow content: head lines live inside blockquote flow.
    flow: {
      [91 /* [ */]: [githubCalloutHeadConstruct],
    },
  };
}

/**
 * Pure helper: match a line against the GitHub callout head pattern and
 * return the parsed `{keyword, paletteRole, title}` or null. Retained
 * so downstream consumers (e.g. post-processing step of micromark-parse)
 * can identify callout heads without re-running the regex themselves.
 */
export function matchGithubCalloutHead(
  line: string,
): { keyword: string; paletteRole: string; title: string } | null {
  const m = GITHUB_CALLOUT_HEAD_RE.exec(line);
  if (!m) return null;
  const keyword = m[1].toUpperCase();
  if (!ACCEPTED_KEYWORDS.has(keyword)) return null;
  return {
    keyword,
    paletteRole: KEYWORD_TO_ROLE[keyword] ?? 'note',
    title: (m[2] ?? '').trim(),
  };
}

export default githubCallout;
