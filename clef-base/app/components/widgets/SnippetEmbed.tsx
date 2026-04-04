'use client';

/**
 * SnippetEmbed — snippet-embed block type for the BlockEditor.
 *
 * Renders a TextSpan excerpt transcluded from another entity (PRD §8.4).
 * Created via:
 *   - Paste detection: ((entity#span=spanId)) pattern
 *   - Slash command: /snippet
 *
 * Meta shape: { entityId: string, spanId: string }
 *
 * Status indicators:
 *   active  → normal quote-block rendering
 *   stale   → yellow warning badge "Span relocated — text may have shifted"
 *   broken  → red error state "Source text no longer exists"
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigator, useKernelInvoke } from '../../../lib/clef-provider';
import type { Block } from '../../../lib/block-serialization';

// Conditionally import useOrigin — may not exist yet (created by another card)
let useOrigin: ((id: string) => { kind: string; displayName: string }) | undefined;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('../../lib/use-origin');
  useOrigin = mod.useOrigin ?? mod.default;
} catch {
  // useOrigin not available yet — OriginBadge will be skipped
}

// ─── Types ─────────────────────────────────────────────────────────────────

export interface SnippetEmbedMeta {
  entityId: string;
  spanId: string;
}

interface SpanResolveState {
  status: 'loading' | 'active' | 'stale' | 'broken' | 'notfound' | 'unconfigured';
  resolvedText: string;
  entityName: string;
  spanKind: string;
  spanLabel: string;
}

// ─── SnippetEmbed Component ─────────────────────────────────────────────────

export interface SnippetEmbedProps {
  /** Block data — meta.entityId and meta.spanId drive rendering */
  block: Block;
  /** Called to mutate block meta fields (entityId, spanId) */
  onMetaChange: (blockId: string, key: string, value: unknown) => void;
  /** Read-only mode — hides configuration controls */
  readOnly?: boolean;
  /** Optional origin identifier — when present, an OriginBadge is shown for non-local origins */
  origin?: string;
}

/**
 * SnippetEmbed — standalone block-type component for snippet-embed blocks.
 *
 * Registered in the BlockEditor slash menu as /snippet.
 * Converts ((entity#span=id)) paste syntax to this block type.
 */
