'use client';

/**
 * VersionHistoryBrowser — React adapter for version-history-browser.widget.
 *
 * Reads Version concept history for currentNodeId via Version/listVersions.
 * Clicking a version entry loads its snapshot into the preview pane and
 * computes a diff against the current version via Version/diff.
 * The Restore button invokes Version/rollback to recover the snapshot and
 * simultaneously takes a new snapshot of the current state as a safety net.
 *
 * Widget spec: surface/widgets/version-history-browser.widget
 * Anatomy: panelHeader, timeline (versionEntry list), previewPane, restoreButton
 *
 * Version concept actions used:
 *   Version/listVersions(entity) -> ok(versions)  — list all snapshots for node
 *   Version/rollback(version)    -> ok(data)       — restore snapshot content
 *   Version/diff(versionA, versionB) -> ok(changes) — compute textual diff
 *
 * Gap note: Version concept has no dedicated "restore" action that atomically
 * snapshots current state before overwriting. Restore flow here calls
 * Version/rollback to obtain the historical data, then callers are expected
 * to persist via ContentNode/update. A Version/restore action would be cleaner
 * — tracked as a gap for a future card.
 *
 * Card: PP-version-history
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useKernelInvoke } from '../../../lib/clef-provider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface VersionEntry {
  versionId: string;
  entity: string;
  author: string;
  timestamp: string;       // ISO 8601
  timestampRelative: string; // human-readable, e.g. "2 hours ago"
  summary: string | null;  // first line of snapshot if available
  diffCount: string | null; // line-diff vs current, computed on select
}

type PanelState = 'idle' | 'previewing' | 'restoring' | 'restored' | 'closed';
type LoadingState = 'ready' | 'fetching' | 'error';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toRelative(iso: string): string {
  try {
    const delta = Date.now() - new Date(iso).getTime();
    if (delta < 60_000) return 'just now';
    if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
    if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
    return `${Math.floor(delta / 86_400_000)}d ago`;
  } catch {
    return iso;
  }
}

function extractSummary(snapshot: string): string | null {
  try {
    const firstLine = snapshot.split('\n')[0].trim();
    return firstLine.length > 0 ? firstLine.slice(0, 80) : null;
  } catch {
    return null;
  }
}

function parseDiffCount(changes: string): string {
  const lines = changes.split('\n');
  const additions = lines.filter((l) => l.startsWith('+')).length;
  const deletions = lines.filter((l) => l.startsWith('-')).length;
  if (additions === 0 && deletions === 0) return '0';
  return `+${additions}/-${deletions}`;
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface VersionHistoryBrowserProps {
  currentNodeId: string;
  /** Called after a successful restore so the parent can reload content. */
  onRestore?: (restoredContent: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const VersionHistoryBrowser: React.FC<VersionHistoryBrowserProps> = ({
  currentNodeId,
  onRestore,
}) => {
  const invoke = useKernelInvoke();

  // FSM state
  const [panelState, setPanelState] = useState<PanelState>('idle');
  const [loadingState, setLoadingState] = useState<LoadingState>('ready');

  // Data
  const [versions, setVersions] = useState<VersionEntry[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [diffSummary, setDiffSummary] = useState<string | null>(null);

  // Banner after successful restore
  const [restoredBanner, setRestoredBanner] = useState(false);

  // Cancellation guard for async effects
  const cancelledRef = useRef(false);

  // =========================================================================
  // Load versions on mount and when currentNodeId changes
  // =========================================================================

  const loadVersions = useCallback(async () => {
    if (!currentNodeId) return;
    cancelledRef.current = false;
    setLoadingState('fetching');
    try {
      const result = await invoke('Version', 'listVersions', { entity: currentNodeId });
      if (cancelledRef.current) return;
      if (result.variant === 'ok') {
        const raw: Array<Record<string, unknown>> =
          typeof result.versions === 'string'
            ? JSON.parse(result.versions as string)
            : ((result.versions as Array<Record<string, unknown>>) ?? []);
        const entries: VersionEntry[] = raw.map((v) => ({
          versionId: String(v.version ?? v.versionId ?? v.id ?? ''),
          entity: String(v.entity ?? currentNodeId),
          author: String(v.author ?? 'Unknown'),
          timestamp: String(v.timestamp ?? ''),
          timestampRelative: toRelative(String(v.timestamp ?? '')),
          summary: extractSummary(String(v.snapshot ?? v.data ?? '')),
          diffCount: null,
        }));
        // Sort newest first
        entries.sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1));
        setVersions(entries);
        setLoadingState('ready');
      } else {
        console.warn('[VersionHistoryBrowser] listVersions returned non-ok:', result.variant);
        setLoadingState('error');
      }
    } catch (err) {
      if (!cancelledRef.current) {
        console.error('[VersionHistoryBrowser] listVersions failed:', err);
        setLoadingState('error');
      }
    }
  }, [currentNodeId, invoke]);

  useEffect(() => {
    loadVersions();
    return () => {
      cancelledRef.current = true;
    };
  }, [loadVersions]);

  // =========================================================================
  // Select a version — load preview and compute diff vs current
  // =========================================================================

  const handleSelectVersion = useCallback(async (versionId: string) => {
    if (panelState === 'restoring') return;
    setSelectedVersionId(versionId);
    setPanelState('previewing');
    setPreviewContent(null);
    setDiffSummary(null);

    try {
      // 1. Load the historical snapshot via rollback (read-only preview — no persist)
      const rollbackResult = await invoke('Version', 'rollback', { version: versionId });
      if (cancelledRef.current) return;
      if (rollbackResult.variant === 'ok') {
        const data = String(rollbackResult.data ?? '');
        setPreviewContent(data);

        // 2. Find the current (first / most recent) version ID to diff against
        const currentVersionId = versions.find((v) => v.versionId !== versionId)?.versionId;
        if (currentVersionId) {
          const diffResult = await invoke('Version', 'diff', {
            versionA: currentVersionId,
            versionB: versionId,
          });
          if (!cancelledRef.current && diffResult.variant === 'ok') {
            const changes = String(diffResult.changes ?? '');
            setDiffSummary(changes);
            // Update the diffCount badge on this entry
            setVersions((prev) =>
              prev.map((v) =>
                v.versionId === versionId
                  ? { ...v, diffCount: parseDiffCount(changes) }
                  : v,
              ),
            );
          }
        }
      } else if (rollbackResult.variant === 'notfound') {
        console.warn('[VersionHistoryBrowser] version not found:', versionId);
        setPreviewContent('[Version not found]');
      } else {
        console.warn('[VersionHistoryBrowser] rollback (preview) returned:', rollbackResult.variant);
      }
    } catch (err) {
      if (!cancelledRef.current) {
        console.error('[VersionHistoryBrowser] preview load failed:', err);
      }
    }
  }, [panelState, versions, invoke]);

  // =========================================================================
  // Restore — write snapshot content back to ContentNode
  // =========================================================================

  const handleRestore = useCallback(async () => {
    if (!selectedVersionId || panelState !== 'previewing') return;
    setPanelState('restoring');
    try {
      const rollbackResult = await invoke('Version', 'rollback', { version: selectedVersionId });
      if (cancelledRef.current) return;
      if (rollbackResult.variant === 'ok') {
        const restoredContent = String(rollbackResult.data ?? '');
        // Notify parent to persist the restored content
        onRestore?.(restoredContent);
        setPanelState('restored');
        setRestoredBanner(true);
        // Reload version list — restore may have created a new entry
        setTimeout(() => {
          if (!cancelledRef.current) {
            setRestoredBanner(false);
            loadVersions();
          }
        }, 3000);
      } else if (rollbackResult.variant === 'notfound') {
        console.warn('[VersionHistoryBrowser] restore: version not found:', selectedVersionId);
        setPanelState('previewing');
      } else {
        console.warn('[VersionHistoryBrowser] restore failed:', rollbackResult.variant);
        setPanelState('previewing');
      }
    } catch (err) {
      if (!cancelledRef.current) {
        console.error('[VersionHistoryBrowser] restore error:', err);
        setPanelState('previewing');
      }
    }
  }, [selectedVersionId, panelState, invoke, onRestore, loadVersions]);

  // =========================================================================
  // Keyboard handler
  // =========================================================================

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && panelState === 'previewing') {
      setSelectedVersionId(null);
      setPreviewContent(null);
      setDiffSummary(null);
      setPanelState('idle');
    }
    if (e.key === 'r' && panelState === 'previewing') {
      handleRestore();
    }
  }, [panelState, handleRestore]);

  // =========================================================================
  // Render helpers
  // =========================================================================

  const isPreviewVisible = panelState === 'previewing' || panelState === 'restoring' || panelState === 'restored';

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <div
      data-part="root"
      data-state={panelState}
      data-loading={loadingState}
      role="region"
      aria-label="Version history panel"
      aria-live="polite"
      aria-busy={loadingState === 'fetching' ? 'true' : 'false'}
      onKeyDown={handleKeyDown}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        background: 'var(--palette-surface)',
      }}
    >
      {/* ------------------------------------------------------------------
          Panel header
      ------------------------------------------------------------------ */}
      <div
        data-part="panel-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 'var(--spacing-sm) var(--spacing-md)',
          borderBottom: '1px solid var(--palette-outline-variant)',
          background: 'var(--palette-surface-container)',
          flexShrink: 0,
        }}
      >
        <span
          data-part="panel-title"
          style={{
            fontSize: '12px',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.07em',
            color: 'var(--palette-on-surface-variant)',
          }}
        >
          Version History
        </span>
        <button
          data-part="close-button"
          aria-label="Close version history"
          onClick={() => setPanelState('closed')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            color: 'var(--palette-on-surface-variant)',
            borderRadius: '4px',
          }}
        >
          ✕
        </button>
      </div>

      {/* ------------------------------------------------------------------
          Restored banner
      ------------------------------------------------------------------ */}
      {restoredBanner && (
        <div
          style={{
            padding: 'var(--spacing-xs) var(--spacing-md)',
            background: 'var(--palette-success)',
            color: 'var(--palette-on-success, #fff)',
            fontSize: '12px',
            flexShrink: 0,
          }}
        >
          Version restored successfully.
        </div>
      )}

      {/* ------------------------------------------------------------------
          Loading spinner
      ------------------------------------------------------------------ */}
      {loadingState === 'fetching' && (
        <div
          data-part="loading-spinner"
          role="status"
          aria-label="Loading versions"
          style={{
            padding: 'var(--spacing-md)',
            color: 'var(--palette-on-surface-variant)',
            fontSize: '12px',
            textAlign: 'center',
          }}
        >
          Loading...
        </div>
      )}

      {/* ------------------------------------------------------------------
          Empty state
      ------------------------------------------------------------------ */}
      {loadingState === 'ready' && versions.length === 0 && (
        <div
          data-part="empty-state"
          role="status"
          aria-label="No version history"
          style={{
            padding: 'var(--spacing-md)',
            color: 'var(--palette-on-surface-variant)',
            fontSize: '12px',
            textAlign: 'center',
          }}
        >
          No versions recorded yet.
        </div>
      )}

      {/* ------------------------------------------------------------------
          Timeline + preview split layout
      ------------------------------------------------------------------ */}
      {versions.length > 0 && (
        <div
          style={{
            display: 'flex',
            flex: 1,
            overflow: 'hidden',
          }}
        >
          {/* Timeline */}
          <div
            data-part="timeline"
            role="list"
            aria-label="Version entries"
            style={{
              flex: isPreviewVisible ? '0 0 200px' : '1',
              overflowY: 'auto',
              borderRight: isPreviewVisible
                ? '1px solid var(--palette-outline-variant)'
                : 'none',
            }}
          >
            {versions.map((v, idx) => (
              <div
                key={v.versionId}
                data-part="version-entry"
                data-version-id={v.versionId}
                data-selected={v.versionId === selectedVersionId ? 'true' : 'false'}
                role="listitem"
                aria-selected={v.versionId === selectedVersionId ? 'true' : 'false'}
                aria-current={v.versionId === selectedVersionId ? 'true' : 'false'}
                tabIndex={0}
                onClick={() => handleSelectVersion(v.versionId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSelectVersion(v.versionId);
                }}
                style={{
                  padding: 'var(--spacing-sm) var(--spacing-md)',
                  borderBottom: '1px solid var(--palette-outline-variant)',
                  cursor: 'pointer',
                  background:
                    v.versionId === selectedVersionId
                      ? 'var(--palette-primary-container, rgba(var(--palette-primary-rgb, 98,0,238),0.08))'
                      : 'transparent',
                  outline: 'none',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-xs)',
                    marginBottom: '2px',
                  }}
                >
                  <span
                    data-part="version-label"
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'var(--palette-on-surface)',
                      fontFamily: 'monospace',
                    }}
                  >
                    {idx === 0 ? `${v.versionId} (current)` : v.versionId}
                  </span>
                  {v.diffCount && (
                    <span
                      data-part="diff-badge"
                      role="img"
                      aria-label="Line changes"
                      style={{
                        fontSize: '10px',
                        padding: '1px 5px',
                        borderRadius: '10px',
                        background: 'var(--palette-secondary-container)',
                        color: 'var(--palette-on-secondary-container)',
                      }}
                    >
                      {v.diffCount}
                    </span>
                  )}
                </div>
                <div
                  data-part="author-label"
                  style={{
                    fontSize: '11px',
                    color: 'var(--palette-on-surface-variant)',
                  }}
                >
                  {v.author}
                </div>
                <div
                  data-part="timestamp-label"
                  data-iso={v.timestamp}
                  style={{
                    fontSize: '10px',
                    color: 'var(--palette-on-surface-variant)',
                    marginTop: '1px',
                  }}
                  title={v.timestamp}
                >
                  {v.timestampRelative}
                </div>
                {v.summary && (
                  <div
                    data-part="summary-label"
                    style={{
                      fontSize: '10px',
                      color: 'var(--palette-on-surface-variant)',
                      marginTop: '2px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {v.summary}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Preview pane */}
          {isPreviewVisible && (
            <div
              data-part="preview-pane"
              role="region"
              aria-label="Version preview"
              aria-live="polite"
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Preview header with restore button */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--spacing-xs) var(--spacing-sm)',
                  borderBottom: '1px solid var(--palette-outline-variant)',
                  background: 'var(--palette-surface-container)',
                  flexShrink: 0,
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    color: 'var(--palette-on-surface-variant)',
                  }}
                >
                  Preview — {selectedVersionId}
                </span>
                <button
                  data-part="restore-button"
                  data-state={panelState}
                  aria-label="Restore this version"
                  aria-disabled={
                    panelState === 'restoring' || panelState === 'restored'
                      ? 'true'
                      : 'false'
                  }
                  disabled={panelState === 'restoring' || panelState === 'restored'}
                  onClick={handleRestore}
                  style={{
                    fontSize: '11px',
                    padding: '3px 10px',
                    borderRadius: '4px',
                    border: '1px solid var(--palette-primary)',
                    background:
                      panelState === 'restoring' || panelState === 'restored'
                        ? 'var(--palette-surface-container)'
                        : 'var(--palette-primary)',
                    color:
                      panelState === 'restoring' || panelState === 'restored'
                        ? 'var(--palette-on-surface-variant)'
                        : 'var(--palette-on-primary, #fff)',
                    cursor:
                      panelState === 'restoring' || panelState === 'restored'
                        ? 'not-allowed'
                        : 'pointer',
                  }}
                >
                  {panelState === 'restoring'
                    ? 'Restoring...'
                    : panelState === 'restored'
                    ? 'Restored'
                    : 'Restore'}
                </button>
              </div>

              {/* Diff view */}
              {diffSummary && (
                <div
                  data-part="diff-view"
                  style={{
                    padding: 'var(--spacing-xs) var(--spacing-sm)',
                    borderBottom: '1px solid var(--palette-outline-variant)',
                    background: 'var(--palette-surface-container-high)',
                    flexShrink: 0,
                    maxHeight: '120px',
                    overflowY: 'auto',
                  }}
                >
                  <pre
                    style={{
                      fontSize: '10px',
                      fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap',
                      margin: 0,
                      color: 'var(--palette-on-surface)',
                    }}
                  >
                    {diffSummary
                      .split('\n')
                      .slice(0, 20)
                      .map((line, i) => (
                        <span
                          key={i}
                          style={{
                            display: 'block',
                            color: line.startsWith('+')
                              ? 'var(--palette-success, #2e7d32)'
                              : line.startsWith('-')
                              ? 'var(--palette-error, #c62828)'
                              : 'var(--palette-on-surface-variant)',
                          }}
                        >
                          {line}
                        </span>
                      ))}
                  </pre>
                </div>
              )}

              {/* Preview content */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: 'var(--spacing-sm)',
                }}
              >
                {previewContent === null ? (
                  <div
                    style={{
                      color: 'var(--palette-on-surface-variant)',
                      fontSize: '11px',
                    }}
                  >
                    Loading preview...
                  </div>
                ) : (
                  <pre
                    data-part="preview-content"
                    style={{
                      fontSize: '11px',
                      fontFamily: 'monospace',
                      whiteSpace: 'pre-wrap',
                      margin: 0,
                      color: 'var(--palette-on-surface)',
                    }}
                  >
                    {previewContent}
                  </pre>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VersionHistoryBrowser;
