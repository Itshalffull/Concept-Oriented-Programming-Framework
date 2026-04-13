// micromark-extension-mkdocs-callout — MkDocs / Python-Markdown admonition
// syntax extension for micromark, per
// docs/plans/virtual-provider-registry-prd.md §4.8.
//
// Recognises the head line of an admonition block:
//
//   !!! note "Optional title"
//
// Body lines are indented (>= 4 spaces or tab) and remain handled by
// micromark's built-in indented-code / paragraph rules; this extension
// only marks the head line with a `mkdocsCalloutHead` token.
//
// Replaces the standalone mkdocs-callout-parse Parse provider.

import type { Extension, Construct, Tokenizer, State, Code } from 'micromark-util-types';

export const KEYWORD_TO_ROLE: Record<string, string> = {
  note: 'note',
  info: 'info',
  tip: 'tip',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  abstract: 'info',
  question: 'info',
  failure: 'danger',
  bug: 'danger',
  example: 'tip',
  quote: 'note',
};

export const MKDOCS_HEAD_RE =
  /^!!!\s+([A-Za-z][A-Za-z0-9_-]*)\s*(?:"([^"]*)")?\s*$/;

/**
 * Tokenize a `!!! keyword [ "title"]` head line. Fires on the first `!`
 * at line start.
 */
const tokenizeMkdocsCalloutHead: Tokenizer = function (effects, ok, nok) {
  let bangs = 0;
  let buffer = '';

  return start;

  function start(code: Code): State | undefined {
    if (code !== 33 /* ! */) return nok(code);
    effects.enter('mkdocsCalloutHead');
    effects.consume(code);
    bangs = 1;
    buffer = '!';
    return bangsState;
  }

  function bangsState(code: Code): State | undefined {
    if (code === 33 /* ! */ && bangs < 3) {
      effects.consume(code);
      bangs += 1;
      buffer += '!';
      return bangsState;
    }
    if (bangs !== 3) {
      effects.exit('mkdocsCalloutHead');
      return nok(code);
    }
    return rest(code);
  }

  function rest(code: Code): State | undefined {
    if (code === null || code === -5 || code === -4 || code === -3) {
      if (!MKDOCS_HEAD_RE.test(buffer)) {
        effects.exit('mkdocsCalloutHead');
        return nok(code);
      }
      effects.exit('mkdocsCalloutHead');
      return ok(code);
    }
    effects.consume(code);
    buffer += String.fromCharCode(typeof code === 'number' ? code : 0);
    return rest;
  }
};

const mkdocsCalloutHeadConstruct: Construct = {
  name: 'mkdocsCalloutHead',
  tokenize: tokenizeMkdocsCalloutHead,
  concrete: true,
};

/**
 * Factory returning a micromark syntax extension that recognises MkDocs
 * admonition blocks.
 */
export function mkdocsCallout(): Extension {
  return {
    flow: {
      [33 /* ! */]: [mkdocsCalloutHeadConstruct],
    },
  };
}

/**
 * Pure helper: match a line against the MkDocs admonition head pattern.
 */
export function matchMkdocsCalloutHead(
  line: string,
): { keyword: string; paletteRole: string; title: string } | null {
  const m = MKDOCS_HEAD_RE.exec(line);
  if (!m) return null;
  const keyword = m[1].toLowerCase();
  return {
    keyword,
    paletteRole: KEYWORD_TO_ROLE[keyword] ?? 'note',
    title: (m[2] ?? '').trim(),
  };
}

export default mkdocsCallout;
