'use client';

/**
 * UserSyncEditorView — route-level view that loads a sync definition by ID
 * and mounts the UserSyncEditor widget. Handles both the create ("new") and
 * edit flows.
 *
 * Mounted at:
 *   /admin/automation/user-syncs/new          — create flow
 *   /admin/automation/user-syncs/:id           — edit flow
 *
 * Also renders the read-only AutomationScopeBrowser below the editor so
 * authors can see which action references are allowed before validating.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useKernelInvoke, useNavigator } from '../../lib/clef-provider';
import { UserSyncEditor } from '../components/widgets/UserSyncEditor';
import { AutomationScopeBrowser } from '../components/widgets/AutomationScopeBrowser';
import { Card } from '../components/widgets/Card';

interface UserSyncRecord {
  id: string;
  name: string;
  source_text: string;
  status: string;
  author: string;
}

interface UserSyncEditorViewProps {
  /** Route param: sync definition ID, or "new" for create flow */
  syncId: string;
}

export const UserSyncEditorView: React.FC<UserSyncEditorViewProps> = ({ syncId }) => {
  const invoke = useKernelInvoke();
  const { navigateToHref } = useNavigator();

  const isNew = syncId === 'new';

  const [record, setRecord] = useState<UserSyncRecord | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Load existing sync definition
  // ---------------------------------------------------------------------------

  const loadRecord = useCallback(async () => {
    if (isNew) return;
    setLoading(true);
    setLoadError(null);
    try {
      // Load via ContentNode — sync definitions are content-native
      const result = await invoke('ContentNode', 'get', { node: syncId });
      if (result.variant === 'ok' && result.node) {
        const node = result.node as Record<string, unknown>;
        setRecord({
          id: String(node.id ?? syncId),
          name: String(node.name ?? ''),
          source_text: String(node.source_text ?? node.sourceText ?? ''),
          status: String(node.status ?? 'draft'),
          author: String(node.author ?? ''),
        });
      } else {
        setLoadError(`Sync definition "${syncId}" not found.`);
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load sync definition.');
    } finally {
      setLoading(false);
    }
  }, [isNew, syncId, invoke]);

  useEffect(() => {
    loadRecord();
  }, [loadRecord]);

  // ---------------------------------------------------------------------------
  // Callbacks
  // ---------------------------------------------------------------------------

  const handleSaved = useCallback(
    (newId: string) => {
      if (isNew && newId !== syncId) {
        // Redirect to the persistent edit URL after first save
        navigateToHref(`/admin/automation/user-syncs/${encodeURIComponent(newId)}`);
      }
    },
    [isNew, syncId, navigateToHref],
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg, 24px)' }}>
      {/* Breadcrumb / back link */}
      <div>
        <button
          type="button"
          onClick={() => navigateToHref('/admin/automation/user-syncs')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--palette-primary)',
            fontSize: 'var(--typography-body-sm-size, 0.875rem)',
            padding: 0,
          }}
        >
          ← Back to User Syncs
        </button>
      </div>

      {/* Loading state */}
      {loading && (
        <Card variant="outlined">
          <div style={{ color: 'var(--palette-on-surface-variant)', padding: 'var(--spacing-lg)' }}>
            Loading sync definition…
          </div>
        </Card>
      )}

      {/* Load error */}
      {!loading && loadError && (
        <Card variant="outlined">
          <div
            role="alert"
            style={{
              color: 'var(--palette-error)',
              padding: 'var(--spacing-lg)',
            }}
          >
            {loadError}
          </div>
        </Card>
      )}

      {/* Editor — create flow */}
      {!loading && !loadError && isNew && (
        <UserSyncEditor
          onSaved={handleSaved}
        />
      )}

      {/* Editor — edit flow */}
      {!loading && !loadError && !isNew && record && (
        <UserSyncEditor
          syncId={record.id}
          initialName={record.name}
          initialSource={record.source_text}
          initialStatus={record.status}
          initialAuthor={record.author}
          onSaved={handleSaved}
        />
      )}

      {/* AutomationScopeBrowser — read-only reference panel */}
      <div>
        <h2 style={{
          fontSize: 'var(--typography-body-size, 0.9375rem)',
          fontWeight: 600,
          margin: '0 0 var(--spacing-sm, 8px)',
        }}>
          Active Automation Scope
        </h2>
        <p style={{
          color: 'var(--palette-on-surface-variant)',
          margin: '0 0 var(--spacing-md, 16px)',
          fontSize: 'var(--typography-body-sm-size, 0.875rem)',
        }}>
          The actions listed below are allowed (or denied) in user-authored syncs.
          The full scope admin editor is available separately (MAG-704).
        </p>
        <Card variant="outlined" padding="none">
          <AutomationScopeBrowser />
        </Card>
      </div>
    </div>
  );
};

export default UserSyncEditorView;
