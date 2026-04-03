// Block serialization utilities — framework-agnostic functions for converting
// between content formats and block tree structures.

// ─── Types ────────────────────────────────────────────────────────────────

export interface Block {
  id: string;
  type: BlockType;
  /** HTML content for rich text */
  content: string;
  /** Nested child blocks (tree structure) */
  children?: Block[];
  /** Hide children */
  collapsed?: boolean;
  /** How CHILDREN render: layout string ('table','board') or View entity ID */
  view_as?: string;
  /** How THIS BLOCK renders: display mode ID */
  display_mode?: string;
  /** Schema-specific properties (language, variant, src, etc.) */
  meta?: Record<string, unknown>;
}

export type BlockType =
  | 'paragraph'
  | 'heading1'
  | 'heading2'
  | 'heading3'
  | 'bullet'
  | 'numbered'
  | 'code'
  | 'quote'
  | 'divider'
  | 'callout'
  | 'image'
  | 'view-embed'
  | 'entity-embed'
  | 'block-embed'
  | 'snippet-embed'
  | 'control';

// ─── ID Generation ───────────────────────────────────────────────────────

let blockIdCounter = 0;
function newBlockId(): string {
  return `blk-${Date.now()}-${++blockIdCounter}`;
}

function createBlock(type: BlockType = 'paragraph', content = '', meta?: Record<string, unknown>): Block {
  const block: Block = { id: newBlockId(), type, content };
  if (meta) block.meta = meta;
  return block;
}

// ─── Content Serialization ───────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function contentToBlocks(content: unknown): Block[] {
  if (content === null || content === undefined) {
    return [createBlock('paragraph', '')];
  }

  const str = typeof content === 'string' ? content : JSON.stringify(content);

  // Try parsing as block array (with tree support)
  try {
    const parsed = JSON.parse(str);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].type && parsed[0].id) {
      return parsed as Block[];
    }
    // JSON object — render each key-value as a block
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      const blocks: Block[] = [];
      for (const [key, value] of Object.entries(parsed)) {
        const valStr = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
        blocks.push(createBlock('paragraph', `<strong>${escapeHtml(key)}:</strong> ${escapeHtml(valStr)}`));
      }
      return blocks.length > 0 ? blocks : [createBlock('paragraph', '')];
    }
  } catch {
    // Not JSON — treat as text
  }

  // Plain text — split into paragraphs
  const paragraphs = str.split(/\n\n+/).filter(Boolean);
  if (paragraphs.length === 0) return [createBlock('paragraph', '')];

  return paragraphs.map((p) => createBlock('paragraph', escapeHtml(p)));
}

export function blocksToContent(blocks: Block[]): string {
  return JSON.stringify(blocks.map(function serializeBlock(b): Record<string, unknown> {
    const out: Record<string, unknown> = { id: b.id, type: b.type, content: b.content };
    if (b.children && b.children.length > 0) out.children = b.children.map(serializeBlock);
    if (b.collapsed) out.collapsed = true;
    if (b.view_as) out.view_as = b.view_as;
    if (b.display_mode) out.display_mode = b.display_mode;
    if (b.meta && Object.keys(b.meta).length > 0) out.meta = b.meta;
    return out;
  }));
}

/**
 * Convert blocks to data rows for ViewRenderer inline rendering.
 * Each block becomes a record with id, type, content, plus flattened meta fields.
 */
export function blocksToDataRows(blocks: Block[]): Record<string, unknown>[] {
  return blocks.map(b => ({
    id: b.id,
    type: b.type,
    content: b.content,
    hasChildren: !!(b.children && b.children.length > 0),
    childCount: b.children?.length ?? 0,
    view_as: b.view_as ?? '',
    display_mode: b.display_mode ?? '',
    // Carry raw children for recursive expansion in display components
    _children: b.children && b.children.length > 0 ? blocksToDataRows(b.children) : undefined,
    ...b.meta,
  }));
}
