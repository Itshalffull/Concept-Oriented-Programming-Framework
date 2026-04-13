// GitHub-flavoured callout Parse provider.
//
// Implements the `github-callout-parse` provider for
// language="markdown-github-callout", layered on top of the markdown base.
// Recognises the GitHub callout dialect:
//
//   > [!NOTE] Optional title
//   > body line one
//   > body line two
//
// Accepted keywords (case-insensitive): NOTE, TIP, IMPORTANT, WARNING, CAUTION.
// Each keyword maps to a paletteRole used by downstream rendering.
//
// The provider returns a base64-encoded JSON document of shape:
//   { language: "markdown-github-callout",
//     provider: "github-callout-parse",
//     nodes: CalloutNode[] }
// where CalloutNode = { type: "callout", paletteRole, title, body }.
//
// Paragraphs of text that do not match the callout dialect are preserved
// verbatim as `{ type: "paragraph", body }` so the downstream smart-paste
// handler can still interleave callouts with surrounding prose.
//
// See docs/plans/block-editor-loose-ends-prd.md §LE-06.
import { registerParseProvider } from '../app/parse.handler.ts';

export interface GithubCalloutConfig {
  // Reserved for future knobs. Parsed from the config Bytes string as JSON.
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
  language: 'markdown-github-callout';
  provider: 'github-callout-parse';
  nodes: Node[];
}

const KEYWORD_TO_ROLE: Record<string, string> = {
  NOTE: 'note',
  TIP: 'tip',
  IMPORTANT: 'important',
  WARNING: 'warning',
  CAUTION: 'caution',
};

// Matches the first line of a GitHub callout block:
//   > [!NOTE] Optional title
const CALLOUT_HEAD_RE =
  /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$/i;

// Matches a continuation line of a blockquote: `> body` or `>` (empty).
const QUOTE_LINE_RE = /^>\s?(.*)$/;

/**
 * Parse `text` as GitHub-flavoured markdown with callout extensions and
 * return the callout/paragraph node list as base64-encoded JSON bytes.
 * `config` is an opaque Bytes payload; when non-empty it is parsed as JSON.
 */
export function parseGithubCallout(text: string, config?: string): string {
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
    if (body.length > 0) {
      nodes.push({ type: 'paragraph', body });
    }
    paragraphBuf = [];
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const head = CALLOUT_HEAD_RE.exec(line);
    if (head) {
      flushParagraph();
      const keyword = head[1].toUpperCase();
      const paletteRole = KEYWORD_TO_ROLE[keyword] ?? 'note';
      const title = (head[2] ?? '').trim();
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
      });
      continue;
    }
    paragraphBuf.push(line);
    i++;
  }
  flushParagraph();

  const ast: SerializableAst = {
    language: 'markdown-github-callout',
    provider: 'github-callout-parse',
    nodes,
  };
  return Buffer.from(JSON.stringify(ast)).toString('base64');
}

registerParseProvider('github-callout-parse', (text, config) =>
  parseGithubCallout(text, config),
);

export default parseGithubCallout;
