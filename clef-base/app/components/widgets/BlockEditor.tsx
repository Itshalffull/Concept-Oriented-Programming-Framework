'use client';

/**
 * BlockEditor — Notion-like block editor for the body region of entity pages.
 *
 * Supports:
 * - Tree structure: blocks have children, indent/outdent, collapse/expand
 * - Block schemas: code (language), callout (variant), image (src/alt/caption)
 * - View modes (view_as): children render as document, bullet, numbered, or
 *   delegate to ViewRenderer for table/board/etc. — same system as query views
 * - Display modes (display_mode): how each block itself renders (content, card, etc.)
 * - Embedded Views, Entities, and Controls via slash commands
 * - Entity reference links via [[entity-name]] syntax
 * - Rich text via contentEditable with Ctrl+B/I/` shortcuts
 *
 * Content stored as JSON array of blocks: [{ id, type, content, children?, ... }]
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { useNavigator } from '../../../lib/clef-provider';
import { useConceptQuery } from '../../../lib/use-concept-query';
import { useTextSelection, type TextSelectionState } from '../../../lib/use-text-selection';
import { useEntitySpans, type SpanFragment } from '../../../lib/use-entity-spans';
import { useVersionPins } from '../../../lib/use-version-pins';
import { highlightBlockContent } from '../../../lib/span-highlight';
import { SpanToolbar } from './SpanToolbar';
import { SpanGutter } from './SpanGutter';
import {
  flattenTree,
  findBlock,
  updateBlock,
  removeBlock,
  insertBlock,
  indentBlock,
  outdentBlock,
  moveBlock,
  countBlocks,
  getBlockDepth,
  type FlatEntry,
} from '../../../lib/block-tree-utils';

// ─── Types ────────────────────────────────────────────────────────────────

export type { Block, BlockType } from '../../../lib/block-serialization';
export { contentToBlocks, blocksToContent, blocksToDataRows } from '../../../lib/block-serialization';
import type { Block, BlockType } from '../../../lib/block-serialization';
import { blocksToDataRows } from '../../../lib/block-serialization';

interface BlockEditorProps {
  /** Initial blocks — parsed from entity content */
  blocks: Block[];
  /** Called when blocks change */
  onChange: (blocks: Block[]) => void;
  /** Read-only mode */
  readOnly?: boolean;
  /** Context for embedded views and entity references */
  context?: Record<string, string>;
  /**
   * Called whenever the text selection within the editor changes.
   * Provides TextAnchor-compatible position data for the selection endpoints.
   * Used by the span toolbar (sibling card) to show span-creation actions.
   */
  onSelectionChange?: (state: TextSelectionState) => void;
  /**
   * Imperative handle — called by the parent to obtain a createSpanFromSelection
   * function once the editor mounts. The function creates TextAnchor/TextSpan
   * records for the current selection and returns the span ID.
   */
  onSpanCreatorReady?: (
    create: (entityRef: string, kind: string, label?: string) => Promise<string | null>
  ) => void;
  /** ContentNode ID — used to load TextSpan highlights (§4.2) */
  entityRef?: string;
  /** Called when the user clicks a span highlight element */
  onSpanClick?: (spanId: string) => void;
}

// ─── Block Schema Registry ───────────────────────────────────────────────

interface SchemaField {
  key: string;
  label: string;
  type: 'select' | 'text';
  options?: string[];
}

const BLOCK_SCHEMAS: Partial<Record<BlockType, SchemaField[]>> = {
  code: [{
    key: 'language', label: 'Language', type: 'select',
    options: ['typescript', 'javascript', 'python', 'rust', 'go', 'html', 'css', 'sql', 'yaml', 'json', 'bash', 'text'],
  }],
  callout: [{
    key: 'variant', label: 'Type', type: 'select',
    options: ['info', 'warning', 'error', 'success', 'note'],
  }],
  image: [
    { key: 'src', label: 'URL', type: 'text' },
    { key: 'alt', label: 'Alt text', type: 'text' },
    { key: 'caption', label: 'Caption', type: 'text' },
  ],
  'block-embed': [
    { key: 'entityId', label: 'Entity ID', type: 'text' },
    { key: 'blockId', label: 'Block ID', type: 'text' },
  ],
  'snippet-embed': [
    { key: 'entityId', label: 'Entity ID', type: 'text' },
    { key: 'spanId', label: 'Span ID', type: 'text' },
  ],
};

const CALLOUT_STYLES: Record<string, { border: string; bg: string; icon: string }> = {
  info:    { border: '#3b82f6', bg: '#3b82f610', icon: 'ℹ' },
  warning: { border: '#f59e0b', bg: '#f59e0b10', icon: '⚠' },
  error:   { border: '#ef4444', bg: '#ef444410', icon: '✕' },
  success: { border: '#10b981', bg: '#10b98110', icon: '✓' },
  note:    { border: '#8b5cf6', bg: '#8b5cf610', icon: '✎' },
};

// ─── Slash Menu Items ────────────────────────────────────────────────────

interface SlashMenuItem {
  type: BlockType;
  label: string;
  description: string;
  shortcut?: string;
  meta?: Record<string, unknown>;
}

const SLASH_MENU_ITEMS: SlashMenuItem[] = [
  { type: 'paragraph', label: 'Text', description: 'Plain text block', shortcut: '/text' },
  { type: 'heading1', label: 'Heading 1', description: 'Large section heading', shortcut: '/h1' },
  { type: 'heading2', label: 'Heading 2', description: 'Medium section heading', shortcut: '/h2' },
  { type: 'heading3', label: 'Heading 3', description: 'Small section heading', shortcut: '/h3' },
  { type: 'bullet', label: 'Bullet List', description: 'Unordered list item', shortcut: '/bullet' },
  { type: 'numbered', label: 'Numbered List', description: 'Ordered list item', shortcut: '/num' },
  { type: 'code', label: 'Code', description: 'Code block with syntax highlighting', shortcut: '/code' },
  { type: 'quote', label: 'Quote', description: 'Blockquote', shortcut: '/quote' },
  { type: 'callout', label: 'Callout', description: 'Callout box with severity', shortcut: '/callout', meta: { variant: 'info' } },
  { type: 'image', label: 'Image', description: 'Image with caption', shortcut: '/image' },
  { type: 'divider', label: 'Divider', description: 'Horizontal rule separator', shortcut: '/hr' },
  { type: 'view-embed', label: 'View', description: 'Embed a live View query', shortcut: '/view' },
  { type: 'entity-embed', label: 'Entity', description: 'Embed an entity', shortcut: '/entity' },
  { type: 'block-embed', label: 'Block Embed', description: 'Embed a specific block from another entity', shortcut: '/block-embed' },
  { type: 'snippet-embed', label: 'Snippet', description: 'Embed a text span snippet from another entity', shortcut: '/snippet' },
  { type: 'control', label: 'Button', description: 'Action button control', shortcut: '/button' },
];

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

// ─── Display Mode Resolution ─────────────────────────────────────────────

/**
 * Normalize a block editor display mode name to the canonical DisplayMode mode_id.
 * Block editor uses short names ('content') while DisplayMode uses full ids ('content-body').
 */
function normalizeDisplayModeId(mode: string): string {
  const aliases: Record<string, string> = {
    content: 'content-body',
  };
  return aliases[mode] ?? mode;
}

interface DisplayModeRecord {
  variant: string;
  layout: string | null;
  component_mapping: string | null;
}

/**
 * Map a DisplayMode mode_id to the corresponding ViewRenderer layout string.
 * DisplayMode mode_ids are canonical names; ViewRenderer uses a subset of those names
 * as layout identifiers. This table translates between them where they differ.
 *
 * Modes not listed here either match ViewRenderer layout strings directly (e.g. 'detail',
 * 'content-body', 'table') or fall through to the caller-provided fallback.
 */
const DISPLAY_MODE_ID_TO_LAYOUT: Record<string, string> = {
  card: 'card-grid',
  'board-card': 'card-grid',
  teaser: 'card-grid',
  compact: 'card-grid',
  'stat-card': 'stat-cards',
  'table-row': 'table',
  'score-graph': 'graph',
  'graph-analysis': 'graph',
};

/**
 * Resolve a display mode name to a ViewRenderer layout string.
 * First consults the DisplayMode/get result for explicit layout overrides,
 * then falls back to the canonical mode_id translation table.
 */
function resolveLayoutFromMode(
  modeConfig: DisplayModeRecord | null,
  modeId: string,
  fallback: string,
): string {
  // 1. Explicit layout on the DisplayMode record (set via set_layout action)
  if (modeConfig && modeConfig.variant === 'ok' && modeConfig.layout) {
    return modeConfig.layout;
  }
  // 2. Mode_id translation table
  if (DISPLAY_MODE_ID_TO_LAYOUT[modeId]) {
    return DISPLAY_MODE_ID_TO_LAYOUT[modeId];
  }
  // 3. Direct match (mode_id === ViewRenderer layout name)
  // Known direct matches: 'detail', 'content-body', 'table', 'graph', 'stat-cards', 'board'
  const directMatches = new Set(['detail', 'content-body', 'table', 'graph', 'stat-cards', 'board', 'canvas', 'timeline', 'tree']);
  if (directMatches.has(modeId)) return modeId;
  // 4. Fallback
  return fallback;
}

// ─── Content Serialization ───────────────────────────────────────────────
// contentToBlocks, blocksToContent, blocksToDataRows are re-exported from
// ../../../lib/block-serialization at the top of this file.

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Process [[entity-name]] references in HTML content, converting them to
 * clickable entity chips for display.
 */
function renderEntityRefs(html: string): string {
  return html.replace(
    /\[\[([^\]]+)\]\]/g,
    (_match, name) =>
      `<span class="entity-ref" data-entity="${escapeHtml(name)}" ` +
      `style="background: var(--palette-primary-container, #e8eaf6); ` +
      `color: var(--palette-on-primary-container, #1a237e); ` +
      `padding: 1px 6px; border-radius: 4px; cursor: pointer; ` +
      `font-size: 0.9em; font-weight: 500; ` +
      `text-decoration: none; white-space: nowrap;"` +
      `>${escapeHtml(name)}</span>`,
  );
}

/**
 * Process ((entity-id#span=spanId)) inline snippet references within paragraph
 * HTML content (§8.2). Each match is replaced with a styled inline chip
 * showing a placeholder excerpt. Click navigates to /content/{entityId}#span={spanId}.
 * Hover shows a tooltip with span context via CSS + data attributes.
 * Note: block-level ((…)) patterns are handled by the block-level paste detector;
 * this function only runs inside existing paragraph content strings.
 */
