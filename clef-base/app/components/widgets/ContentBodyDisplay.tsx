'use client';

/**
 * ContentBodyDisplay — block/outline editor display type for the unstructured zone.
 *
 * Renders content as an editable document area. For JSON content, displays
 * parsed fields as editable outline blocks. For text content, shows as
 * editable paragraphs. Eventually this becomes a full outliner/block editor.
 *
 * Each block is rendered as an outline node that can be expanded/collapsed,
 * linked, and edited inline.
 */

import React, { useState, useCallback } from 'react';
import type { FieldConfig } from './TableDisplay';
import { InlineEdit } from './InlineEdit';

interface ContentBodyDisplayProps {
  data: Record<string, unknown>[];
  fields: FieldConfig[];
  onRowClick?: (row: Record<string, unknown>) => void;
  onFieldSave?: (field: string, value: unknown) => Promise<void>;
}

interface OutlineBlock {
  key: string;
  value: unknown;
  depth: number;
  type: 'field' | 'text' | 'json' | 'link';
}

function parseContentToBlocks(content: unknown): OutlineBlock[] {
  if (content === null || content === undefined) {
    return [{ key: '__empty', value: 'No content', depth: 0, type: 'text' }];
  }

  const str = typeof content === 'string' ? content : JSON.stringify(content);

  // Try JSON parse
  try {
    const parsed = JSON.parse(str);
    if (typeof parsed === 'object' && parsed !== null) {
      return Object.entries(parsed).map(([key, value]) => ({
        key,
        value,
        depth: 0,
        type: typeof value === 'object' ? 'json' as const : 'field' as const,
      }));
    }
  } catch {
    // Plain text — split into paragraphs
  }

  // Plain text blocks
  const paragraphs = str.split(/\n\n+/).filter(Boolean);
  if (paragraphs.length === 0) {
    return [{ key: '__empty', value: 'No content', depth: 0, type: 'text' }];
  }
  return paragraphs.map((p, i) => ({
    key: `p-${i}`,
    value: p,
    depth: 0,
    type: 'text' as const,
  }));
}

export const ContentBodyDisplay: React.FC<ContentBodyDisplayProps> = ({ data, onFieldSave }) => {
  const entity = data[0];
  if (!entity) return null;

  const content = entity.content;
  const blocks = parseContentToBlocks(content);
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set(blocks.map(b => b.key)));

  const toggleBlock = useCallback((key: string) => {
    setExpandedBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleBlockSave = useCallback(async (key: string, newValue: unknown) => {
    if (!onFieldSave) return;
    // Reconstruct content with updated block
    const str = typeof content === 'string' ? content : JSON.stringify(content);
    try {
      const parsed = JSON.parse(str);
      if (typeof parsed === 'object' && parsed !== null) {
        parsed[key] = newValue;
        await onFieldSave('content', JSON.stringify(parsed));
        return;
      }
    } catch {
      // Plain text — just save the new value as content
    }
    await onFieldSave('content', String(newValue));
  }, [content, onFieldSave]);

  return (
    <div style={{
      background: 'var(--palette-surface)',
      border: '1px solid var(--palette-outline-variant)',
      borderRadius: 'var(--radius-md)',
      overflow: 'hidden',
    }}>
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
          {blocks.length} block{blocks.length !== 1 ? 's' : ''}
        </span>
        <span style={{ opacity: 0.5 }}>|</span>
        <button
          data-part="filter-toggle"
          onClick={() => setExpandedBlocks(
            expandedBlocks.size === blocks.length ? new Set() : new Set(blocks.map(b => b.key))
          )}
          style={{
            padding: '1px 6px', fontSize: '10px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--palette-outline-variant)',
            background: 'var(--palette-surface)', color: 'var(--palette-on-surface-variant)',
            cursor: 'pointer', fontFamily: 'var(--typography-font-family-mono)',
          }}
        >
          {expandedBlocks.size === blocks.length ? 'Collapse all' : 'Expand all'}
        </button>
      </div>

      {/* Outline blocks */}
      <div style={{ padding: 'var(--spacing-sm)' }}>
        {blocks.map((block) => {
          const isExpanded = expandedBlocks.has(block.key);
          const isEmptyPlaceholder = block.key === '__empty';

          return (
            <div
              key={block.key}
              style={{
                marginLeft: block.depth * 20,
                marginBottom: 2,
                borderRadius: 'var(--radius-sm)',
              }}
            >
              {/* Block header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--spacing-xs)',
                  padding: 'var(--spacing-xs) var(--spacing-sm)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: isEmptyPlaceholder ? 'default' : 'pointer',
                }}
                onClick={() => !isEmptyPlaceholder && toggleBlock(block.key)}
              >
                {/* Bullet / expand toggle */}
                {!isEmptyPlaceholder && (
                  <span style={{
                    fontSize: 10,
                    color: 'var(--palette-on-surface-variant)',
                    width: 16,
                    textAlign: 'center',
                    flexShrink: 0,
                    marginTop: 3,
                    fontFamily: 'var(--typography-font-family-mono)',
                  }}>
                    {block.type === 'json' ? (isExpanded ? '\u25BE' : '\u25B8') : '\u2022'}
                  </span>
                )}

                {/* Block content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {block.type === 'field' || block.type === 'text' ? (
                    <div style={{
                      display: 'flex',
                      gap: 'var(--spacing-sm)',
                      alignItems: 'baseline',
                    }}>
                      {block.key !== '__empty' && block.type === 'field' && (
                        <span style={{
                          fontWeight: 'var(--typography-label-md-weight)',
                          color: 'var(--palette-on-surface-variant)',
                          fontSize: 'var(--typography-label-sm-size)',
                          fontFamily: 'var(--typography-font-family-mono)',
                          flexShrink: 0,
                        }}>
                          {block.key}:
                        </span>
                      )}
                      <span style={{
                        color: isEmptyPlaceholder ? 'var(--palette-on-surface-variant)' : 'var(--palette-on-surface)',
                        fontSize: 'var(--typography-body-md-size)',
                        opacity: isEmptyPlaceholder ? 0.5 : 1,
                        wordBreak: 'break-word',
                      }}>
                        {onFieldSave && !isEmptyPlaceholder ? (
                          <InlineEdit
                            value={block.value}
                            onSave={(v) => handleBlockSave(block.key, v)}
                          />
                        ) : (
                          String(block.value ?? '')
                        )}
                      </span>
                    </div>
                  ) : block.type === 'json' ? (
                    <div>
                      <span style={{
                        fontWeight: 'var(--typography-label-md-weight)',
                        color: 'var(--palette-primary)',
                        fontSize: 'var(--typography-label-sm-size)',
                        fontFamily: 'var(--typography-font-family-mono)',
                      }}>
                        {block.key}
                      </span>
                      {isExpanded && (
                        <pre style={{
                          fontFamily: 'var(--typography-font-family-mono)',
                          fontSize: 'var(--typography-code-sm-size)',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          margin: '4px 0 0 0',
                          padding: 'var(--spacing-sm)',
                          background: 'var(--palette-surface-variant)',
                          borderRadius: 'var(--radius-sm)',
                          maxHeight: 300,
                          overflow: 'auto',
                        }}>
                          {JSON.stringify(block.value, null, 2)}
                        </pre>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ContentBodyDisplay;
