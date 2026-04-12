'use client';

/**
 * UserSyncListView — ViewShell-backed list of user-authored syncs grouped
 * by lifecycle status (Draft / Validated / Active / Suspended).
 *
 * Quick-activate and suspend row actions use ActionButton with the seeds:
 *   user-sync-activate, user-sync-suspend
 *
 * Filter bar: author text search + status toggle group.
 *
 * Navigates to /admin/automation/user-syncs/:id on row click.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useKernelInvoke } from '../../lib/clef-provider';
import { useNavigator } from '../../lib/clef-provider';
import { Card } from '../components/widgets/Card';
import { Badge } from '../components/widgets/Badge';
import { DataTable, type ColumnDef } from '../components/widgets/DataTable';
import { EmptyState } from '../components/widgets/EmptyState';
import { ActionButtonCompact } from '../components/widgets/ActionButton';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UserSyncRow extends Record<string, unknown> {
  id: string;
  name: string;
  author: string;
  status: string;
  source_text?: string;
}

type StatusFilter = 'all' | 'draft' | 'validated' | 'active' | 'suspended';

const STATUS_GROUPS: StatusFilter[] = ['all', 'draft', 'validated', 'active', 'suspended'];

function statusBadgeVariant(
  status: string,
): 'default' | 'success' | 'warning' | 'error' | 'info' {
  switch (status?.toLowerCase()) {
    case 'active':     return 'success';
    case 'validated':  return 'info';
    case 'suspended':  return 'warning';
    case 'draft':      return 'default';
    default:           return 'default';
  }
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

function buildColumns(onRefresh: () => void): ColumnDef[] {
  return [
    {
      key: 'name',
      label: 'Name',
      render: (val) => (
        <code style={{ fontFamily: 'var(--typography-mono-family, monospace)', fontWeight: 600 }}>
          {String(val)}
        </code>
      ),
    },
    {
      key: 'author',
      label: 'Author',
      render: (val) => (
        <span style={{ color: 'var(--palette-on-surface-variant)' }}>{String(val ?? '—')}</span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => (
        <Badge variant={statusBadgeVariant(String(val))}>{String(val ?? 'draft')}</Badge>
      ),
    },
    {
      key: '_actions',
      label: '',
      render: (_val, row) => {
        const status = String(row.status ?? '').toLowerCase();
        return (
          <div style={{ display: 'flex', gap: 'var(--spacing-xs, 4px)', justifyContent: 'flex-end' }}>
            {status === 'validated' && (
              <ActionButtonCompact
                binding="user-sync-activate"
                context={{ syncId: row.id }}
                label="Activate"
                icon="▶"
                buttonVariant="primary"
                onSuccess={onRefresh}
              />
            )}
            {status === 'active' && (
              <ActionButtonCompact
                binding="user-sync-suspend"
                context={{ syncId: row.id }}
                label="Suspend"
                icon="⏸"
                buttonVariant="destructive"
                onSuccess={onRefresh}
              />
            )}
          </div>
        );
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// UserSyncListView
// ---------------------------------------------------------------------------

export const UserSyncListView: React.FC = () => {
  const invoke = useKernelInvoke();
  const { navigateToHref } = useNavigator();

  const [rows, setRows] = useState<UserSyncRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorFilter, setAuthorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------

  const loadRows = useCallback(async () => {
    setLoading(true);
    try {
      // SyncAutomationProvider does not expose a dedicated list action in the
      // current spec — we query via ContentNode listBySchema so the view is
      // content-native.  If the kernel returns nothing we fall back to empty.
      const result = await invoke('ContentNode', 'listBySchema', { schema: 'UserSync' });
      if (result.variant === 'ok' && Array.isArray(result.items)) {
        setRows(result.items as UserSyncRow[]);
      } else {
        setRows([]);
      }
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [invoke]);

  useEffect(() => {
    loadRows();
  }, [loadRows]);

  // ---------------------------------------------------------------------------
  // Filtering
  // ---------------------------------------------------------------------------

  const filteredRows = rows.filter((r) => {
    const matchesAuthor =
      authorFilter.trim() === '' ||
      String(r.author ?? '').toLowerCase().includes(authorFilter.toLowerCase());
    const matchesStatus =
      statusFilter === 'all' ||
      String(r.status ?? '').toLowerCase() === statusFilter;
    return matchesAuthor && matchesStatus;
  });

  // Group by status for sectioned display
  const groupOrder: StatusFilter[] = ['active', 'validated', 'draft', 'suspended'];
  const grouped: Record<string, UserSyncRow[]> = {};
  for (const key of groupOrder) {
    grouped[key] = filteredRows.filter(
      (r) => String(r.status ?? '').toLowerCase() === key,
    );
  }

  const columns = buildColumns(loadRows);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg, 24px)' }}>
      {/* Page header */}
      <div
        className="page-header"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
      >
        <h1 style={{ margin: 0 }}>User Syncs</h1>
        <button
          data-part="button"
          data-variant="filled"
          onClick={() => navigateToHref('/admin/automation/user-syncs/new')}
          style={{ cursor: 'pointer' }}
        >
          New Sync
        </button>
      </div>

      <p style={{ color: 'var(--palette-on-surface-variant)', margin: 0 }}>
        User-authored sync rules that extend the automation layer. Syncs pass
        through validate and activate lifecycle steps — scope violations are
        surfaced before activation.
      </p>

      {/* Filter bar */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--spacing-md, 16px)',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        {/* Author filter */}
        <input
          type="text"
          placeholder="Filter by author…"
          value={authorFilter}
          aria-label="Filter by author"
          onChange={(e) => setAuthorFilter(e.target.value)}
          style={{
            padding: 'var(--spacing-xs, 6px) var(--spacing-sm, 10px)',
            borderRadius: 'var(--radius-md, 6px)',
            border: '1px solid var(--palette-outline)',
            fontSize: 'var(--typography-body-sm-size, 0.875rem)',
            minWidth: '180px',
          }}
        />

        {/* Status toggle group */}
        <div
          role="group"
          aria-label="Filter by status"
          style={{ display: 'flex', gap: 'var(--spacing-xs, 4px)' }}
        >
          {STATUS_GROUPS.map((s) => (
            <button
              key={s}
              type="button"
              data-active={statusFilter === s ? 'true' : 'false'}
              aria-pressed={statusFilter === s}
              onClick={() => setStatusFilter(s)}
              style={{
                padding: 'var(--spacing-xs, 4px) var(--spacing-sm, 10px)',
                borderRadius: 'var(--radius-md, 6px)',
                border: '1px solid var(--palette-outline)',
                cursor: 'pointer',
                fontWeight: statusFilter === s ? 600 : 400,
                background:
                  statusFilter === s
                    ? 'var(--palette-primary-container)'
                    : 'var(--palette-surface)',
                fontSize: 'var(--typography-body-sm-size, 0.875rem)',
                textTransform: 'capitalize',
              }}
            >
              {s}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={loadRows}
          aria-label="Refresh list"
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--palette-primary)',
            fontSize: 'var(--typography-body-sm-size, 0.875rem)',
          }}
        >
          Refresh
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ color: 'var(--palette-on-surface-variant)', padding: 'var(--spacing-lg)' }}>
          Loading…
        </div>
      )}

      {/* Empty state (no rows at all) */}
      {!loading && rows.length === 0 && (
        <Card variant="outlined" padding="none">
          <EmptyState
            title="No user syncs"
            description="Create a user sync to add custom automation rules. Syncs are validated against the active AutomationScope before activation."
          />
        </Card>
      )}

      {/* Grouped tables — one per status group */}
      {!loading && rows.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg, 24px)' }}>
          {groupOrder.map((group) => {
            const groupRows = grouped[group];
            if (groupRows.length === 0) return null;

            const shouldShow =
              statusFilter === 'all' || statusFilter === group;
            if (!shouldShow) return null;

            return (
              <div key={group}>
                <h2
                  style={{
                    fontSize: 'var(--typography-body-size, 0.9375rem)',
                    fontWeight: 600,
                    marginBottom: 'var(--spacing-sm, 8px)',
                    textTransform: 'capitalize',
                    color: 'var(--palette-on-surface-variant)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-xs, 4px)',
                  }}
                >
                  <Badge variant={statusBadgeVariant(group)}>{group}</Badge>
                  <span style={{ fontWeight: 400, fontSize: '0.85em' }}>
                    ({groupRows.length})
                  </span>
                </h2>
                <Card variant="outlined" padding="none">
                  <DataTable
                    columns={columns}
                    data={groupRows}
                    sortable
                    ariaLabel={`${group} user syncs`}
                    onRowClick={(row) =>
                      navigateToHref(`/admin/automation/user-syncs/${encodeURIComponent(String(row.id))}`)
                    }
                  />
                </Card>
              </div>
            );
          })}

          {/* Filtered empty state */}
          {filteredRows.length === 0 && (
            <Card variant="outlined" padding="none">
              <EmptyState
                title="No matching syncs"
                description="Try adjusting the author or status filter."
              />
            </Card>
          )}
        </div>
      )}
    </div>
  );
};

export default UserSyncListView;
