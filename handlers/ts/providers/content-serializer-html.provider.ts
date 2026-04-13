// HTML ContentSerializer provider — implements the `html-serialize` provider
// id for target="html". Walks the ContentNode tree rooted at rootNodeId and
// emits semantic HTML5 as UTF-8 bytes.
//
// Registration is driven by `syncs/app/register-content-serializers.sync`
// which dispatches ContentSerializer/register(provider: "html-serialize",
// target: "html") once PluginRegistry advertises the content-serializer
// plugin type at boot. The concrete tree-walk function lives in the shared
// module-level registry (see content-serializer-provider-registry.ts).
//
// Schema mapping (schema -> HTML tag):
//   heading-1..6    -> <h1>..<h6>
//   paragraph       -> <p>
//   bullet-list     -> <ul><li>…
//   ordered-list    -> <ol><li>…
//   list-item       -> <li>
//   code-block      -> <pre><code class="language-…">
//   table/row/cell  -> <table><tr><td>
//   link            -> <a href="…">
//   blockquote      -> <blockquote>
//   horizontal-rule -> <hr/>
//   default         -> <div>

import {
  registerContentSerializerProvider,
  type ContentSerializerProviderFn,
  type FetchNode,
  type SerializerNode,
} from './content-serializer-provider-registry.ts';

export const CONTENT_SERIALIZER_PROVIDER_ID = 'html-serialize';
export const CONTENT_SERIALIZER_TARGET = 'html';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}

function parseMetadata(raw: string): Record<string, unknown> {
  if (!raw) return {};
  try {
    const v = JSON.parse(raw);
    return typeof v === 'object' && v !== null && !Array.isArray(v)
      ? v as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function schemaKind(schema: string): string {
  const s = (schema || '').toLowerCase().trim();
  return s || 'paragraph';
}

function renderInline(node: SerializerNode, fetchNode: FetchNode): string {
  const kind = schemaKind(node.schema);
  const body = node.body ?? '';
  if (kind === 'link') {
    const meta = parseMetadata(body);
    const text = String(meta.text ?? meta.label ?? '');
    const href = String(meta.href ?? meta.url ?? '');
    return `<a href="${escapeAttr(href)}">${escapeHtml(text)}</a>`;
  }
  if (kind === 'code-inline' || kind === 'inline-code') {
    return `<code>${escapeHtml(body)}</code>`;
  }
  if (kind === 'emphasis' || kind === 'italic') return `<em>${escapeHtml(body)}</em>`;
  if (kind === 'strong' || kind === 'bold') return `<strong>${escapeHtml(body)}</strong>`;
  const childText = node.childIds
    .map((id) => {
      const c = fetchNode(id);
      return c ? renderInline(c, fetchNode) : '';
    })
    .join('');
  return escapeHtml(body) + childText;
}

function renderBlock(node: SerializerNode, fetchNode: FetchNode): string {
  const kind = schemaKind(node.schema);
  const body = node.body ?? '';
  const children = node.childIds
    .map((id) => fetchNode(id))
    .filter((c): c is SerializerNode => c != null);

  const headingMatch = /^heading-([1-6])$/.exec(kind);
  if (headingMatch) {
    const level = Number(headingMatch[1]);
    return `<h${level}>${escapeHtml(body)}</h${level}>\n`;
  }

  if (kind === 'paragraph') {
    const inline = children.map((c) => renderInline(c, fetchNode)).join('');
    return `<p>${escapeHtml(body)}${inline}</p>\n`;
  }

  if (kind === 'bullet-list' || kind === 'unordered-list') {
    const items = children
      .map((c) => `  <li>${renderInline(c, fetchNode)}</li>`)
      .join('\n');
    return `<ul>\n${items}\n</ul>\n`;
  }

  if (kind === 'ordered-list' || kind === 'numbered-list') {
    const items = children
      .map((c) => `  <li>${renderInline(c, fetchNode)}</li>`)
      .join('\n');
    return `<ol>\n${items}\n</ol>\n`;
  }

  if (kind === 'list-item') {
    return `<li>${renderInline(node, fetchNode)}</li>\n`;
  }

  if (kind === 'code-block' || kind === 'code') {
    const meta = parseMetadata(body && body.startsWith('{') ? body : '');
    const lang = String(meta.language ?? meta.lang ?? '');
    const code = (meta.code as string | undefined) ?? body;
    const cls = lang ? ` class="language-${escapeAttr(lang)}"` : '';
    return `<pre><code${cls}>${escapeHtml(code)}</code></pre>\n`;
  }

  if (kind === 'table') {
    const rows = children.filter((c) => schemaKind(c.schema) === 'table-row');
    if (rows.length === 0) return '<table></table>\n';
    const renderRow = (r: SerializerNode, header: boolean) => {
      const cells = r.childIds
        .map((id) => fetchNode(id))
        .filter((c): c is SerializerNode => c != null)
        .map((c) => {
          const tag = header ? 'th' : 'td';
          return `    <${tag}>${renderInline(c, fetchNode)}</${tag}>`;
        })
        .join('\n');
      return `  <tr>\n${cells}\n  </tr>`;
    };
    const header = renderRow(rows[0], true);
    const rest = rows.slice(1).map((r) => renderRow(r, false)).join('\n');
    return `<table>\n${header}${rest ? '\n' + rest : ''}\n</table>\n`;
  }

  if (kind === 'blockquote' || kind === 'quote') {
    const inner = children.map((c) => renderBlock(c, fetchNode)).join('')
      || `<p>${escapeHtml(body)}</p>\n`;
    return `<blockquote>\n${inner}</blockquote>\n`;
  }

  if (kind === 'horizontal-rule' || kind === 'hr' || kind === 'thematic-break') {
    return '<hr/>\n';
  }

  // Container fallback.
  const head = body ? `<div>${escapeHtml(body)}</div>\n` : '';
  const tail = children.map((c) => renderBlock(c, fetchNode)).join('');
  if (!head && !tail) return '';
  return head + tail;
}

export const serializeHtml: ContentSerializerProviderFn = (
  rootNodeId,
  fetchNode,
  _config,
) => {
  const root = fetchNode(rootNodeId);
  if (!root) {
    return JSON.stringify({
      ok: false,
      target: CONTENT_SERIALIZER_TARGET,
      error: { message: `root node not found: ${rootNodeId}` },
    });
  }
  try {
    return renderBlock(root, fetchNode);
  } catch (err) {
    return JSON.stringify({
      ok: false,
      target: CONTENT_SERIALIZER_TARGET,
      error: {
        message:
          (err as Error)?.message ?? 'unknown html serialization error',
      },
    });
  }
};

registerContentSerializerProvider(
  CONTENT_SERIALIZER_PROVIDER_ID,
  serializeHtml,
);