function renderSnippetRefs(html: string): string {
  return html.replace(
    /\(\(([^)#\s]+)#span=([^)\s]+)\)\)/g,
    (_match, entityId, spanId) =>
      `<span class="snippet-ref" ` +
      `data-entity="${escapeHtml(entityId)}" ` +
      `data-span="${escapeHtml(spanId)}"` +
      `>...</span>`,
  );
}

// ─── Block Schema Toolbar ────────────────────────────────────────────────

interface SchemaToolbarProps {
  block: Block;
  onMetaChange: (id: string, key: string, value: unknown) => void;
}

const SchemaToolbar: React.FC<SchemaToolbarProps> = ({ block, onMetaChange }) => {
  const schema = BLOCK_SCHEMAS[block.type];
  if (!schema) return null;

  return (
    <div style={{
      display: 'flex', gap: '6px', alignItems: 'center',
      padding: '2px 4px',
      fontSize: '11px',
      color: 'var(--palette-on-surface-variant)',
    }}>
      {schema.map(field => (
        <label key={field.key} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
          <span style={{ opacity: 0.6 }}>{field.label}:</span>
          {field.type === 'select' ? (
            <select
              value={(block.meta?.[field.key] as string) ?? field.options?.[0] ?? ''}
              onChange={e => onMetaChange(block.id, field.key, e.target.value)}
              style={{
                background: 'var(--palette-surface-variant)',
                border: '1px solid var(--palette-outline-variant)',
                borderRadius: 3, padding: '0 4px', fontSize: '11px',
                color: 'var(--palette-on-surface)',
              }}
            >
              {field.options?.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={(block.meta?.[field.key] as string) ?? ''}
              onChange={e => onMetaChange(block.id, field.key, e.target.value)}
              placeholder={field.label}
              style={{
                background: 'var(--palette-surface-variant)',
                border: '1px solid var(--palette-outline-variant)',
                borderRadius: 3, padding: '0 4px', fontSize: '11px',
                color: 'var(--palette-on-surface)',
                width: field.key === 'src' ? 200 : 120,
              }}
            />
          )}
        </label>
      ))}
    </div>
  );
};

// ─── View-As Picker ──────────────────────────────────────────────────────

interface ViewAsPickerProps {
  block: Block;
  onViewAsChange: (id: string, viewAs: string | undefined) => void;
}

const VIEW_AS_OPTIONS = [
  { value: '', label: 'Document (default)' },
  { value: 'bullet', label: 'Bullet list' },
  { value: 'numbered', label: 'Numbered list' },
  { value: 'table', label: 'Table' },
  { value: 'card-grid', label: 'Card grid' },
];

const ViewAsPicker: React.FC<ViewAsPickerProps> = ({ block, onViewAsChange }) => {
  if (!block.children || block.children.length === 0) return null;

  return (
    <select
      value={block.view_as ?? ''}
      onChange={e => onViewAsChange(block.id, e.target.value || undefined)}
      title="View children as..."
      style={{
        background: 'transparent',
        border: '1px solid var(--palette-outline-variant)',
        borderRadius: 3, padding: '0 2px', fontSize: '10px',
        color: 'var(--palette-on-surface-variant)',
        cursor: 'pointer',
      }}
    >
      {VIEW_AS_OPTIONS.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
};

// ─── View Embed Block ────────────────────────────────────────────────────

const ViewEmbedBlock: React.FC<{
  block: Block;
  onMetaChange: (id: string, key: string, value: unknown) => void;
  readOnly?: boolean;
}> = ({ block, onMetaChange, readOnly }) => {
  const viewId = block.meta?.viewId as string | undefined;
  const [picking, setPicking] = useState(false);
  // Lazy import ViewRenderer to avoid circular dependency
  const ViewRenderer = React.lazy(() => import('../ViewRenderer'));

  if (!viewId) {
    return (
      <div style={{
        padding: 'var(--spacing-sm) var(--spacing-md)',
        background: 'var(--palette-surface-variant)',
        borderRadius: 'var(--radius-sm)',
        border: '1px dashed var(--palette-outline-variant)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 4,
        }}>
          <span style={{ fontSize: '12px', color: 'var(--palette-on-surface-variant)' }}>
            Embedded View
          </span>
          {!readOnly && !picking && (
            <button
              onClick={() => setPicking(true)}
              style={{
                padding: '2px 8px', fontSize: '11px', cursor: 'pointer',
                background: 'var(--palette-primary)', color: 'var(--palette-on-primary)',
                border: 'none', borderRadius: 'var(--radius-sm)',
              }}
            >
              Pick View
            </button>
          )}
        </div>
        {picking && (
          <div style={{
            border: '1px solid var(--palette-outline-variant)',
            borderRadius: 'var(--radius-sm)',
            maxHeight: 300, overflow: 'auto',
          }}>
            <React.Suspense fallback={<div style={{ padding: 8 }}>Loading...</div>}>
              <ViewRenderer
                viewId="views-list"
                compact
                onSelect={(row) => {
                  onMetaChange(block.id, 'viewId', row.view as string);
                  setPicking(false);
                }}
              />
            </React.Suspense>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{
      border: '1px solid var(--palette-outline-variant)',
      borderRadius: 'var(--radius-sm)',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '2px 8px',
        background: 'var(--palette-surface-variant)',
        fontSize: '11px', color: 'var(--palette-on-surface-variant)',
      }}>
        <span>View: {viewId}</span>
        {!readOnly && (
          <button
            onClick={() => onMetaChange(block.id, 'viewId', undefined)}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--palette-on-surface-variant)', fontSize: '11px',
            }}
          >
            ✕
          </button>
        )}
      </div>
      <React.Suspense fallback={<div style={{ padding: 8 }}>Loading view...</div>}>
        <ViewRenderer viewId={viewId} compact />
      </React.Suspense>
    </div>
  );
};

// ─── Entity Embed Block ──────────────────────────────────────────────────

const EntityEmbedBlock: React.FC<{
  block: Block;
  onMetaChange: (id: string, key: string, value: unknown) => void;
  readOnly?: boolean;
}> = ({ block, onMetaChange, readOnly }) => {
  const entityId = block.meta?.entityId as string | undefined;
  const [picking, setPicking] = useState(false);
  const ViewRenderer = React.lazy(() => import('../ViewRenderer'));

  const displayMode = (block.meta?.display_mode as string) ?? 'detail';
  // Normalize mode name to DisplayMode mode_id (e.g. 'content' → 'content-body')
  const canonicalModeId = normalizeDisplayModeId(displayMode);

  // Resolve the layout for this display mode dynamically via DisplayMode/get.
  // Uses 'ContentNode' as the schema since entity-embed blocks always embed ContentNodes.
  // Falls back to 'detail' when the mode is not configured.
  const { data: embedModeConfig } = useConceptQuery<DisplayModeRecord>(
    'DisplayMode', 'get', { mode: `ContentNode:${canonicalModeId}` },
  );
  const resolvedEmbedLayout = resolveLayoutFromMode(embedModeConfig ?? null, canonicalModeId, 'detail');

  if (!entityId) {
    return (
      <div style={{
        padding: 'var(--spacing-sm) var(--spacing-md)',
        background: 'var(--palette-surface-variant)',
        borderRadius: 'var(--radius-sm)',
        border: '1px dashed var(--palette-outline-variant)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 4,
        }}>
          <span style={{ fontSize: '12px', color: 'var(--palette-on-surface-variant)' }}>
            Embedded Entity
          </span>
          {!readOnly && !picking && (
            <button
              onClick={() => setPicking(true)}
              style={{
                padding: '2px 8px', fontSize: '11px', cursor: 'pointer',
                background: 'var(--palette-primary)', color: 'var(--palette-on-primary)',
                border: 'none', borderRadius: 'var(--radius-sm)',
              }}
            >
              Pick Entity
            </button>
          )}
        </div>
        {picking && (
          <div style={{
            border: '1px solid var(--palette-outline-variant)',
            borderRadius: 'var(--radius-sm)',
            maxHeight: 300, overflow: 'auto',
          }}>
            <React.Suspense fallback={<div style={{ padding: 8 }}>Loading...</div>}>
              <ViewRenderer
                viewId="content-list"
                compact
                onSelect={(row) => {
                  onMetaChange(block.id, 'entityId', row.node as string);
                  setPicking(false);
                }}
              />
            </React.Suspense>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{
      border: '1px solid var(--palette-outline-variant)',
      borderRadius: 'var(--radius-sm)',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '2px 8px',
        background: 'var(--palette-surface-variant)',
        fontSize: '11px', color: 'var(--palette-on-surface-variant)',
      }}>
        <span style={{ fontFamily: 'var(--typography-font-family-mono)' }}>
          {entityId}
        </span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {!readOnly && (
            <>
              <select
                value={displayMode}
                onChange={e => onMetaChange(block.id, 'display_mode', e.target.value)}
                style={{
                  fontSize: '10px', padding: '0 4px',
                  background: 'var(--palette-surface)',
                  border: '1px solid var(--palette-outline-variant)',
                  borderRadius: 3,
                  color: 'var(--palette-on-surface-variant)',
                }}
              >
                <option value="detail">Detail</option>
                <option value="card">Card</option>
                <option value="teaser">Teaser</option>
                <option value="content">Content</option>
              </select>
              <button
                onClick={() => onMetaChange(block.id, 'entityId', undefined)}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--palette-on-surface-variant)', fontSize: '11px',
                }}
              >
                ✕
              </button>
            </>
          )}
        </div>
      </div>
      {/* Render the entity through ViewRenderer with layout driven by DisplayMode/get */}
      <React.Suspense fallback={<div style={{ padding: 8 }}>Loading entity...</div>}>
        <ViewRenderer
          viewId="entity-properties"
          context={{ entityId }}
          inlineLayout={resolvedEmbedLayout}
          compact
        />
      </React.Suspense>
    </div>
  );
};

// ─── Block Embed Block ───────────────────────────────────────────────────

const BlockEmbedBlock: React.FC<{
  block: Block;
  readOnly?: boolean;
  freshness?: 'current' | 'outdated' | 'orphaned';
}> = ({ block, freshness }) => {
  const entityId = block.meta?.entityId as string | undefined;
  const blockId = block.meta?.blockId as string | undefined;

  // Fetch the source entity content
  const { data: entityData } = useConceptQuery<{ variant: string; content?: string; name?: string }>(
    'ContentNode', 'get', entityId ? { node: entityId } : { node: '__none__' },
  );

  const foundBlock = React.useMemo(() => {
    if (!entityData || entityData.variant !== 'ok' || !entityData.content || !blockId) return null;
    try {
      const parsed = JSON.parse(entityData.content);
      if (!Array.isArray(parsed)) return null;
      const result = findBlock(parsed as Block[], blockId);
      return result ? result.block : null;
    } catch {
      return null;
    }
  }, [entityData, blockId]);

  const entityName = entityData?.variant === 'ok' ? (entityData.name ?? entityId) : entityId;

  if (!entityId || !blockId) {
    return (
      <div style={{
        padding: 'var(--spacing-sm) var(--spacing-md)',
        background: 'var(--palette-surface-variant)',
        borderRadius: 'var(--radius-sm)',
        border: '1px dashed var(--palette-outline-variant)',
        fontSize: '13px',
        color: 'var(--palette-on-surface-variant)',
      }}>
        Block Embed — set entityId and blockId in the schema toolbar above
      </div>
    );
  }

  if (!entityData || entityData.variant !== 'ok') {
    return (
      <div style={{
        padding: 'var(--spacing-sm) var(--spacing-md)',
        background: 'var(--palette-surface-variant)',
        borderRadius: 'var(--radius-sm)',
        border: '1px dashed var(--palette-outline-variant)',
        fontSize: '13px',
        color: 'var(--palette-on-surface-variant)',
      }}>
        Loading block embed...
      </div>
    );
  }

  if (!foundBlock) {
    return (
      <div style={{
        padding: 'var(--spacing-sm) var(--spacing-md)',
        background: 'var(--palette-surface-variant)',
        borderRadius: 'var(--radius-sm)',
        border: '1px dashed #ef4444',
        fontSize: '13px',
        color: '#ef4444',
      }}>
        Block not found: <code style={{ fontFamily: 'var(--typography-font-family-mono)' }}>{blockId}</code>{' '}
        in entity {entityName}
      </div>
    );
  }

  const blockStyle = BLOCK_STYLES[foundBlock.type] ?? BLOCK_STYLES.paragraph;
  const rawContent = foundBlock.content ?? '';

  const resolvedFreshness = freshness ?? 'current';

  return (
    <div
      data-freshness={resolvedFreshness}
      style={{
        border: '1px solid var(--palette-outline-variant)',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
      }}
    >
      {/* Source attribution badge */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '2px 8px',
        background: 'var(--palette-surface-variant)',
        fontSize: '11px', color: 'var(--palette-on-surface-variant)',
        borderBottom: '1px solid var(--palette-outline-variant)',
      }}>
        <span>
          Block from{' '}
          <span style={{ fontFamily: 'var(--typography-font-family-mono)', opacity: 0.8 }}>
            {entityName}
          </span>
        </span>
        <a
          href={`/admin/content/${entityId}`}
          style={{
            fontSize: '11px',
            color: 'var(--palette-primary)',
            textDecoration: 'none',
          }}
        >
          View in context
        </a>
      </div>
      {/* Embedded block content — read-only transcluded rendering */}
      <div style={{
        padding: 'var(--spacing-sm) var(--spacing-md)',
        ...blockStyle,
        opacity: resolvedFreshness === 'orphaned' ? 0.5 : 0.85,
        pointerEvents: 'none' as const,
        userSelect: 'none' as const,
      }}>
        <div dangerouslySetInnerHTML={{ __html: renderEntityRefs(rawContent) }} />
      </div>
    </div>
  );
};

// ─── Snippet Embed Block ─────────────────────────────────────────────────
// Renders a TextSpan excerpt transcluded from another entity (§8.4).
// Created via ((entityRef#span=spanId)) paste or /snippet slash command.

const SnippetEmbedBlock: React.FC<{
  block: Block;
  onMetaChange: (id: string, key: string, value: unknown) => void;
  readOnly?: boolean;
}> = ({ block, onMetaChange, readOnly }) => {
  const entityId = block.meta?.entityId as string | undefined;
  const spanId = block.meta?.spanId as string | undefined;
  const { navigateToHref } = useNavigator();

  // Fetch span metadata (kind, label, status) via TextSpan/get
  const { data: spanMeta } = useConceptQuery<Record<string, unknown>>(
    spanId ? 'TextSpan' : '__none__',
    'get',
    spanId ? { span: spanId } : {},
  );

  // Fetch source entity content to supply currentContent for TextSpan/resolve
  const { data: entityData } = useConceptQuery<Record<string, unknown>>(
    entityId ? 'ContentNode' : '__none__',
    'get',
    entityId ? { node: entityId } : {},
  );

  const currentContent = (entityData?.content as string | undefined) ?? '';

  // Resolve span fragments (resolved text positions) via TextSpan/resolve
  const { data: resolveResult } = useConceptQuery<Record<string, unknown>>(
    spanId && currentContent ? 'TextSpan' : '__none__',
    'resolve',
    spanId && currentContent ? { span: spanId, currentContent } : {},
  );

  const fragments = (resolveResult?.fragments as Array<{ text: string }> | undefined) ?? [];
  const resolvedText = fragments.map(f => f.text).join('');

  const spanKind = (spanMeta?.kind as string | undefined) ?? '';
  const spanLabel = (spanMeta?.label as string | undefined) ?? spanId ?? '';
  const spanStatus = (spanMeta?.status as string | undefined) ?? '';

  const isStale = spanStatus === 'stale';
  const isBroken = spanStatus === 'broken';

  if (!entityId || !spanId) {
    return (
      <div style={{
        padding: 'var(--spacing-sm) var(--spacing-md)',
        background: 'var(--palette-surface-variant)',
        borderRadius: 'var(--radius-sm)',
        border: '1px dashed var(--palette-outline-variant)',
      }}>
        <div style={{ fontSize: '12px', color: 'var(--palette-on-surface-variant)', marginBottom: 4 }}>
          Snippet Embed
        </div>
        {!readOnly && (
          <SchemaToolbar block={block} onMetaChange={onMetaChange} />
        )}
        <div style={{ fontSize: '12px', color: 'var(--palette-on-surface-variant)', marginTop: 4 }}>
          Paste ((entity-id#span=span-id)) to embed a text span snippet, or set Entity ID and Span ID above.
        </div>
      </div>
    );
  }

  return (
    <div style={{
      border: '1px solid var(--palette-outline-variant)',
      borderRadius: 'var(--radius-sm)',
      overflow: 'hidden',
    }}>
      {/* Header bar: kind badge, label, view-in-context, remove */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '4px 8px',
        background: 'var(--palette-surface-variant)',
        fontSize: '11px', color: 'var(--palette-on-surface-variant)',
        gap: 8,
        borderBottom: '1px solid var(--palette-outline-variant)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
          <span style={{ opacity: 0.6 }}>Snippet</span>
          {spanKind && (
            <span style={{
              background: 'var(--palette-primary-container, #e8eaf6)',
              color: 'var(--palette-on-primary-container, #1a237e)',
              padding: '0 5px', borderRadius: 3, fontSize: '10px', fontWeight: 500,
            }}>
              {spanKind}
            </span>
          )}
          <span style={{
            fontFamily: 'var(--typography-font-family-mono)',
            fontSize: '10px', opacity: 0.7,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {spanLabel}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={() => navigateToHref(`/content/${entityId}`)}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--palette-primary)', fontSize: '11px', padding: '0 4px',
            }}
            title="View in context"
          >
            View in context
          </button>
          {!readOnly && (
            <button
              onClick={() => {
                onMetaChange(block.id, 'entityId', undefined);
                onMetaChange(block.id, 'spanId', undefined);
              }}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--palette-on-surface-variant)', fontSize: '11px',
              }}
              title="Remove snippet"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Status: stale warning — span anchor text may have shifted */}
      {isStale && (
        <div style={{
          padding: '4px 10px',
          background: '#f59e0b18',
          borderBottom: '1px solid #f59e0b40',
          fontSize: '11px', color: '#92400e',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span>⚠</span>
          <span>Text may have moved — this span may no longer match the source.</span>
        </div>
      )}

      {/* Status: broken — span anchor has been deleted */}
      {isBroken && (
        <div style={{
          padding: '4px 10px',
          background: '#ef444418',
          borderBottom: '1px solid #ef444440',
          fontSize: '11px', color: '#7f1d1d',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span>✕</span>
          <span>Source text not found — the span anchor may have been deleted.</span>
        </div>
      )}

      {/* Resolved snippet text — read-only transcluded rendering */}
      <div style={{
        padding: 'var(--spacing-sm) var(--spacing-md)',
        fontSize: 'var(--typography-body-md-size)',
        lineHeight: 'var(--typography-body-md-line-height, 1.6)',
        color: isBroken ? 'var(--palette-on-surface-variant)' : 'var(--palette-on-surface)',
        fontStyle: isBroken ? 'italic' as const : 'normal' as const,
        borderLeft: '3px solid var(--palette-primary)',
        pointerEvents: 'none' as const,
        userSelect: 'none' as const,
      }}>
        {isBroken ? (
          <em style={{ opacity: 0.6 }}>Span text unavailable</em>
        ) : resolvedText ? (
          <span>{resolvedText}</span>
        ) : (
          <span style={{ opacity: 0.5, fontSize: '12px' }}>Loading snippet...</span>
        )}
      </div>

      {/* Source attribution footer */}
      {!isBroken && resolvedText && (
        <div style={{
          padding: '3px 10px',
          background: 'var(--palette-surface-variant)',
          borderTop: '1px solid var(--palette-outline-variant)',
          fontSize: '10px', color: 'var(--palette-on-surface-variant)',
          display: 'flex', alignItems: 'center', gap: 4,
        }}>
          <span style={{ opacity: 0.6 }}>Source:</span>
          <span style={{ fontFamily: 'var(--typography-font-family-mono)', fontSize: '10px' }}>
            {entityId}
          </span>
        </div>
      )}
    </div>
  );
};

// ─── Control Block ───────────────────────────────────────────────────────

const ControlBlock: React.FC<{
  block: Block;
  onMetaChange: (id: string, key: string, value: unknown) => void;
  readOnly?: boolean;
}> = ({ block, onMetaChange, readOnly }) => {
  const label = (block.meta?.label as string) ?? 'Action';
  const concept = (block.meta?.concept as string) ?? '';
  const action = (block.meta?.action as string) ?? '';
  const variant = (block.meta?.variant as string) ?? 'filled';
  const [configOpen, setConfigOpen] = useState(false);

  return (
    <div style={{ padding: 'var(--spacing-xs) 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)' }}>
        <button
          data-part="button"
          data-variant={variant}
          style={{
            padding: '6px 16px', fontSize: '13px', cursor: 'pointer',
            borderRadius: 'var(--radius-sm)',
            background: variant === 'filled' ? 'var(--palette-primary)' : 'transparent',
            color: variant === 'filled' ? 'var(--palette-on-primary)' : 'var(--palette-primary)',
            border: variant === 'outlined' ? '1px solid var(--palette-primary)' : 'none',
            fontWeight: 500,
          }}
          onClick={() => {
            if (concept && action) {
              // Action invocation would go through kernel
              console.log(`Control: invoke ${concept}/${action}`);
            }
          }}
        >
          {label}
        </button>
        {!readOnly && (
          <button
            onClick={() => setConfigOpen(!configOpen)}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontSize: '11px', color: 'var(--palette-on-surface-variant)',
            }}
          >
            {configOpen ? '▲ config' : '▼ config'}
          </button>
        )}
      </div>
      {configOpen && !readOnly && (
        <div style={{
          marginTop: 4, padding: '6px 8px',
          background: 'var(--palette-surface-variant)',
          borderRadius: 'var(--radius-sm)',
          display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '4px 8px',
          fontSize: '12px', alignItems: 'center',
        }}>
          <span>Label:</span>
          <input value={label} onChange={e => onMetaChange(block.id, 'label', e.target.value)}
            style={{ padding: '2px 4px', fontSize: '12px', background: 'var(--palette-surface)', border: '1px solid var(--palette-outline-variant)', borderRadius: 3, color: 'var(--palette-on-surface)' }} />
          <span>Concept:</span>
          <input value={concept} onChange={e => onMetaChange(block.id, 'concept', e.target.value)}
            style={{ padding: '2px 4px', fontSize: '12px', background: 'var(--palette-surface)', border: '1px solid var(--palette-outline-variant)', borderRadius: 3, color: 'var(--palette-on-surface)' }} />
          <span>Action:</span>
          <input value={action} onChange={e => onMetaChange(block.id, 'action', e.target.value)}
            style={{ padding: '2px 4px', fontSize: '12px', background: 'var(--palette-surface)', border: '1px solid var(--palette-outline-variant)', borderRadius: 3, color: 'var(--palette-on-surface)' }} />
          <span>Variant:</span>
          <select value={variant} onChange={e => onMetaChange(block.id, 'variant', e.target.value)}
            style={{ padding: '2px 4px', fontSize: '12px', background: 'var(--palette-surface)', border: '1px solid var(--palette-outline-variant)', borderRadius: 3, color: 'var(--palette-on-surface)' }}>
            <option value="filled">Filled</option>
            <option value="outlined">Outlined</option>
            <option value="text">Text</option>
          </select>
        </div>
      )}
    </div>
  );
};

// ─── View Children Renderer ─────────────────────────────────────────────

/**
 * Renders a block's children using ViewRenderer with inline data.
 * Used when view_as is set to a non-document mode (table, card-grid, etc.).
 */
const ViewChildren: React.FC<{
  block: Block;
  context?: Record<string, string>;
}> = ({ block, context }) => {
  const viewAs = block.view_as!;
  const ViewRenderer = React.lazy(() => import('../ViewRenderer'));
  const rows = useMemo(() => blocksToDataRows(block.children ?? []), [block.children]);

  // Default field config for block children
  const defaultFields = useMemo(() => [
    { key: 'type', label: 'Type', formatter: 'badge' as const },
    { key: 'content', label: 'Content' },
    { key: 'childCount', label: 'Children' },
  ], []);

  // Check if view_as is a View entity ID (not a built-in layout name)
  const builtinLayouts = ['document', 'bullet', 'numbered', 'table', 'card-grid', 'board', 'graph', 'stat-cards'];
  const isViewEntityId = !builtinLayouts.includes(viewAs);

  return (
    <div style={{
      marginLeft: 24, marginTop: 4,
      border: '1px solid var(--palette-outline-variant)',
      borderRadius: 'var(--radius-sm)',
      overflow: 'hidden',
    }}>
      <React.Suspense fallback={<div style={{ padding: 8 }}>Loading...</div>}>
        {isViewEntityId ? (
          // View entity ID — load that View's config, use block children as inline data
          <ViewRenderer viewId={viewAs} inlineData={rows} context={context} compact />
        ) : (
          // Built-in layout — render with inline config
          <ViewRenderer
            inlineData={rows}
            inlineLayout={viewAs}
            inlineFields={defaultFields}
            compact
          />
        )}
      </React.Suspense>
    </div>
  );
};

// ─── Single Block Component ──────────────────────────────────────────────

interface BlockRowProps {
  block: Block;
  depth: number;
  focused: boolean;
  onFocus: (id: string) => void;
  onContentChange: (id: string, html: string) => void;
  onKeyDown: (id: string, e: React.KeyboardEvent) => void;
  onMetaChange: (id: string, key: string, value: unknown) => void;
  onToggleCollapse: (id: string) => void;
  onViewAsChange: (id: string, viewAs: string | undefined) => void;
  readOnly?: boolean;
  registerRef: (id: string, el: HTMLElement | null) => void;
  numberLabel?: number;
  context?: Record<string, string>;
  onDragStart?: (id: string) => void;
  onDragOver?: (id: string, position: 'before' | 'after') => void;
  onDrop?: (id: string) => void;
  dragOverId?: string | null;
  dragOverPosition?: 'before' | 'after' | null;
  /** TextSpan fragments for this block — applied before entity-ref rendering (§4.2) */
  spanFragments?: SpanFragment[];
  /** Called when the user clicks a span highlight */
  onSpanClick?: (spanId: string) => void;
  /** Called when the user chooses Copy Block Reference (§4.4) */
  onCopyBlockRef?: (blockId: string) => void;
  /** ContentNode ID — used to format block references (§4.4) */
  entityRef?: string;
}

const BLOCK_STYLES: Record<string, React.CSSProperties> = {
  paragraph: {
    fontSize: 'var(--typography-body-md-size)',
    lineHeight: 'var(--typography-body-md-line-height, 1.6)',
  },
  heading1: {
    fontSize: 'var(--typography-heading-lg-size, 1.75rem)',
    fontWeight: 'var(--typography-heading-lg-weight, 700)' as unknown as number,
    lineHeight: '1.3',
    marginTop: 'var(--spacing-md)',
  },
  heading2: {
    fontSize: 'var(--typography-heading-md-size, 1.35rem)',
    fontWeight: 'var(--typography-heading-md-weight, 600)' as unknown as number,
    lineHeight: '1.35',
    marginTop: 'var(--spacing-sm)',
  },
  heading3: {
    fontSize: 'var(--typography-heading-sm-size, 1.1rem)',
    fontWeight: 'var(--typography-heading-sm-weight, 600)' as unknown as number,
    lineHeight: '1.4',
  },
  bullet: {
    fontSize: 'var(--typography-body-md-size)',
    lineHeight: 'var(--typography-body-md-line-height, 1.6)',
  },
  numbered: {
    fontSize: 'var(--typography-body-md-size)',
    lineHeight: 'var(--typography-body-md-line-height, 1.6)',
  },
  code: {
    fontFamily: 'var(--typography-font-family-mono)',
    fontSize: 'var(--typography-code-sm-size, 0.875rem)',
    lineHeight: '1.5',
    background: 'var(--palette-surface-variant)',
    padding: 'var(--spacing-sm) var(--spacing-md)',
    borderRadius: 'var(--radius-sm)',
    whiteSpace: 'pre-wrap' as const,
    border: '1px solid var(--palette-outline-variant)',
  },
  quote: {
    fontSize: 'var(--typography-body-md-size)',
    lineHeight: 'var(--typography-body-md-line-height, 1.6)',
    borderLeft: '3px solid var(--palette-primary)',
    paddingLeft: 'var(--spacing-md)',
    color: 'var(--palette-on-surface-variant)',
    fontStyle: 'italic' as const,
  },
  divider: {},
  callout: {
    fontSize: 'var(--typography-body-md-size)',
    lineHeight: 'var(--typography-body-md-line-height, 1.6)',
    padding: 'var(--spacing-sm) var(--spacing-md)',
    borderRadius: 'var(--radius-sm)',
  },
  image: {},
  'view-embed': {},
  'entity-embed': {},
  'block-embed': {},
  'snippet-embed': {},
  control: {},
};

const PLACEHOLDER_TEXT: Record<string, string> = {
  paragraph: "Type '/' for commands...",
  heading1: 'Heading 1',
  heading2: 'Heading 2',
  heading3: 'Heading 3',
  bullet: 'List item',
  numbered: 'List item',
  code: 'Code',
  quote: 'Quote',
  callout: 'Callout...',
  divider: '',
  image: '',
  'view-embed': '',
  'entity-embed': '',
  'block-embed': '',
  'snippet-embed': '',
  control: '',
};

/** Block types that use contentEditable */
const EDITABLE_TYPES = new Set<BlockType>([
  'paragraph', 'heading1', 'heading2', 'heading3',
  'bullet', 'numbered', 'code', 'quote', 'callout',
]);

const BlockRow: React.FC<BlockRowProps> = React.memo(({
  block, depth, focused, onFocus, onContentChange, onKeyDown,
  onMetaChange, onToggleCollapse, onViewAsChange,
  readOnly, registerRef, numberLabel, context,
  onDragStart, onDragOver, onDrop, dragOverId, dragOverPosition,
  spanFragments, onSpanClick, onCopyBlockRef, entityRef,
}) => {
  const [blockMenuOpen, setBlockMenuOpen] = useState(false);
  const blockMenuRef = useRef<HTMLDivElement>(null);
  const elRef = useRef<HTMLDivElement | null>(null);
  const [hovered, setHovered] = useState(false);
  const hasChildren = !!(block.children && block.children.length > 0);
  const isEditable = EDITABLE_TYPES.has(block.type);

  // Register ref for focus management
  const setRef = useCallback((el: HTMLDivElement | null) => {
    elRef.current = el;
    registerRef(block.id, el);
  }, [block.id, registerRef]);

  // Sync content on blur
  const handleBlur = useCallback(() => {
    if (elRef.current) {
      onContentChange(block.id, elRef.current.innerHTML);
    }
  }, [block.id, onContentChange]);

  // Close block menu on outside click
  useEffect(() => {
    if (!blockMenuOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (blockMenuRef.current && !blockMenuRef.current.contains(e.target as Node)) {
        setBlockMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [blockMenuOpen]);

  // Resolve display-mode layout dynamically via DisplayMode/get.
  // Hooks must be called unconditionally at the top of the component,
  // before any early returns, to satisfy React's rules of hooks.
  const blockDisplayMode = block.display_mode ?? '';
  const canonicalBlockModeId = normalizeDisplayModeId(blockDisplayMode);
  // Use 'ContentNode' as default schema — blocks in the editor are ContentNode subtrees.
  const { data: blockModeConfig } = useConceptQuery<DisplayModeRecord>(
    'DisplayMode', 'get',
    { mode: blockDisplayMode ? `ContentNode:${canonicalBlockModeId}` : '__none__' },
  );
  const resolvedBlockLayout = resolveLayoutFromMode(blockModeConfig ?? null, canonicalBlockModeId, 'detail');

  // blockAsData is used when display_mode is active — memoized unconditionally.
  const blockAsData = useMemo(() => [{
    id: block.id,
    type: block.type,
    content: block.content,
    hasChildren,
    childCount: block.children?.length ?? 0,
    ...block.meta,
  }], [block.id, block.type, block.content, hasChildren, block.children?.length, block.meta]);

  // Divider is non-editable
  if (block.type === 'divider') {
    return (
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)',
          padding: 'var(--spacing-xs) 0',
          paddingLeft: depth * 24,
        }}
        onClick={() => onFocus(block.id)}
      >
        <div style={{ width: 20, flexShrink: 0 }} />
        <hr style={{
          flex: 1, border: 'none', borderTop: '1px solid var(--palette-outline-variant)',
          margin: 'var(--spacing-sm) 0',
        }} />
      </div>
    );
  }

  // Special block types
  if (block.type === 'view-embed') {
    return (
      <div style={{ paddingLeft: depth * 24, padding: '2px 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-xs)' }}>
          <div style={{ width: 20, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <ViewEmbedBlock block={block} onMetaChange={onMetaChange} readOnly={readOnly} />
          </div>
        </div>
      </div>
    );
  }

  if (block.type === 'entity-embed') {
    return (
      <div style={{ paddingLeft: depth * 24, padding: '2px 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-xs)' }}>
          <div style={{ width: 20, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <EntityEmbedBlock block={block} onMetaChange={onMetaChange} readOnly={readOnly} />
          </div>
        </div>
      </div>
    );
  }

  if (block.type === 'block-embed') {
    return (
      <div style={{ paddingLeft: depth * 24, padding: '2px 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-xs)' }}>
          <div style={{ width: 20, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <SchemaToolbar block={block} onMetaChange={onMetaChange} />
            <BlockEmbedBlock block={block} readOnly={readOnly} freshness={spanFragments && spanFragments.length > 0 ? spanFragments.reduce<'current' | 'outdated' | 'orphaned'>((worst, f) => { const fr = f.freshness ?? 'current'; if (worst === 'orphaned' || fr === 'orphaned') return 'orphaned'; if (worst === 'outdated' || fr === 'outdated') return 'outdated'; return 'current'; }, 'current') : undefined} />
          </div>
        </div>
      </div>
    );
  }

  if (block.type === 'snippet-embed') {
    return (
      <div style={{ paddingLeft: depth * 24, padding: '2px 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-xs)' }}>
          <div style={{ width: 20, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <SnippetEmbedBlock block={block} onMetaChange={onMetaChange} readOnly={readOnly} />
          </div>
        </div>
      </div>
    );
  }

  if (block.type === 'control') {
    return (
      <div style={{ paddingLeft: depth * 24, padding: '2px 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-xs)' }}>
          <div style={{ width: 20, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <ControlBlock block={block} onMetaChange={onMetaChange} readOnly={readOnly} />
          </div>
        </div>
      </div>
    );
  }

  // Image block
  if (block.type === 'image') {
    const src = block.meta?.src as string;
    const alt = block.meta?.alt as string | undefined;
    const caption = block.meta?.caption as string | undefined;
    return (
      <div style={{ paddingLeft: depth * 24, padding: '2px 0' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-xs)' }}>
          <div style={{ width: 20, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <SchemaToolbar block={block} onMetaChange={onMetaChange} />
            {src ? (
              <div>
                <img
                  src={src} alt={alt ?? ''}
                  style={{
                    maxWidth: '100%', borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--palette-outline-variant)',
                  }}
                />
                {caption && (
                  <div style={{
                    fontSize: '12px', color: 'var(--palette-on-surface-variant)',
                    textAlign: 'center', marginTop: 4,
                  }}>
                    {caption}
                  </div>
                )}
              </div>
            ) : (
              <div style={{
                padding: 'var(--spacing-md)',
                background: 'var(--palette-surface-variant)',
                borderRadius: 'var(--radius-sm)',
                textAlign: 'center',
                color: 'var(--palette-on-surface-variant)',
                fontSize: '13px',
              }}>
                Set image URL above
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Display mode rendering — when display_mode is set, render the block as a
  // structured entity via ViewRenderer with a layout driven by DisplayMode/get.
  // Note: 'content' and '' mean "show inline contentEditable" — bypass this path.
  if (blockDisplayMode && blockDisplayMode !== 'content' && blockDisplayMode !== '') {
    const ViewRendererLazy = React.lazy(() => import('../ViewRenderer'));

    return (
      <div style={{ paddingLeft: depth * 24, padding: '2px 0' }}>
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 'var(--spacing-xs)',
        }}>
          <div style={{
            width: 20, flexShrink: 0, display: 'flex', flexDirection: 'column',
            alignItems: 'flex-end', gap: 2,
          }}>
            {hasChildren && (
              <button
                onClick={() => onToggleCollapse(block.id)}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  fontSize: '10px', padding: 0, lineHeight: 1,
                  color: 'var(--palette-on-surface-variant)',
                  transform: block.collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.15s',
                }}
              >
                ▼
              </button>
            )}
            {!readOnly && hovered && (
              <select
                value={blockDisplayMode}
                onChange={e => onMetaChange(block.id, 'display_mode_change', e.target.value)}
                style={{
                  fontSize: '9px', padding: '0 2px', border: 'none',
                  background: 'transparent', color: 'var(--palette-on-surface-variant)',
                  cursor: 'pointer',
                }}
                title="Display mode"
              >
                <option value="">content</option>
                <option value="card">card</option>
                <option value="detail">detail</option>
                <option value="teaser">teaser</option>
              </select>
            )}
          </div>
          <div style={{
            flex: 1, border: '1px solid var(--palette-outline-variant)',
            borderRadius: 'var(--radius-sm)', overflow: 'hidden',
          }}>
            <React.Suspense fallback={<div style={{ padding: 8 }}>Loading...</div>}>
              <ViewRendererLazy
                inlineData={blockAsData}
                inlineLayout={resolvedBlockLayout}
                compact
              />
            </React.Suspense>
          </div>
        </div>
        {/* Render children based on view_as mode */}
        {hasChildren && !block.collapsed && (
          block.view_as && block.view_as !== 'document' && block.view_as !== 'bullet' && block.view_as !== 'numbered' ? (
            <ViewChildren block={block} context={context} />
          ) : null
        )}
      </div>
    );
  }

  // Callout block — custom styling based on variant
  const calloutVariant = block.type === 'callout' ? (block.meta?.variant as string) ?? 'info' : null;
  const calloutStyle = calloutVariant ? CALLOUT_STYLES[calloutVariant] ?? CALLOUT_STYLES.info : null;

  const isEmpty = !block.content || block.content === '<br>';
  const showPlaceholder = isEmpty && focused;

  // Process span highlights, entity references, and inline snippet refs for display (§4.2, §8.2)
  const displayContent = useMemo(() => {
    if (!block.content) return '';
    let html = block.content;
    // Apply TextSpan highlight wrappers before entity-ref expansion so that
    // entity-ref chip spans cannot split a highlight region.
    if (spanFragments && spanFragments.length > 0) {
      html = highlightBlockContent(html, spanFragments);
    }
    // renderSnippetRefs must run after renderEntityRefs so that entity chips
    // are already resolved and cannot collide with snippet-ref patterns.
    html = renderEntityRefs(html);
    return renderSnippetRefs(html);
  }, [block.content, spanFragments]);

  // Drag indicator style
  const isDragOver = dragOverId === block.id;
  const dragIndicatorStyle: React.CSSProperties = isDragOver ? {
    ...(dragOverPosition === 'before' ? {
      borderTop: '2px solid var(--palette-primary)',
    } : {
      borderBottom: '2px solid var(--palette-primary)',
    }),
  } : {};

  // Determine vertical spacing based on block type
  const isListItem = block.type === 'bullet' || block.type === 'numbered';
  const isHeading = block.type.startsWith('heading');
  const isCode = block.type === 'code';
  const blockGap = isHeading ? '6px 0 2px 0' : isListItem ? '1px 0' : isCode ? '4px 0' : '2px 0';

  // Determine list marker to show
  const listMarker = block.type === 'bullet' ? '\u2022'
    : block.type === 'numbered' && numberLabel ? `${numberLabel}.`
    : null;

  return (
    <div
      data-block-id={block.id}
      style={{ paddingLeft: depth * 24, ...dragIndicatorStyle }}
      onDragOver={e => {
        e.preventDefault();
        if (!onDragOver) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        onDragOver(block.id, e.clientY < mid ? 'before' : 'after');
      }}
      onDrop={e => {
        e.preventDefault();
        onDrop?.(block.id);
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        style={{
          display: 'flex', alignItems: 'flex-start', gap: '4px',
          padding: blockGap,
          position: 'relative',
          borderRadius: 'var(--radius-sm)',
          borderLeft: focused ? '2px solid var(--palette-primary)' : '2px solid transparent',
          transition: 'border-color 0.15s',
        }}
      >
        {/* Left margin: SpanGutter indicators (§4.5) */}
        {spanFragments && spanFragments.length > 0 && (
          <SpanGutter
            fragments={spanFragments}
            onSpanClick={onSpanClick}
          />
        )}

        {/* Gutter: list marker, drag handle, collapse toggle, and block menu on hover */}
        <div
          ref={blockMenuRef}
          style={{
            width: 20, flexShrink: 0, textAlign: 'right',
            color: 'var(--palette-on-surface-variant)',
            fontSize: '14px',
            lineHeight: BLOCK_STYLES[block.type]?.lineHeight as string ?? '1.6',
            paddingTop: isHeading ? BLOCK_STYLES[block.type].marginTop as string : undefined,
            userSelect: 'none',
            display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2,
            position: 'relative',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {/* Collapse/expand toggle — always visible when applicable */}
            {hasChildren && (
              <button
                onClick={() => onToggleCollapse(block.id)}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  fontSize: '10px', padding: 0, lineHeight: 1,
                  color: 'var(--palette-on-surface-variant)',
                  transform: block.collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.15s',
                }}
                title={block.collapsed ? 'Expand' : 'Collapse'}
              >
                ▼
              </button>
            )}
            {/* List marker (always visible) or drag handle with block menu (hover-only) */}
            {listMarker ? (
              <span
                draggable={!readOnly && hovered}
                onDragStart={e => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', block.id);
                  onDragStart?.(block.id);
                }}
                style={{
                  opacity: 0.55,
                  cursor: hovered && !readOnly ? 'grab' : 'default',
                  fontSize: block.type === 'bullet' ? '16px' : '13px',
                  minWidth: '14px',
                  textAlign: 'right',
                }}
              >
                {listMarker}
              </span>
            ) : hovered && !readOnly ? (
              <span
                draggable
                onDragStart={e => {
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', block.id);
                  onDragStart?.(block.id);
                }}
                style={{
                  opacity: 0.3,
                  cursor: 'grab',
                  fontSize: '12px',
                  minWidth: '14px',
                  textAlign: 'right',
                  transition: 'opacity 0.1s',
                }}
                title="Drag to move"
              >
                ⠿
              </span>
            ) : calloutStyle ? (
              <span style={{ opacity: 0.5, fontSize: '13px', minWidth: '14px', textAlign: 'right' }}>
                {calloutStyle.icon}
              </span>
            ) : (
              <span style={{ minWidth: '14px' }} />
            )}

            {/* Block action menu button — hover-only (§4.4) */}
            {hovered && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setBlockMenuOpen((v) => !v);
                }}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  fontSize: '12px', padding: '0 2px', lineHeight: 1,
                  color: 'var(--palette-on-surface-variant)',
                  opacity: 0.5,
                }}
                title="Block actions"
              >
                ⋮
              </button>
            )}
          </div>

          {/* Block action dropdown menu */}
          {blockMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                zIndex: 900,
                background: 'var(--palette-surface)',
                border: '1px solid var(--palette-outline-variant)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--elevation-2, 0 4px 12px rgba(0,0,0,0.15))',
                minWidth: 200,
                padding: 'var(--spacing-xs)',
              }}
            >
              <button
                onClick={() => {
                  setBlockMenuOpen(false);
                  onCopyBlockRef?.(block.id);
                }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: 'var(--spacing-xs) var(--spacing-sm)',
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: 'var(--typography-body-sm-size)',
                  color: 'var(--palette-on-surface)',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    'var(--palette-surface-variant)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                <span style={{ marginRight: 8, opacity: 0.6 }}>⊞</span>
                Copy Block Reference
                <span style={{
                  float: 'right', opacity: 0.4, fontSize: '11px',
                  fontFamily: 'var(--typography-font-family-mono)',
                }}>
                  {navigator?.platform?.includes('Mac') ? '⌘⇧B' : 'Ctrl+⇧B'}
                </span>
              </button>
            </div>
          )}

          {/* View-as picker — hover-only */}
          {hasChildren && !readOnly && hovered && (
            <ViewAsPicker block={block} onViewAsChange={onViewAsChange} />
          )}
        </div>

        {/* Content area */}
        <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
          {/* Schema toolbar (code language, callout variant, etc.) */}
          {BLOCK_SCHEMAS[block.type] && (
            <SchemaToolbar block={block} onMetaChange={onMetaChange} />
          )}

          {/* Placeholder */}
          {showPlaceholder && isEditable && (
            <div
              style={{
                position: 'absolute', top: BLOCK_SCHEMAS[block.type] ? 22 : 0, left: 0,
                color: 'var(--palette-on-surface-variant)', opacity: 0.4,
                pointerEvents: 'none',
                ...BLOCK_STYLES[block.type],
              }}
            >
              {PLACEHOLDER_TEXT[block.type] ?? ''}
            </div>
          )}

          {/* Editable content */}
          {isEditable && (
            <div
              ref={setRef}
              contentEditable={!readOnly}
              suppressContentEditableWarning
              style={{
                outline: 'none',
                minHeight: '1.4em',
                color: 'var(--palette-on-surface)',
                wordBreak: 'break-word' as const,
                ...BLOCK_STYLES[block.type],
                ...(calloutStyle ? {
                  borderLeft: `3px solid ${calloutStyle.border}`,
                  background: calloutStyle.bg,
                  paddingLeft: 'var(--spacing-md)',
                } : {}),
              }}
              onFocus={() => onFocus(block.id)}
              onBlur={handleBlur}
              onKeyDown={(e) => onKeyDown(block.id, e)}
              onClick={(e) => {
                // Detect clicks on span highlight elements (§4.2)
                if (onSpanClick) {
                  const target = e.target as HTMLElement;
                  const spanEl = target.closest('[data-span-id]') as HTMLElement | null;
                  if (spanEl) {
                    const spanId = spanEl.getAttribute('data-span-id');
                    if (spanId) onSpanClick(spanId);
                  }
                }
              }}
              dangerouslySetInnerHTML={{ __html: displayContent }}
              data-block-id={block.id}
              data-block-type={block.type}
            />
          )}
        </div>
      </div>

      {/* Render children based on view_as mode */}
      {hasChildren && !block.collapsed && (
        block.view_as && block.view_as !== 'document' && block.view_as !== 'bullet' && block.view_as !== 'numbered' ? (
          // Delegate to ViewRenderer for non-document view modes
          <ViewChildren block={block} context={context} />
        ) : null
        // Document/bullet/numbered children are rendered by the parent's flattenTree loop
      )}
    </div>
  );
});
BlockRow.displayName = 'BlockRow';

// ─── Slash Command Menu ──────────────────────────────────────────────────

interface SlashMenuProps {
  query: string;
  position: { top: number; left: number };
  selectedIndex: number;
  onSelect: (item: SlashMenuItem) => void;
  onClose: () => void;
}

const SlashMenu: React.FC<SlashMenuProps> = ({ query, position, selectedIndex, onSelect, onClose }) => {
  const filtered = useMemo(() => {
    if (!query) return SLASH_MENU_ITEMS;
    const q = query.toLowerCase();
    return SLASH_MENU_ITEMS.filter(item =>
      item.label.toLowerCase().includes(q) ||
      item.type.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.shortcut?.toLowerCase().includes('/' + q)
    );
  }, [query]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-slash-menu]')) onClose();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  if (filtered.length === 0) return null;

  return (
    <div
      data-slash-menu
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 1000,
        background: 'var(--palette-surface)',
        border: '1px solid var(--palette-outline-variant)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--elevation-2, 0 4px 12px rgba(0,0,0,0.15))',
        maxHeight: 320,
        overflow: 'auto',
        minWidth: 240,
        padding: 'var(--spacing-xs)',
      }}
    >
      <div style={{
        padding: 'var(--spacing-xs) var(--spacing-sm)',
        fontSize: '11px',
        color: 'var(--palette-on-surface-variant)',
        textTransform: 'uppercase' as const,
        letterSpacing: '0.05em',
        fontWeight: 600,
      }}>
        Block Type
      </div>
      {filtered.map((item, i) => (
        <div
          key={item.type}
          onClick={() => onSelect(item)}
          style={{
            padding: 'var(--spacing-xs) var(--spacing-sm)',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            background: i === selectedIndex ? 'var(--palette-primary-container, var(--palette-surface-variant))' : 'transparent',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
          onMouseEnter={(e) => {
            if (i !== selectedIndex) {
              (e.currentTarget as HTMLElement).style.background = 'var(--palette-surface-variant)';
            }
          }}
          onMouseLeave={(e) => {
            if (i !== selectedIndex) {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
            }
          }}
        >
          <div>
            <div style={{ fontWeight: 500, fontSize: 'var(--typography-body-md-size)' }}>{item.label}</div>
            <div style={{ fontSize: 'var(--typography-body-sm-size)', color: 'var(--palette-on-surface-variant)' }}>
              {item.description}
            </div>
          </div>
          {item.shortcut && (
            <span style={{
              fontSize: '11px',
              fontFamily: 'var(--typography-font-family-mono)',
              color: 'var(--palette-on-surface-variant)',
              opacity: 0.6,
            }}>
              {item.shortcut}
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

// ─── Formatting Toolbar ──────────────────────────────────────────────────

interface FormatToolbarProps {
  position: { top: number; left: number };
  onFormat: (command: string) => void;
}

const FormatToolbar: React.FC<FormatToolbarProps> = ({ position, onFormat }) => {
  return (
    <div
      data-format-toolbar
      style={{
        position: 'fixed',
        top: position.top - 40,
        left: position.left,
        zIndex: 1000,
        background: 'var(--palette-inverse-surface, #1a1a2e)',
        color: 'var(--palette-inverse-on-surface, #fff)',
        borderRadius: 'var(--radius-md)',
        padding: '2px',
        display: 'flex',
        gap: '1px',
        boxShadow: 'var(--elevation-3, 0 6px 16px rgba(0,0,0,0.2))',
      }}
    >
      {[
        { cmd: 'bold', label: 'B', style: { fontWeight: 700 } as React.CSSProperties, title: 'Bold (Ctrl+B)' },
        { cmd: 'italic', label: 'I', style: { fontStyle: 'italic' } as React.CSSProperties, title: 'Italic (Ctrl+I)' },
        { cmd: 'code', label: '<>', style: { fontFamily: 'var(--typography-font-family-mono)', fontSize: '12px' } as React.CSSProperties, title: 'Code (Ctrl+`)' },
        { cmd: 'strikeThrough', label: 'S', style: { textDecoration: 'line-through' } as React.CSSProperties, title: 'Strikethrough' },
      ].map((btn) => (
        <button
          key={btn.cmd}
          onMouseDown={(e) => { e.preventDefault(); onFormat(btn.cmd); }}
          title={btn.title}
          style={{
            background: 'transparent', border: 'none', color: 'inherit',
            padding: '4px 8px', cursor: 'pointer', borderRadius: 'var(--radius-sm)',
            fontSize: '14px', lineHeight: 1, ...btn.style,
          }}
        >
          {btn.label}
        </button>
      ))}
    </div>
  );
};

// ─── Main BlockEditor ────────────────────────────────────────────────────

export const BlockEditor: React.FC<BlockEditorProps> = ({
  blocks: initialBlocks,
  onChange,
  readOnly,
  context,
  onSelectionChange,
  onSpanCreatorReady,
  entityRef,
  onSpanClick,
}) => {
  const { navigateToHref } = useNavigator();
  const [blocks, setBlocks] = useState<Block[]>(
    initialBlocks.length > 0 ? initialBlocks : [createBlock('paragraph', '')],
  );
  const [focusedId, setFocusedId] = useState<string | null>(null);

  // Text selection tracking — maps DOM selection to TextAnchor positions
  const { selection, containerRef, createSpanFromSelection } = useTextSelection();

  // Serialize blocks to JSON string for TextSpan resolution (§4.2)
  const blocksContentJson = useMemo(() => JSON.stringify(blocks), [blocks]);

  // Load TextSpan highlights for this entity and resolve them to per-block fragments
  const spanFragmentsByBlock = useEntitySpans(entityRef, blocksContentJson);

  // Version pin data for span freshness actions (reanchor, pin toggle, view original)
  const { pins, reanchor, setPolicy, getOriginal } = useVersionPins(entityRef ?? '');

  // Track which span the user clicked — used to look up version pin data
  const [activeSpanId, setActiveSpanId] = useState<string | null>(null);

  // Look up the version pin for the active span (if any)
  const activePin = useMemo(
    () => activeSpanId ? pins.find(p => p.pin === activeSpanId) ?? null : null,
    [activeSpanId, pins],
  );

  const [slashMenu, setSlashMenu] = useState<{ blockId: string; query: string; position: { top: number; left: number } } | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const [formatToolbar, setFormatToolbar] = useState<{ position: { top: number; left: number } } | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<'before' | 'after' | null>(null);
  const [spanToolbarVisible, setSpanToolbarVisible] = useState(false);
  const [blockRefToast, setBlockRefToast] = useState<string | null>(null);
  const blockRefToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const blockRefs = useRef<Map<string, HTMLElement>>(new Map());

  const registerRef = useCallback((id: string, el: HTMLElement | null) => {
    if (el) blockRefs.current.set(id, el);
    else blockRefs.current.delete(id);
  }, []);

  // Flatten tree for rendering — single-pass, skips collapsed and view-delegated children
  const flatEntries = useMemo(() => {
    const EDITOR_VIEW_MODES = new Set(['', 'document', 'bullet', 'numbered']);
    const result: FlatEntry[] = [];

    function walk(list: Block[], depth: number, parentId: string | null) {
      for (let i = 0; i < list.length; i++) {
        const block = list[i];
        result.push({ block, depth, parentId, indexInParent: i });
        // Recurse into children only if:
        // 1. Block has children
        // 2. Block is not collapsed
        // 3. Children render in the editor (document/bullet/numbered), not via ViewRenderer
        if (block.children && block.children.length > 0 && !block.collapsed) {
          const va = block.view_as ?? '';
          if (EDITOR_VIEW_MODES.has(va)) {
            walk(block.children, depth + 1, block.id);
          }
        }
      }
    }

    walk(blocks, 0, null);
    return result;
  }, [blocks]);

  // Propagate changes
  const updateBlocks = useCallback((newBlocks: Block[]) => {
    setBlocks(newBlocks);
    onChange(newBlocks);
  }, [onChange]);

  // Focus a block by ID
  const focusBlock = useCallback((id: string, atEnd = false) => {
    requestAnimationFrame(() => {
      const el = blockRefs.current.get(id);
      if (!el) return;
      el.focus();
      if (atEnd && el.childNodes.length > 0) {
        const range = document.createRange();
        const sel = window.getSelection();
        range.selectNodeContents(el);
        range.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(range);
      }
    });
  }, []);

  // Content change handler (tree-aware)
  // Detects transclusion syntax on paste in priority order (§4.2, §4.4, §8.4):
  //   1. ((entity#span=spanId))  → snippet-embed (§8.4)
  //   2. ((entity#blockId))      → block-embed   (§4.4)
  //   3. ((entity))              → entity-embed  (§4.2)
  const handleContentChange = useCallback((id: string, html: string) => {
    setBlocks(prev => {
      const found = findBlock(prev, id);
      if (!found || found.block.content === html) return prev;

      // Check for transclusion syntax — most specific patterns first
      const textContent = html.replace(/<[^>]*>/g, '');

      // Check for ((entity-id#span=spanId)) snippet transclusion syntax
      const snippetTransclusionMatch = textContent.match(/^\(\(([^#)]+)#span=([^)]+)\)\)$/);
      if (snippetTransclusionMatch) {
        // Convert this block to a snippet-embed
        const entityId = snippetTransclusionMatch[1].trim();
        const spanId = snippetTransclusionMatch[2].trim();
        const next = updateBlock(prev, id, b => ({
          ...b,
          type: 'snippet-embed' as BlockType,
          content: '',
          meta: { ...(b.meta ?? {}), entityId, spanId },
        }));
        onChange(next);
        return next;
      }

      // Check for ((entity-id#block-id)) block transclusion syntax
      const blockTransclusionMatch = textContent.match(/^\(\(([^#)]+)#([^)]+)\)\)$/);
      if (blockTransclusionMatch) {
        // Convert this block to a block-embed
        const entityId = blockTransclusionMatch[1].trim();
        const blockId = blockTransclusionMatch[2].trim();
        const next = updateBlock(prev, id, b => ({
          ...b,
          type: 'block-embed' as BlockType,
          content: '',
          meta: { ...(b.meta ?? {}), entityId, blockId },
        }));
        onChange(next);
        return next;
      }

      // Check for ((entity-id)) entity transclusion syntax
      const transclusionMatch = textContent.match(/^\(\(([^)]+)\)\)$/);
      if (transclusionMatch) {
        // Convert this block to an entity-embed
        const entityId = transclusionMatch[1].trim();
        const next = updateBlock(prev, id, b => ({
          ...b,
          type: 'entity-embed' as BlockType,
          content: '',
          meta: { ...(b.meta ?? {}), entityId },
        }));
        onChange(next);
        return next;
      }

      const next = updateBlock(prev, id, b => ({ ...b, content: html }));
      onChange(next);
      return next;
    });
  }, [onChange]);

  // Meta change handler
  const handleMetaChange = useCallback((id: string, key: string, value: unknown) => {
    setBlocks(prev => {
      let next: Block[];
      if (key === 'display_mode_change') {
        // Special key: update block.display_mode instead of block.meta
        next = updateBlock(prev, id, b => ({
          ...b,
          display_mode: (value as string) || undefined,
        }));
      } else {
        next = updateBlock(prev, id, b => ({
          ...b,
          meta: { ...(b.meta ?? {}), [key]: value },
        }));
      }
      onChange(next);
      return next;
    });
  }, [onChange]);

  // Toggle collapse
  const handleToggleCollapse = useCallback((id: string) => {
    setBlocks(prev => {
      const next = updateBlock(prev, id, b => ({ ...b, collapsed: !b.collapsed }));
      onChange(next);
      return next;
    });
  }, [onChange]);

  // View-as change
  const handleViewAsChange = useCallback((id: string, viewAs: string | undefined) => {
    setBlocks(prev => {
      const next = updateBlock(prev, id, b => {
        const updated = { ...b };
        if (viewAs) updated.view_as = viewAs;
        else delete updated.view_as;
        return updated;
      });
      onChange(next);
      return next;
    });
  }, [onChange]);

  // Drag-and-drop handlers
  const handleDragStart = useCallback((id: string) => {
    setDragId(id);
  }, []);

  const handleDragOver = useCallback((id: string, position: 'before' | 'after') => {
    setDragOverId(id);
    setDragOverPosition(position);
  }, []);

  const handleDrop = useCallback((targetId: string) => {
    if (!dragId || dragId === targetId) {
      setDragId(null);
      setDragOverId(null);
      setDragOverPosition(null);
      return;
    }
    setBlocks(prev => {
      const next = moveBlock(prev, dragId, targetId, dragOverPosition ?? 'after');
      onChange(next);
      return next;
    });
    setDragId(null);
    setDragOverId(null);
    setDragOverPosition(null);
  }, [dragId, dragOverPosition, onChange]);

  // Handle slash command — position near the cursor
  const openSlashMenu = useCallback((blockId: string) => {
    const el = blockRefs.current.get(blockId);
    if (!el) return;

    // Try to position at cursor location
    const sel = window.getSelection();
    let top: number;
    let left: number;
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const cursorRect = range.getBoundingClientRect();
      if (cursorRect.height > 0) {
        top = cursorRect.bottom + 4;
        left = cursorRect.left;
      } else {
        const elRect = el.getBoundingClientRect();
        top = elRect.bottom + 4;
        left = elRect.left;
      }
    } else {
      const elRect = el.getBoundingClientRect();
      top = elRect.bottom + 4;
      left = elRect.left;
    }

    setSlashMenu({ blockId, query: '', position: { top, left } });
    setSlashIndex(0);
  }, []);

  const closeSlashMenu = useCallback(() => {
    setSlashMenu(null);
    setSlashIndex(0);
  }, []);

  const selectSlashItem = useCallback((item: SlashMenuItem) => {
    if (!slashMenu) return;
    const blockId = slashMenu.blockId;

    setBlocks(prev => {
      const found = findBlock(prev, blockId);
      if (!found) return prev;

      // Clear the slash command text from the block
      const el = blockRefs.current.get(blockId);
      if (el) el.innerHTML = '';

      if (item.type === 'divider') {
        // Insert divider after current block, plus a new paragraph
        const divider = createBlock('divider');
        const newPara = createBlock('paragraph', '');
        let next = insertBlock(prev, blockId, divider, 'after');
        next = insertBlock(next, divider.id, newPara, 'after');
        // Clear current block content
        next = updateBlock(next, blockId, b => ({ ...b, content: '' }));
        onChange(next);
        requestAnimationFrame(() => focusBlock(newPara.id));
        return next;
      }

      // Change current block's type
      const next = updateBlock(prev, blockId, b => ({
        ...b,
        type: item.type,
        content: '',
        meta: item.meta ? { ...item.meta } : b.meta,
      }));
      onChange(next);
      requestAnimationFrame(() => focusBlock(blockId));
      return next;
    });

    closeSlashMenu();
  }, [slashMenu, onChange, focusBlock, closeSlashMenu]);

  // Handle text selection for format toolbar and span toolbar
  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      setFormatToolbar(null);
      setSpanToolbarVisible(false);
      return;
    }
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0) {
      setFormatToolbar(null);
      setSpanToolbarVisible(false);
      return;
    }
    setFormatToolbar({
      position: { top: rect.top, left: rect.left + rect.width / 2 - 60 },
    });
    // Clear active span — fresh text selection is not a span click
    setActiveSpanId(null);
    // Show span toolbar when entityRef is provided (§4.3)
    if (entityRef) {
      setSpanToolbarVisible(true);
    }
  }, [entityRef]);

  // Handle span highlight click — set active span and show toolbar with version actions
  const handleSpanClick = useCallback((spanId: string) => {
    setActiveSpanId(spanId);
    setSpanToolbarVisible(true);
    onSpanClick?.(spanId);
  }, [onSpanClick]);

  // Version action callbacks wired to useVersionPins
  const handleUpdateVersion = useCallback(() => {
    if (activeSpanId) void reanchor(activeSpanId);
  }, [activeSpanId, reanchor]);

  const handleTogglePin = useCallback(() => {
    if (!activeSpanId || !activePin) return;
    const nextPolicy = activePin.policy === 'pin' ? 'auto' : 'pin';
    void setPolicy(activeSpanId, nextPolicy);
  }, [activeSpanId, activePin, setPolicy]);

  const handleViewOriginal = useCallback(() => {
    if (!activeSpanId) return;
    void getOriginal(activeSpanId).then((content) => {
      if (content) {
        // Open original content in a simple alert for now — future: modal/panel
        window.alert(content);
      }
    });
  }, [activeSpanId, getOriginal]);

  // Copy block reference (§4.4)
  const handleCopyBlockRef = useCallback(async (blockId: string) => {
    if (!entityRef) return;
    const ref = `((${entityRef}#${blockId}))`;
    try {
      await navigator.clipboard.writeText(ref);
      setBlockRefToast('Block reference copied');
      if (blockRefToastTimerRef.current) clearTimeout(blockRefToastTimerRef.current);
      blockRefToastTimerRef.current = setTimeout(() => setBlockRefToast(null), 2500);
    } catch {
      // Clipboard not available — fail silently
    }
  }, [entityRef]);

  // Copy snippet reference (§8.5) — Ctrl+Shift+C / Cmd+Shift+C
  // Creates a TextAnchor pair + TextSpan for the current text selection and copies
  // the ((entityRef#span=spanId)) reference string to the clipboard.
  const handleCopySnippetRef = useCallback(async () => {
    if (!entityRef) return;
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    try {
      const spanId = await createSpanFromSelection(entityRef, 'excerpt');
      if (spanId) {
        const ref = `((${entityRef}#span=${spanId}))`;
        await navigator.clipboard.writeText(ref);
        setBlockRefToast('Snippet reference copied');
        if (blockRefToastTimerRef.current) clearTimeout(blockRefToastTimerRef.current);
        blockRefToastTimerRef.current = setTimeout(() => setBlockRefToast(null), 2500);
      }
    } catch {
      // Clipboard or span creation not available — fail silently
    }
  }, [entityRef, createSpanFromSelection]);

  const handleFormat = useCallback((command: string) => {
    if (command === 'code') {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      const range = sel.getRangeAt(0);
      const code = document.createElement('code');
      code.style.cssText = 'background: var(--palette-surface-variant); padding: 1px 4px; border-radius: 3px; font-family: var(--typography-font-family-mono); font-size: 0.9em;';
      range.surroundContents(code);
    } else {
      document.execCommand(command, false);
    }
  }, []);

  // Keyboard handling (tree-aware)
  const handleKeyDown = useCallback((blockId: string, e: React.KeyboardEvent) => {
    const el = blockRefs.current.get(blockId);
    if (!el) return;

    // Slash menu keyboard navigation
    if (slashMenu) {
      const filtered = SLASH_MENU_ITEMS.filter(item => {
        if (!slashMenu.query) return true;
        const q = slashMenu.query.toLowerCase();
        return item.label.toLowerCase().includes(q) || item.type.toLowerCase().includes(q);
      });

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSlashIndex(prev => Math.min(prev + 1, filtered.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSlashIndex(prev => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        if (filtered[slashIndex]) selectSlashItem(filtered[slashIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSlashMenu();
        return;
      }
      // Update query from content
      requestAnimationFrame(() => {
        const text = el.textContent ?? '';
        const slashIdx = text.lastIndexOf('/');
        if (slashIdx === -1) {
          closeSlashMenu();
        } else {
          const query = text.slice(slashIdx + 1);
          setSlashMenu(prev => prev ? { ...prev, query } : null);
          setSlashIndex(0);
        }
      });
    }

    // Rich text shortcuts and block-level shortcuts
    if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
      if (e.key === 'B' || e.key === 'b') {
        // Ctrl+Shift+B / Cmd+Shift+B — Copy Block Reference (§4.4)
        e.preventDefault();
        void handleCopyBlockRef(blockId);
        return;
      }
      if (e.key === 'C' || e.key === 'c') {
        // Ctrl+Shift+C / Cmd+Shift+C — Copy Snippet Reference (§8.5)
        const sel = window.getSelection();
        if (sel && !sel.isCollapsed) {
          e.preventDefault();
          void handleCopySnippetRef();
          return;
        }
      }
    }

    if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
      if (e.key === 'b') {
        e.preventDefault();
        document.execCommand('bold', false);
        return;
      }
      if (e.key === 'i') {
        e.preventDefault();
        document.execCommand('italic', false);
        return;
      }
      if (e.key === '`') {
        e.preventDefault();
        handleFormat('code');
        return;
      }
    }

    // Slash command trigger
    if (e.key === '/' && !slashMenu) {
      const text = el.textContent ?? '';
      if (text === '' || text.trim() === '') {
        requestAnimationFrame(() => openSlashMenu(blockId));
        return;
      }
    }

    // Tab: indent block (make child of previous sibling)
    if (e.key === 'Tab' && !e.shiftKey && !slashMenu) {
      const block = findBlock(blocks, blockId);
      // Allow Tab in code blocks for indentation
      if (block?.block.type === 'code') {
        e.preventDefault();
        document.execCommand('insertText', false, '  ');
        return;
      }
      e.preventDefault();
      const next = indentBlock(blocks, blockId);
      if (next !== blocks) updateBlocks(next);
      return;
    }

    // Shift+Tab: outdent block
    if (e.key === 'Tab' && e.shiftKey && !slashMenu) {
      e.preventDefault();
      const next = outdentBlock(blocks, blockId);
      if (next !== blocks) updateBlocks(next);
      return;
    }

    // Enter: create new block at same level
    if (e.key === 'Enter' && !e.shiftKey && !slashMenu) {
      e.preventDefault();

      // Save current content before splitting
      handleContentChange(blockId, el.innerHTML);

      setBlocks(prev => {
        const found = findBlock(prev, blockId);
        if (!found) return prev;

        const currentText = el.textContent ?? '';
        const isList = found.block.type === 'bullet' || found.block.type === 'numbered';

        // Empty list item: exit list by converting to paragraph
        if (isList && (currentText === '' || el.innerHTML === '<br>')) {
          const next = updateBlock(prev, blockId, b => ({
            ...b, type: 'paragraph' as BlockType, content: '',
          }));
          el.innerHTML = '';
          onChange(next);
          requestAnimationFrame(() => focusBlock(blockId));
          return next;
        }

        // Get cursor position to split content
        const sel = window.getSelection();
        let beforeHtml = el.innerHTML;
        let afterHtml = '';

        if (sel && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const afterRange = range.cloneRange();
          afterRange.selectNodeContents(el);
          afterRange.setStart(range.endContainer, range.endOffset);
          const afterFrag = afterRange.cloneContents();
          const tmp = document.createElement('div');
          tmp.appendChild(afterFrag);
          afterHtml = tmp.innerHTML;

          const beforeRange = range.cloneRange();
          beforeRange.selectNodeContents(el);
          beforeRange.setEnd(range.startContainer, range.startOffset);
          const beforeFrag = beforeRange.cloneContents();
          const tmp2 = document.createElement('div');
          tmp2.appendChild(beforeFrag);
          beforeHtml = tmp2.innerHTML;
        }

        // Determine new block type (continue list type)
        const newType = isList ? found.block.type : 'paragraph';

        const newBlock = createBlock(newType, afterHtml);

        // Update current block and insert new one after it
        let next = updateBlock(prev, blockId, b => ({ ...b, content: beforeHtml }));
        next = insertBlock(next, blockId, newBlock, 'after');

        el.innerHTML = beforeHtml;
        onChange(next);
        requestAnimationFrame(() => focusBlock(newBlock.id));
        return next;
      });
      return;
    }

    // Backspace: handle empty blocks and merging at start of content
    if (e.key === 'Backspace') {
      const text = el.textContent ?? '';
      const isEmpty = text === '' || el.innerHTML === '<br>';

      // Check if cursor is at position 0 (start of block)
      const sel = window.getSelection();
      let cursorAtStart = isEmpty;
      if (!isEmpty && sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const preRange = document.createRange();
        preRange.selectNodeContents(el);
        preRange.setEnd(range.startContainer, range.startOffset);
        cursorAtStart = preRange.toString().length === 0 && range.collapsed;
      }

      if (isEmpty) {
        e.preventDefault();
        setBlocks(prev => {
          const found = findBlock(prev, blockId);
          if (!found) return prev;

          // If the block type isn't paragraph, convert to paragraph first
          if (found.block.type !== 'paragraph') {
            const next = updateBlock(prev, blockId, b => ({ ...b, type: 'paragraph' as BlockType }));
            onChange(next);
            return next;
          }

          // Try to outdent first
          const d = getBlockDepth(prev, blockId);
          if (d > 0) {
            const next = outdentBlock(prev, blockId);
            if (next !== prev) {
              onChange(next);
              return next;
            }
          }

          // At root level: delete and focus previous
          const flat = flattenTree(prev, true);
          const flatIdx = flat.findIndex(e => e.block.id === blockId);
          if (flatIdx <= 0) return prev;

          const prevEntry = flat[flatIdx - 1];
          const { tree } = removeBlock(prev, blockId);
          onChange(tree);
          focusBlock(prevEntry.block.id, true);
          return tree;
        });
        return;
      }

      // Cursor at start of non-empty block: merge with previous block
      if (cursorAtStart) {
        e.preventDefault();
        const currentHtml = el.innerHTML;
        setBlocks(prev => {
          const flat = flattenTree(prev, true);
          const flatIdx = flat.findIndex(e => e.block.id === blockId);
          if (flatIdx <= 0) return prev;

          const prevEntry = flat[flatIdx - 1];
          const prevBlock = prevEntry.block;
          // Only merge with editable blocks
          if (!EDITABLE_TYPES.has(prevBlock.type)) return prev;

          // Append current content to previous block
          const mergedContent = (prevBlock.content || '').replace(/<br\s*\/?>$/i, '') + currentHtml;
          const prevContentLength = (blockRefs.current.get(prevBlock.id)?.textContent ?? '').length;

          let next = updateBlock(prev, prevBlock.id, b => ({ ...b, content: mergedContent }));
          const { tree } = removeBlock(next, blockId);
          onChange(tree);

          // Focus previous block and place cursor at merge point
          requestAnimationFrame(() => {
            const prevEl = blockRefs.current.get(prevBlock.id);
            if (!prevEl) return;
            prevEl.innerHTML = mergedContent;
            prevEl.focus();
            // Place cursor at merge point
            try {
              const r = document.createRange();
              const s = window.getSelection();
              // Walk text nodes to find the offset position
              let charCount = 0;
              function walkNodes(node: Node): boolean {
                if (node.nodeType === Node.TEXT_NODE) {
                  const len = (node.textContent ?? '').length;
                  if (charCount + len >= prevContentLength) {
                    r.setStart(node, prevContentLength - charCount);
                    r.collapse(true);
                    s?.removeAllRanges();
                    s?.addRange(r);
                    return true;
                  }
                  charCount += len;
                } else {
                  for (const child of Array.from(node.childNodes)) {
                    if (walkNodes(child)) return true;
                  }
                }
                return false;
              }
              walkNodes(prevEl);
            } catch {
              // Fallback: just focus at end
              focusBlock(prevBlock.id, true);
            }
          });
          return tree;
        });
        return;
      }
    }

    // Arrow up at start of block: focus previous in flat list
    if (e.key === 'ArrowUp') {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const preRange = document.createRange();
        preRange.selectNodeContents(el);
        preRange.setEnd(range.startContainer, range.startOffset);
        if (preRange.toString().length === 0) {
          e.preventDefault();
          const flatIdx = flatEntries.findIndex(e => e.block.id === blockId);
          if (flatIdx > 0) focusBlock(flatEntries[flatIdx - 1].block.id, true);
        }
      }
    }

    // Arrow down at end of block: focus next in flat list
    if (e.key === 'ArrowDown') {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const postRange = document.createRange();
        postRange.selectNodeContents(el);
        postRange.setStart(range.endContainer, range.endOffset);
        if (postRange.toString().length === 0) {
          e.preventDefault();
          const flatIdx = flatEntries.findIndex(e => e.block.id === blockId);
          if (flatIdx >= 0 && flatIdx < flatEntries.length - 1) {
            focusBlock(flatEntries[flatIdx + 1].block.id);
          }
        }
      }
    }

    // Close format toolbar on typing
    setFormatToolbar(null);
  }, [slashMenu, slashIndex, blocks, flatEntries, handleContentChange, openSlashMenu, closeSlashMenu, selectSlashItem, focusBlock, handleFormat, onChange, updateBlocks, handleCopyBlockRef, handleCopySnippetRef]);

  // Compute numbered list labels (per depth level, resets on non-numbered blocks)
  const numberLabels = useMemo(() => {
    const labels = new Map<string, number>();
    const counterByDepth = new Map<number, number>();
    let lastDepthType = new Map<number, BlockType>();

    for (const entry of flatEntries) {
      const { block, depth } = entry;
      if (block.type === 'numbered') {
        const prevType = lastDepthType.get(depth);
        if (prevType !== 'numbered') counterByDepth.set(depth, 0);
        const count = (counterByDepth.get(depth) ?? 0) + 1;
        counterByDepth.set(depth, count);
        labels.set(block.id, count);
      } else {
        counterByDepth.set(depth, 0);
      }
      lastDepthType.set(depth, block.type);
    }
    return labels;
  }, [flatEntries]);

  // Handle entity reference clicks via navigateToHref
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.classList.contains('entity-ref')) {
        e.preventDefault();
        const entity = target.dataset.entity;
        if (entity) {
          navigateToHref(`/content/${entity}`);
        }
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [navigateToHref]);

  // Handle inline snippet-ref clicks (§8.2): navigate to entity + span anchor
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.classList.contains('snippet-ref')) {
        e.preventDefault();
        const entityId = target.dataset.entity;
        const spanId = target.dataset.span;
        if (entityId && spanId) {
          navigateToHref(`/content/${entityId}#span=${spanId}`);
        }
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [navigateToHref]);

  // Handle inline snippet-ref hover tooltip (§8.2)
  // Shows a floating popover with the span context on mouseenter,
  // positioned relative to the chip. Dismissed on mouseleave.
  useEffect(() => {
    let tooltip: HTMLElement | null = null;

    const showTooltip = (target: HTMLElement) => {
      const entityId = target.dataset.entity;
      const spanId = target.dataset.span;
      if (!entityId || !spanId) return;

      tooltip = document.createElement('div');
      tooltip.className = 'snippet-ref-tooltip';
      tooltip.setAttribute('role', 'tooltip');
      tooltip.textContent = `Span: ${spanId} — click to open in ${entityId}`;

      document.body.appendChild(tooltip);

      const rect = target.getBoundingClientRect();
      const scrollY = window.scrollY;
      const scrollX = window.scrollX;
      tooltip.style.top = `${rect.bottom + scrollY + 6}px`;
      tooltip.style.left = `${rect.left + scrollX}px`;
    };

    const hideTooltip = () => {
      if (tooltip) {
        tooltip.remove();
        tooltip = null;
      }
    };

    const handleMouseEnter = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.classList.contains('snippet-ref')) {
        showTooltip(target);
      }
    };

    const handleMouseLeave = (e: MouseEvent) => {
      const target = e.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.classList.contains('snippet-ref')) {
        hideTooltip();
      }
    };

    document.addEventListener('mouseenter', handleMouseEnter, true);
    document.addEventListener('mouseleave', handleMouseLeave, true);
    return () => {
      document.removeEventListener('mouseenter', handleMouseEnter, true);
      document.removeEventListener('mouseleave', handleMouseLeave, true);
      hideTooltip();
    };
  }, []);

  // Notify parent of selection changes
  useEffect(() => {
    onSelectionChange?.(selection);
  }, [selection, onSelectionChange]);

  // Expose createSpanFromSelection to parent via imperative callback
  useEffect(() => {
    onSpanCreatorReady?.(createSpanFromSelection);
  }, [createSpanFromSelection, onSpanCreatorReady]);

  const totalBlocks = useMemo(() => countBlocks(blocks), [blocks]);

  return (
    <div
      ref={containerRef as React.RefObject<HTMLDivElement>}
      onDragEnd={() => { setDragId(null); setDragOverId(null); setDragOverPosition(null); }}
      style={{
        background: 'var(--palette-surface)',
        border: '1px solid var(--palette-outline-variant)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}
      onMouseUp={handleMouseUp}
    >
      {/* Toolbar */}
      <div style={{
        padding: 'var(--spacing-xs) var(--spacing-sm)',
        borderBottom: '1px solid var(--palette-outline-variant)',
        background: 'var(--palette-surface-variant)',
        display: 'flex',
        gap: 'var(--spacing-sm)',
        alignItems: 'center',
        fontSize: 'var(--typography-label-sm-size)',
        color: 'var(--palette-on-surface-variant)',
      }}>
        <span style={{ fontFamily: 'var(--typography-font-family-mono)' }}>
          {totalBlocks} block{totalBlocks !== 1 ? 's' : ''}
        </span>
        {!readOnly && (
          <>
            <span style={{ opacity: 0.3 }}>|</span>
            <span style={{ opacity: 0.5 }}>
              Type <kbd style={{
                padding: '0 3px', border: '1px solid var(--palette-outline-variant)',
                borderRadius: 2, fontSize: '10px', background: 'var(--palette-surface)',
              }}>/</kbd> for commands
              &nbsp;&middot;&nbsp;
              <kbd style={{
                padding: '0 3px', border: '1px solid var(--palette-outline-variant)',
                borderRadius: 2, fontSize: '10px', background: 'var(--palette-surface)',
              }}>Tab</kbd> indent
              &nbsp;
              <kbd style={{
                padding: '0 3px', border: '1px solid var(--palette-outline-variant)',
                borderRadius: 2, fontSize: '10px', background: 'var(--palette-surface)',
              }}>Shift+Tab</kbd> outdent
            </span>
          </>
        )}
      </div>

      {/* Blocks */}
      <div style={{ padding: 'var(--spacing-sm) var(--spacing-md)' }}>
        {flatEntries.map((entry) => (
          <BlockRow
            key={entry.block.id}
            block={entry.block}
            depth={entry.depth}
            focused={focusedId === entry.block.id}
            onFocus={setFocusedId}
            onContentChange={handleContentChange}
            onKeyDown={handleKeyDown}
            onMetaChange={handleMetaChange}
            onToggleCollapse={handleToggleCollapse}
            onViewAsChange={handleViewAsChange}
            readOnly={readOnly}
            registerRef={registerRef}
            numberLabel={numberLabels.get(entry.block.id)}
            context={context}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            dragOverId={dragOverId}
            dragOverPosition={dragOverPosition}
            spanFragments={spanFragmentsByBlock.get(entry.block.id)}
            onSpanClick={handleSpanClick}
            onCopyBlockRef={handleCopyBlockRef}
            entityRef={entityRef}
          />
        ))}
      </div>

      {/* Slash command menu */}
      {slashMenu && (
        <SlashMenu
          query={slashMenu.query}
          position={slashMenu.position}
          selectedIndex={slashIndex}
          onSelect={selectSlashItem}
          onClose={closeSlashMenu}
        />
      )}

      {/* Format toolbar */}
      {formatToolbar && !readOnly && (
        <FormatToolbar
          position={formatToolbar.position}
          onFormat={handleFormat}
        />
      )}

      {/* Span toolbar — appears when text is selected and entityRef is provided (§4.3) */}
      {spanToolbarVisible && entityRef && !readOnly && (
        <SpanToolbar
          selection={selection}
          entityRef={entityRef}
          createSpanFromSelection={createSpanFromSelection}
          onDismiss={() => { setSpanToolbarVisible(false); setActiveSpanId(null); }}
          freshness={activePin?.freshness}
          versionsBehind={activePin?.versionsBehind}
          versionPolicy={activePin?.policy}
          onUpdateVersion={activePin?.freshness === 'outdated' ? handleUpdateVersion : undefined}
          onTogglePin={activePin ? handleTogglePin : undefined}
          onViewOriginal={activePin ? handleViewOriginal : undefined}
        />
      )}

      {/* Block reference copied toast (§4.4) */}
      {blockRefToast && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1300,
            background: 'var(--palette-inverse-surface, #1a1a2e)',
            color: 'var(--palette-inverse-on-surface, #fff)',
            padding: '8px 16px',
            borderRadius: 'var(--radius-md)',
            fontSize: '13px',
            fontWeight: 500,
            boxShadow: 'var(--elevation-3, 0 6px 16px rgba(0,0,0,0.2))',
            pointerEvents: 'none',
          }}
        >
          {blockRefToast}
        </div>
      )}
    </div>
  );
};

export default BlockEditor;
