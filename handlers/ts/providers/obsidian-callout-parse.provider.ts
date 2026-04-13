// Obsidian-flavoured callout Parse provider.
//
// Implements the `obsidian-callout-parse` provider for
// language="markdown-obsidian-callout", layered on top of the markdown base.
// Recognises the Obsidian callout dialect (a GitHub-callout superset with
// optional folding markers `+` / `-` after the keyword):
//
//   > [!note]+ Optional title   # expanded-by-default, foldable
//   > [!warning]- Optional title # collapsed-by-default, foldable
//   > [!tip] Plain title          # not foldable
//   > body line one
//   > body line two
//
// Accepted keywords (case-insensitive, matching the common Obsidian set):
// note, abstract, summary, tldr, info, todo, tip, hint, important, success,
// check, done, question, help, faq, warning, caution, attention, failure,
// fail, missing, danger, error, bug, example, quote, cite. Unknown keywords
// fall back to paletteRole "note".
//
// Output AST shape (base64-encoded JSON):
//   { language: "markdown-obsidian-callout",
//     provider: "obsidian-callout-parse",
//     nodes: (CalloutNode | ParagraphNode)[] }
// CalloutNode carries `paletteRole`, `title`, `body`, plus `foldable`
// (boolean) and `defaultOpen` (boolean) driven by the `+`/`-` marker.
//
// See docs/plans/block-editor-loose-ends-prd.md §LE-06.
import { registerParseProvider } from '../app/parse.handler.ts';

export interface ObsidianCalloutConfig {
  // Reserved for future knobs.
}

interface CalloutNode {
  type: 'callout';
  paletteRole: string;
  title: string;
  body: string;
  foldable: boolean;
  defaultOpen: boolean;
}

interface ParagraphNode {
  type: 'paragraph';
  body: string;
}

type Node = CalloutNode | ParagraphNode;

interface SerializableAst {
  language: 'markdown-obsidian-callout';
  provider: 'obsidian-callout-parse';
  nodes: Node[];
}

const KEYWORD_TO_ROLE: Record<string, string> = {
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

// Head line: `> [!keyword]` with optional `+` / `-` marker and optional title.
const CALLOUT_HEAD_RE =
  /^>\s*\[!([A-Za-z][A-Za-z0-9_-]*)\]\s*([+\-])?\s*(.*)$/;
const QUOTE_LINE_RE = /^>\s?(.*)$/;

/**
 * Parse `text` as Obsidian-flavoured markdown with callout extensions and
 * return the AST as base64-encoded JSON bytes.
 */
export function parseObsidianCallout(text: string, config?: string): string {
  if (config && config.length > 0) {
    try {
      JSON.parse(config);
    } catch {
      // Ignore malformed config.
    }
  }

  const lines = text.split(/\r?\n/);
  const nodes: Node[] = [];
  let paragraphBuf: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuf.length === 0) return;
    const body = paragraphBuf.join('\n').replace(/\n+$/, '');
    if (body.length > 0) nodes.push({ type: 'paragraph', body });
    paragraphBuf = [];
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const head = CALLOUT_HEAD_RE.exec(line);
    if (head) {
      flushParagraph();
      const keyword = head[1].toLowerCase();
      const foldMarker = head[2] ?? '';
      const paletteRole = KEYWORD_TO_ROLE[keyword] ?? 'note';
      const title = (head[3] ?? '').trim();
      const foldable = foldMarker === '+' || foldMarker === '-';
      // `+` expanded by default, `-` collapsed by default, none => open and
      // not foldable.
      const defaultOpen = foldMarker !== '-';
      const bodyLines: string[] = [];
      i++;
      while (i < lines.length) {
        const cont = QUOTE_LINE_RE.exec(lines[i]);
        if (!cont) break;
        bodyLines.push(cont[1]);
        i++;
      }
      nodes.push({
        type: 'callout',
        paletteRole,
        title,
        body: bodyLines.join('\n').replace(/\n+$/, ''),
        foldable,
        defaultOpen,
      });
      continue;
    }
    paragraphBuf.push(line);
    i++;
  }
  flushParagraph();

  const ast: SerializableAst = {
    language: 'markdown-obsidian-callout',
    provider: 'obsidian-callout-parse',
    nodes,
  };
  return Buffer.from(JSON.stringify(ast)).toString('base64');
}

registerParseProvider('obsidian-callout-parse', (text, config) =>
  parseObsidianCallout(text, config),
);

export default parseObsidianCallout;
