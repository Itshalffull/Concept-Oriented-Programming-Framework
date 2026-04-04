'use client';

/**
 * BlockEmbed — standalone block-embed block type component.
 *
 * Renders a single block transcluded from another entity. The block is
 * identified by its source entityId and blockId, both stored in block.meta.
 *
 * Registration:
 * - Slash command: /block-embed
 * - Paste detection: ((entity-id#block-id)) pattern auto-converts to block-embed
 *
 * §8.3 Block-Embed Block Type (PRD: docs/prd/text-span-addressing.md)
 */

import React, { useEffect, useMemo } from 'react';
import { useConceptQuery } from '../../../lib/use-concept-query';
import { findBlock } from '../../../lib/block-tree-utils';
import type { Block, BlockType } from '../../../lib/block-serialization';

// Conditionally import useOrigin — may not exist yet (created by another card)
let useOrigin: ((id: string) => { kind: string; displayName: string }) | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('../../lib/use-origin');
  useOrigin = mod.useOrigin ?? mod.default;
} catch {
  // useOrigin not available yet — OriginBadge will be skipped
}

// ─── Block Type Registration Metadata ────────────────────────────────────

/**
 * Registration descriptor for the block-embed block type.
 * Import this into the block type registry to enable /block-embed slash
 * command and ((entity#block)) paste detection in the BlockEditor.
 */
