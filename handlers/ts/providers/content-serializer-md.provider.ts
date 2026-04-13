// Markdown ContentSerializer provider — implements the `micromark-serialize`
// provider id for target="markdown". Walks the ContentNode tree rooted at
// rootNodeId and emits GFM-flavored markdown as UTF-8 bytes.
//
// Registration is driven by `syncs/app/register-content-serializers.sync`
// which dispatches ContentSerializer/register(provider: "micromark-serialize",
// target: "markdown") once PluginRegistry advertises the content-serializer
// plugin type at boot. The concrete tree-walk function lives in the shared
// module-level registry (see content-serializer-provider-registry.ts).
//
// Schema mapping (schema -> markdown):
//   heading-1..6    -> "# " .. "###### "  + body + "\n\n"
//   paragraph       -> body + "\n\n"
//   bullet-list     -> (container) children as "- " lines
//   ordered-list    -> (container) children as "1. ", "2. " lines
//   list-item       -> body (indent handled by parent)
//   code-block      -> fenced "```lang\n body \n```\n\n"
//   table           -> (container) GFM pipe table from row/cell children
//   table-row       -> | cell | cell | …
//   table-cell      -> body (joined by parent)
//   link            -> [body](href) (href in metadata JSON)
//   blockquote      -> "> " prefix on each body line
//   horizontal-rule -> "---\n\n"
//   default         -> body as plain text

import {
  registerContentSerializerProvider,
  type ContentSerializerProviderFn,
  type FetchNode,
  type SerializerNode,
} from './content-serializer-provider-registry.ts';

export const CONTENT_SERIALIZER_PROVIDER_ID = 'micromark-serialize';
export const CONTENT_SERIALIZER_TARGET = 'markdown';

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
    return `[${text}](${href})`;
  }
  if (kind === 'code-inline' || kind === 'inline-code') return `\`${body}\``;
  if (kind === 'emphasis' || kind === 'italic') return `*${body}*`;
  if (kind === 'strong' || kind === 'bold') return `**${body}**`;
  // Fallback: body plus children bodies
  const childText = node.childIds
    .map((id) => {
      const c = fetchNode(id);
      return c ? renderInline(c, fetchNode) : '';
    })
    .join('');
  return body + childText;
}

function renderBlock(
  node: SerializerNode,
  fetchNode: FetchNode,
  depth: number,
): string {
  const kind = schemaKind(node.schema);
  const body = node.body ?? '';
  const children = node.childIds
    .map((id) => fetchNode(id))
    .filter((c): c is SerializerNode => c != null);

  const headingMatch = /^heading-([1-6])$/.exec(kind);
  if (headingMatch) {
    const level = Number(headingMatch[1]);
    return `${'#'.repeat(level)} ${body}\n\n`;
  }

  if (kind === 'paragraph') {
    const inline = children.map((c) => renderInline(c, fetchNode)).join('');
    return `${body}${inline}\n\n`;
  }

  if (kind === 'bullet-list' || kind === 'unordered-list') {
    return children
      .map((c) => `- ${renderInline(c, fetchNode).trimEnd()}\n`)
      .join('') + '\n';
  }

  if (kind === 'ordered-list' || kind === 'numbered-list') {
    return children
      .map((c, i) => `${i + 1}. ${renderInline(c, fetchNode).trimEnd()}\n`)
      .join('') + '\n';
  }

  if (kind === 'list-item') {
    return renderInline(node, fetchNode);
  }

  if (kind === 'code-block' || kind === 'code') {
    const meta = parseMetadata(node.body && node.body.startsWith('{') ? node.body : '');
    const lang = String(meta.language ?? meta.lang ?? '');
    const code = (meta.code as string | undefined) ?? body;
    return `\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
  }

  if (kind === 'table') {
    const rows = children.filter((c) => schemaKind(c.schema) === 'table-row');
    if (rows.length === 0) return '';
    const renderRow = (r: SerializerNode) => {
      const cells = r.childIds
        .map((id) => fetchNode(id))
        .filter((c): c is SerializerNode => c != null)
        .map((c) => renderInline(c, fetchNode).replace(/\|/g, '\\|').trim());
      return `| ${cells.join(' | ')} |`;
    };
    const header = renderRow(rows[0]);
    const cols = (rows[0].childIds || []).length || 1;
    const sep = `| ${Array(cols).fill('---').join(' | ')} |`;
    const rest = rows.slice(1).map(renderRow).join('\n');
    return `${header}\n${sep}${rest ? '\n' + rest : ''}\n\n`;
  }

  if (kind === 'blockquote' || kind === 'quote') {
    const inner = children.map((c) => renderBlock(c, fetchNode, depth + 1)).join('')
      || `${body}\n`;
    return inner
      .split('\n')
      .map((l) => (l.length > 0 ? `> ${l}` : '>'))
      .join('\n') + '\n';
  }

  if (kind === 'horizontal-rule' || kind === 'hr' || kind === 'thematic-break') {
    return '---\n\n';
  }

  // Container fallback: emit body then recurse into children as blocks.
  const head = body ? `${body}\n\n` : '';
  const tail = children.map((c) => renderBlock(c, fetchNode, depth + 1)).join('');
  return head + tail;
}

export const serializeMarkdown: ContentSerializerProviderFn = (
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
    const output = renderBlock(root, fetchNode, 0).replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
    return output;
  } catch (err) {
    return JSON.stringify({
      ok: false,
      target: CONTENT_SERIALIZER_TARGET,
      error: {
        message:
          (err as Error)?.message ?? 'unknown markdown serialization error',
      },
    });
  }
};

// Self-register on import so kernel-boot can wire providers by loading
// this module. The .sync file dispatches ContentSerializer/register to
// register the concept-layer binding; this line registers the concrete
// dispatch fn.
registerContentSerializerProvider(
  CONTENT_SERIALIZER_PROVIDER_ID,
  serializeMarkdown,
);
