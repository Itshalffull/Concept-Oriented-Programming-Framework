// domparser-parse provider — Parse provider for language="html"
//
// Parses an HTML source string into a simplified DOM tree and returns a
// JSON-encoded representation as Bytes (base64-encoded UTF-8). The node
// shape is intentionally minimal and portable across runtimes:
//
//   { tag: string, attrs: Record<string,string>, children: Array<Node | string> }
//
// Uses the browser's global DOMParser when available (window.DOMParser)
// and falls back to @xmldom/xmldom for Node / test environments. No
// configuration options are currently defined; the `config` bytes are
// accepted for forward compatibility and otherwise ignored.
//
// See block-editor-loose-ends-prd §2.5 (Parse providers, item 8).

/** Bytes is modelled as a base64-encoded string at the interface layer. */
export type Bytes = string;

/** Simplified DOM tree node. */
export interface SimpleElement {
  tag: string;
  attrs: Record<string, string>;
  children: Array<SimpleElement | string>;
}

// Minimal subset of the DOM we touch so this module typechecks without
// pulling @types/dom.
type DomNode = {
  nodeType: number;
  nodeName: string;
  nodeValue?: string | null;
  childNodes?: ArrayLike<DomNode>;
  attributes?: ArrayLike<{ name: string; value: string }> | null;
};

type DomParserCtor = new () => {
  parseFromString(text: string, mimeType: string): { documentElement: DomNode | null; childNodes?: ArrayLike<DomNode> };
};

function resolveDomParser(): DomParserCtor {
  const g = globalThis as unknown as { DOMParser?: DomParserCtor };
  if (typeof g.DOMParser === 'function') {
    return g.DOMParser;
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@xmldom/xmldom') as { DOMParser: DomParserCtor };
  return mod.DOMParser;
}

const ELEMENT_NODE = 1;
const TEXT_NODE = 3;

function simplify(node: DomNode): SimpleElement | string | null {
  if (node.nodeType === TEXT_NODE) {
    const text = node.nodeValue ?? '';
    return text.length > 0 ? text : null;
  }
  if (node.nodeType !== ELEMENT_NODE) {
    return null;
  }
  const attrs: Record<string, string> = {};
  const attrList = node.attributes;
  if (attrList) {
    for (let i = 0; i < attrList.length; i++) {
      const a = attrList[i];
      attrs[a.name] = a.value;
    }
  }
  const children: Array<SimpleElement | string> = [];
  const kids = node.childNodes;
  if (kids) {
    for (let i = 0; i < kids.length; i++) {
      const simplified = simplify(kids[i]);
      if (simplified !== null) children.push(simplified);
    }
  }
  return {
    tag: node.nodeName.toLowerCase(),
    attrs,
    children,
  };
}

function encodeBytes(obj: unknown): Bytes {
  const json = JSON.stringify(obj);
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(json, 'utf8').toString('base64');
  }
  // Browser fallback
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const btoaFn = (globalThis as any).btoa as ((s: string) => string) | undefined;
  if (btoaFn) {
    return btoaFn(unescape(encodeURIComponent(json)));
  }
  throw new Error('No base64 encoder available');
}

/**
 * Parse an HTML string into a simplified DOM tree and return a base64-encoded
 * JSON serialisation as Bytes.
 *
 * @param text   HTML source to parse
 * @param config Reserved for forward compatibility; currently ignored
 * @returns      Base64-encoded JSON of the root element (or null-tree when empty)
 */
export function parseHtml(text: string, _config?: Bytes): Bytes {
  const Parser = resolveDomParser();
  const parser = new Parser();
  const doc = parser.parseFromString(text ?? '', 'text/html');

  // Prefer documentElement when present (full document or xmldom fragment
  // wrapped in a synthetic root). Otherwise walk child nodes.
  const root = doc.documentElement;
  let tree: SimpleElement | null = null;
  if (root) {
    const simplified = simplify(root);
    tree = typeof simplified === 'string' || simplified === null ? null : simplified;
  }

  // If there was no root element (empty input), emit an empty tree node.
  if (!tree) {
    tree = { tag: '#document', attrs: {}, children: [] };
  }

  return encodeBytes(tree);
}

export default parseHtml;