export const BLOCK_EMBED_REGISTRATION = {
  type: 'block-embed' as BlockType,
  label: 'Block Embed',
  description: 'Embed a specific block from another entity',
  /** Slash command that inserts a new block-embed block */
  shortcut: '/block-embed',
  /** Regex that matches ((entity-id#block-id)) — used by the paste detector */
  pastePattern: /^\(\(([^#)]+)#([^)=][^)]*)\)\)$/,
  /**
   * Given a paste-pattern match, return the meta object for the new block.
   * The caller should set block.type = 'block-embed' and block.meta = this result.
   */
  parsePaste(match: RegExpMatchArray): { entityId: string; blockId: string } {
    return { entityId: match[1].trim(), blockId: match[2].trim() };
  },
};

// ─── Block Style Map (mirrors BlockEditor BLOCK_STYLES) ──────────────────

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
};

// ─── Skeleton ─────────────────────────────────────────────────────────────

const BlockEmbedSkeleton: React.FC = () => (
  <div style={{
    padding: 'var(--spacing-sm) var(--spacing-md)',
    background: 'var(--palette-surface-variant)',
    borderRadius: 'var(--radius-sm)',
    border: '1px dashed var(--palette-outline-variant)',
  }}>
    <div style={{
      height: 12,
      width: '60%',
      background: 'var(--palette-outline-variant)',
      borderRadius: 4,
      opacity: 0.4,
      marginBottom: 8,
    }} />
    <div style={{
      height: 10,
      width: '40%',
      background: 'var(--palette-outline-variant)',
      borderRadius: 4,
      opacity: 0.3,
    }} />
  </div>
);

// ─── Entity Ref Rendering ─────────────────────────────────────────────────

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

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

// ─── BlockEmbed Component ─────────────────────────────────────────────────

export interface BlockEmbedProps {
  /** The block-embed block from the editor */
  block: Block;
  /** When true the component is read-only (no schema toolbar controls) */
  readOnly?: boolean;
  /**
   * Called when block meta changes (e.g. clearing entityId/blockId).
   * Required for edit-mode clear button; may be omitted in read-only contexts.
   */
  onMetaChange?: (id: string, key: string, value: unknown) => void;
  /** Optional origin identifier — when present, an OriginBadge is shown for non-local origins */
  origin?: string;
}

/**
 * BlockEmbed renders a single block transcluded from another entity.
 *
 * Features:
 * - Loading skeleton while the source entity is fetched
 * - "Block not found" error state when the blockId does not exist in the source
 * - Source attribution header with entity name and "View in context" link
 * - Indented, left-bordered blockquote-style rendering of the embedded block
 * - Live updates: refetches the source entity whenever entityId changes
 * - Read-only: the embedded block is non-editable (pointerEvents: none)
 */
export const BlockEmbed: React.FC<BlockEmbedProps> = ({ block, readOnly, onMetaChange, origin }) => {
  const entityId = block.meta?.entityId as string | undefined;
  const blockId = block.meta?.blockId as string | undefined;

  // Fetch the source entity content via ContentNode/get.
  // Passing '__none__' skips the query when entityId is absent.
  const {
    data: entityData,
    loading,
    refetch,
  } = useConceptQuery<{ variant: string; content?: string; name?: string }>(
    'ContentNode',
    'get',
    entityId ? { node: entityId } : { node: '__none__' },
  );

  // Re-fetch when the source entityId changes (live update support).
  useEffect(() => {
    if (entityId) refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId]);

  // Locate the embedded block within the source entity's block tree.
  const foundBlock = React.useMemo(() => {
    if (!entityData || entityData.variant !== 'ok' || !entityData.content || !blockId) {
      return null;
    }
    try {
      const parsed = JSON.parse(entityData.content);
      if (!Array.isArray(parsed)) return null;
      const result = findBlock(parsed as Block[], blockId);
      return result ? result.block : null;
    } catch {
      return null;
    }
  }, [entityData, blockId]);

  const entityName = entityData?.variant === 'ok'
    ? (entityData.name ?? entityId)
    : entityId;

  // Resolve origin info when an origin prop is provided and useOrigin is available
  const originInfo = useMemo(() => {
    if (!origin || !useOrigin) return null;
    try {
      return useOrigin(origin);
    } catch {
      return null;
    }
  }, [origin]);

  const showOriginBadge = originInfo != null && originInfo.kind !== 'local';

  // ── Not configured ────────────────────────────────────────────────────
  if (!entityId || !blockId) {
    return (
      <div
        data-part="root"
        data-state="unconfigured"
        style={{
          padding: 'var(--spacing-sm) var(--spacing-md)',
          background: 'var(--palette-surface-variant)',
          borderRadius: 'var(--radius-sm)',
          border: '1px dashed var(--palette-outline-variant)',
          fontSize: '13px',
          color: 'var(--palette-on-surface-variant)',
        }}
      >
        Block Embed — set entityId and blockId in the schema toolbar above
      </div>
    );
  }

  // ── Loading skeleton ──────────────────────────────────────────────────
  if (loading || !entityData) {
    return (
      <div data-part="root" data-state="loading">
        <BlockEmbedSkeleton />
      </div>
    );
  }

  // ── Source entity not found / fetch error ─────────────────────────────
  if (entityData.variant !== 'ok') {
    return (
      <div
        data-part="root"
        data-state="error"
        style={{
          padding: 'var(--spacing-sm) var(--spacing-md)',
          background: 'var(--palette-surface-variant)',
          borderRadius: 'var(--radius-sm)',
          border: '1px dashed var(--palette-outline-variant)',
          fontSize: '13px',
          color: 'var(--palette-on-surface-variant)',
        }}
      >
        Loading block embed...
      </div>
    );
  }

  // ── Block not found in source entity ─────────────────────────────────
  if (!foundBlock) {
    return (
      <div
        data-part="root"
        data-state="not-found"
        style={{
          padding: 'var(--spacing-sm) var(--spacing-md)',
          background: 'var(--palette-surface-variant)',
          borderRadius: 'var(--radius-sm)',
          border: '1px dashed #ef4444',
          fontSize: '13px',
          color: '#ef4444',
        }}
      >
        Block not found:{' '}
        <code style={{ fontFamily: 'var(--typography-font-family-mono)' }}>{blockId}</code>{' '}
        in entity {entityName}
      </div>
    );
  }

  // ── Resolved: render the embedded block ──────────────────────────────
  const blockStyle = BLOCK_STYLES[foundBlock.type] ?? BLOCK_STYLES.paragraph;
  const rawContent = foundBlock.content ?? '';

  return (
    <div
      data-part="root"
      data-state="loaded"
      style={{
        position: 'relative' as const,
        border: '1px solid var(--palette-outline-variant)',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
      }}
    >
      {/* Origin badge — shown for non-local origins */}
      {showOriginBadge && (
        <div
          data-part="origin-badge"
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            padding: '1px 6px',
            borderRadius: 3,
            background: 'var(--palette-secondary-container, #e0e0e0)',
            color: 'var(--palette-on-secondary-container, #333)',
            fontSize: '10px',
            fontWeight: 500,
            lineHeight: '16px',
            zIndex: 1,
            pointerEvents: 'none',
            whiteSpace: 'nowrap' as const,
          }}
        >
          {originInfo!.displayName}
        </div>
      )}

      {/* Source attribution header */}
      <div
        data-part="attribution"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '2px 8px',
          background: 'var(--palette-surface-variant)',
          fontSize: '11px', color: 'var(--palette-on-surface-variant)',
          borderBottom: '1px solid var(--palette-outline-variant)',
        }}
      >
        <span>
          Block from{' '}
          <span style={{ fontFamily: 'var(--typography-font-family-mono)', opacity: 0.8 }}>
            {entityName}
          </span>
          {' '}
          <span style={{ opacity: 0.5 }}>· Block reference</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
          {!readOnly && onMetaChange && (
            <button
              onClick={() => {
                onMetaChange(block.id, 'entityId', undefined);
                onMetaChange(block.id, 'blockId', undefined);
              }}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--palette-on-surface-variant)', fontSize: '11px',
                padding: '0 2px',
              }}
              title="Remove block embed"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Embedded block content — read-only transcluded rendering */}
      <div
        data-part="content"
        style={{
          padding: 'var(--spacing-sm) var(--spacing-md)',
          borderLeft: '3px solid var(--palette-outline-variant)',
          marginLeft: 'var(--spacing-sm)',
          ...blockStyle,
          opacity: 0.85,
          pointerEvents: 'none' as const,
          userSelect: 'none' as const,
        }}
      >
        <div dangerouslySetInnerHTML={{ __html: renderEntityRefs(rawContent) }} />
      </div>
    </div>
  );
};

export default BlockEmbed;
