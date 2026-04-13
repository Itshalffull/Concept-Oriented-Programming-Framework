// MkDocs-flavoured callout (admonition) Parse provider.
//
// Implements the `mkdocs-callout-parse` provider for
// language="markdown-mkdocs-callout", layered on top of the markdown base.
// Recognises the MkDocs / Python-Markdown admonition dialect:
//
//   !!! note "Optional title"
//       body line one
//       body line two
//
// Accepted keywords (case-insensitive): note, info, tip, success, warning,
// danger (plus common aliases abstract, question, failure, bug, example,
// quote — mapped onto a small canonical palette role set).
//
// Output AST shape (base64-encoded JSON):
//   { language: "markdown-mkdocs-callout",
//     provider: "mkdocs-callout-parse",
//     nodes: (CalloutNode | ParagraphNode)[] }
//
// See docs/plans/block-editor-loose-ends-prd.md §LE-06.
import { registerParseProvider } from '../app/parse.handler.ts';

export interface MkdocsCalloutConfig {
  // Reserved for future knobs.
}

interface CalloutNode {
  type: 'callout';
  paletteRole: string;
  title: string;
  body: string;
}

interface ParagraphNode {
  type: 'paragraph';
  body: string;
}

type Node = CalloutNode | ParagraphNode;

interface SerializableAst {
  language: 'markdown-mkdocs-callout';
  provider: 'mkdocs-callout-parse';
  nodes: Node[];
}

const KEYWORD_TO_ROLE: Record<string, string> = {
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

// Head line: `!!! keyword` or `!!! keyword "Title"`.
const HEAD_RE = /^!!!\s+([A-Za-z][A-Za-z0-9_-]*)\s*(?:"([^"]*)")?\s*$/;
// Any indented (>= 4 spaces or tab) continuation line.
const INDENT_RE = /^(?: {4}|\t)(.*)$/;

/**
 * Parse `text` for MkDocs admonition blocks and return the AST as
 * base64-encoded JSON bytes.
 */
export function parseMkdocsCallout(text: string, config?: string): string {
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
    const head = HEAD_RE.exec(line);
    if (head) {
      flushParagraph();
      const keyword = head[1].toLowerCase();
      const paletteRole = KEYWORD_TO_ROLE[keyword] ?? 'note';
      const title = (head[2] ?? '').trim();
      const bodyLines: string[] = [];
      i++;
      // Consume indented lines (and blank lines interleaved with them).
      while (i < lines.length) {
        const cur = lines[i];
        const ind = INDENT_RE.exec(cur);
        if (ind) {
          bodyLines.push(ind[1]);
          i++;
          continue;
        }
        if (cur.trim() === '' && i + 1 < lines.length && INDENT_RE.test(lines[i + 1])) {
          bodyLines.push('');
          i++;
          continue;
        }
        break;
      }
      nodes.push({
        type: 'callout',
        paletteRole,
        title,
        body: bodyLines.join('\n').replace(/\n+$/, ''),
      });
      continue;
    }
    paragraphBuf.push(line);
    i++;
  }
  flushParagraph();

  const ast: SerializableAst = {
    language: 'markdown-mkdocs-callout',
    provider: 'mkdocs-callout-parse',
    nodes,
  };
  return Buffer.from(JSON.stringify(ast)).toString('base64');
}

registerParseProvider('mkdocs-callout-parse', (text, config) =>
  parseMkdocsCallout(text, config),
);

export default parseMkdocsCallout;