export const SnippetEmbed: React.FC<SnippetEmbedProps> = ({ block, onMetaChange, readOnly, origin }) => {
  const entityId = block.meta?.entityId as string | undefined;
  const spanId = block.meta?.spanId as string | undefined;
  const { navigateToHref } = useNavigator();
  const invoke = useKernelInvoke();

  const [state, setState] = useState<SpanResolveState>({
    status: 'loading',
    resolvedText: '',
    entityName: entityId ?? '',
    spanKind: '',
    spanLabel: spanId ?? '',
  });

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

  // Re-resolve whenever entityId or spanId change (live update support)
  useEffect(() => {
    if (!entityId || !spanId) {
      setState(prev => ({ ...prev, status: 'unconfigured' }));
      return;
    }

    let cancelled = false;

    async function resolve() {
      if (!entityId || !spanId) return;

      setState(prev => ({ ...prev, status: 'loading' }));

      try {
        // 1. Fetch span metadata (kind, label, status)
        const spanMetaResult = await invoke('TextSpan', 'get', { span: spanId });
        if (cancelled) return;

        const spanKind = (spanMetaResult.kind as string | undefined) ?? '';
        const spanLabel = (spanMetaResult.label as string | undefined) ?? spanId;

        // 2. Fetch source entity content and name
        const entityResult = await invoke('ContentNode', 'get', { node: entityId });
        if (cancelled) return;

        const entityName =
          entityResult.variant === 'ok'
            ? ((entityResult.name as string | undefined) ?? entityId)
            : entityId;
        const currentContent =
          entityResult.variant === 'ok'
            ? ((entityResult.content as string | undefined) ?? '')
            : '';

        if (!currentContent) {
          setState({
            status: 'broken',
            resolvedText: '',
            entityName,
            spanKind,
            spanLabel,
          });
          return;
        }

        // 3. Resolve span fragments against current content
        const resolveResult = await invoke('TextSpan', 'resolve', {
          span: spanId,
          currentContent,
        });
        if (cancelled) return;

        if (resolveResult.variant === 'notfound') {
          setState({ status: 'notfound', resolvedText: '', entityName, spanKind, spanLabel });
          return;
        }

        if (resolveResult.variant === 'broken') {
          setState({ status: 'broken', resolvedText: '', entityName, spanKind, spanLabel });
          return;
        }

        // Fragments may be a JSON string or an array
        let fragments: Array<{ text: string }> = [];
        if (typeof resolveResult.fragments === 'string') {
          try {
            fragments = JSON.parse(resolveResult.fragments) as Array<{ text: string }>;
          } catch {
            fragments = [];
          }
        } else if (Array.isArray(resolveResult.fragments)) {
          fragments = resolveResult.fragments as Array<{ text: string }>;
        }

        const resolvedText = fragments.map(f => f.text).join('');
        const status = resolveResult.variant === 'stale' ? 'stale' : 'active';

        setState({ status, resolvedText, entityName, spanKind, spanLabel });
      } catch {
        if (!cancelled) {
          setState(prev => ({ ...prev, status: 'broken' }));
        }
      }
    }

    void resolve();
    return () => { cancelled = true; };
  }, [entityId, spanId, invoke]);

  // ─── Unconfigured state ─────────────────────────────────────────────────

  if (state.status === 'unconfigured') {
    return (
      <div
        data-part="snippet-embed-root"
        data-state="unconfigured"
        style={{
          padding: 'var(--spacing-sm) var(--spacing-md)',
          background: 'var(--palette-surface-variant)',
          borderRadius: 'var(--radius-sm)',
          border: '1px dashed var(--palette-outline-variant)',
        }}
      >
        <div style={{ fontSize: '12px', color: 'var(--palette-on-surface-variant)', marginBottom: 4 }}>
          Snippet reference
        </div>
        {!readOnly && (
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            <input
              type="text"
              placeholder="Entity ID"
              defaultValue={entityId ?? ''}
              onBlur={e => onMetaChange(block.id, 'entityId', e.target.value)}
              style={{
                flex: 1,
                background: 'var(--palette-surface)',
                border: '1px solid var(--palette-outline-variant)',
                borderRadius: 3,
                padding: '2px 6px',
                fontSize: '11px',
                color: 'var(--palette-on-surface)',
              }}
            />
            <input
              type="text"
              placeholder="Span ID"
              defaultValue={spanId ?? ''}
              onBlur={e => onMetaChange(block.id, 'spanId', e.target.value)}
              style={{
                flex: 1,
                background: 'var(--palette-surface)',
                border: '1px solid var(--palette-outline-variant)',
                borderRadius: 3,
                padding: '2px 6px',
                fontSize: '11px',
                color: 'var(--palette-on-surface)',
              }}
            />
          </div>
        )}
        <div style={{ fontSize: '11px', color: 'var(--palette-on-surface-variant)', marginTop: 6, opacity: 0.7 }}>
          Paste <code style={{ fontFamily: 'var(--typography-font-family-mono)' }}>
            ((entity-id#span=span-id))
          </code> to embed a text span snippet.
        </div>
      </div>
    );
  }

  // ─── Loading state ──────────────────────────────────────────────────────

  if (state.status === 'loading') {
    return (
      <div
        data-part="snippet-embed-root"
        data-state="loading"
        style={{
          padding: 'var(--spacing-sm) var(--spacing-md)',
          background: 'var(--palette-surface-variant)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--palette-outline-variant)',
          fontSize: '12px',
          color: 'var(--palette-on-surface-variant)',
        }}
      >
        Loading snippet...
      </div>
    );
  }

  // ─── Not found state ────────────────────────────────────────────────────

  if (state.status === 'notfound') {
    return (
      <div
        data-part="snippet-embed-root"
        data-state="notfound"
        style={{
          padding: 'var(--spacing-sm) var(--spacing-md)',
          background: '#ef444408',
          border: '1px solid #ef444440',
          borderRadius: 'var(--radius-sm)',
          fontSize: '12px',
          color: '#7f1d1d',
        }}
      >
        <span>Snippet reference not found — span ID does not exist.</span>
      </div>
    );
  }

  const isBroken = state.status === 'broken';
  const isStale = state.status === 'stale';
  const contextHref = `/content/${entityId}#span=${spanId}`;

  // ─── Active / Stale / Broken rendering ──────────────────────────────────

  return (
    <div
      data-part="snippet-embed-root"
      data-state={state.status}
      style={{
        position: 'relative' as const,
        border: `1px solid ${isBroken ? '#ef444440' : 'var(--palette-outline-variant)'}`,
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

      {/* Header — source attribution badge */}
      <div
        data-part="attribution"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 10px',
          background: 'var(--palette-surface-variant)',
          borderBottom: '1px solid var(--palette-outline-variant)',
          fontSize: '11px',
          color: 'var(--palette-on-surface-variant)',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
          <span style={{ opacity: 0.6, flexShrink: 0 }}>Snippet reference</span>
          <span style={{
            fontFamily: 'var(--typography-font-family-mono)',
            fontSize: '10px',
            opacity: 0.8,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {state.entityName}
          </span>
          {state.spanKind && (
            <span style={{
              background: 'var(--palette-primary-container, #e8eaf6)',
              color: 'var(--palette-on-primary-container, #1a237e)',
              padding: '0 5px',
              borderRadius: 3,
              fontSize: '10px',
              fontWeight: 500,
              flexShrink: 0,
            }}>
              {state.spanKind}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          {/* View in context link */}
          <button
            data-part="view-in-context"
            onClick={() => navigateToHref(contextHref)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--palette-primary)',
              fontSize: '11px',
              padding: '0 4px',
              textDecoration: 'underline',
            }}
            title={`View in context: ${contextHref}`}
          >
            View in context
          </button>

          {/* Remove button — only in edit mode */}
          {!readOnly && (
            <button
              data-part="remove"
              onClick={() => {
                onMetaChange(block.id, 'entityId', undefined);
                onMetaChange(block.id, 'spanId', undefined);
              }}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--palette-on-surface-variant)',
                fontSize: '11px',
                padding: '0 2px',
                opacity: 0.6,
              }}
              title="Remove snippet"
              aria-label="Remove snippet embed"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Stale warning badge — anchor was relocated */}
      {isStale && (
        <div
          data-part="status-banner"
          data-status="stale"
          style={{
            padding: '4px 10px',
            background: '#fef9c3',
            borderBottom: '1px solid #fde047',
            fontSize: '11px',
            color: '#713f12',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
          role="status"
          aria-label="Stale span warning"
        >
          <span aria-hidden="true">⚠</span>
          <span>Span relocated — text may have shifted</span>
        </div>
      )}

      {/* Broken error state — anchor orphaned */}
      {isBroken && (
        <div
          data-part="status-banner"
          data-status="broken"
          style={{
            padding: '4px 10px',
            background: '#fef2f2',
            borderBottom: '1px solid #fca5a5',
            fontSize: '11px',
            color: '#7f1d1d',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
          role="alert"
          aria-label="Broken span error"
        >
          <span aria-hidden="true">✕</span>
          <span>Source text no longer exists</span>
        </div>
      )}

      {/* Resolved snippet body — styled quote block with subtle background */}
      <div
        data-part="snippet-body"
        style={{
          padding: 'var(--spacing-sm) var(--spacing-md)',
          background: 'var(--palette-surface-variant, #f5f5f5)',
          borderLeft: `3px solid ${
            isBroken
              ? '#ef4444'
              : isStale
              ? '#f59e0b'
              : 'var(--palette-primary)'
          }`,
          fontSize: 'var(--typography-body-md-size, 0.9375rem)',
          lineHeight: 'var(--typography-body-md-line-height, 1.6)',
          color: isBroken
            ? 'var(--palette-on-surface-variant)'
            : 'var(--palette-on-surface)',
          fontStyle: isBroken ? 'italic' : 'normal',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      >
        {isBroken ? (
          <em style={{ opacity: 0.6 }}>Span text unavailable</em>
        ) : state.resolvedText ? (
          <span>{state.resolvedText}</span>
        ) : (
          <span style={{ opacity: 0.5, fontSize: '12px' }}>Loading snippet text...</span>
        )}
      </div>
    </div>
  );
};

export default SnippetEmbed;
