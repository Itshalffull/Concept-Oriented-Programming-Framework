'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useKernelInvoke } from '../../lib/clef-provider';
import { Badge } from '../components/widgets/Badge';
import { EmptyState } from '../components/widgets/EmptyState';
import { TreeDisplay } from '../components/widgets/TreeDisplay';
import { FlowBuilder } from '../components/widgets/FlowBuilder';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Mode = 'structure' | 'routes' | 'permissions';

interface TeamRecord {
  id: string;
  name: string;
  domain?: string;
  purpose?: string;
  parent?: string | null;
  members?: string[];
}

interface ProcessSpecRecord {
  spec: string;
  name?: string;
  status?: string;
  steps?: unknown[];
}

interface RoleRecord {
  role?: string;
  office?: string;
  name?: string;
  holder?: string;
}

// ---------------------------------------------------------------------------
// Inline form helpers
// ---------------------------------------------------------------------------

interface InlineFormProps {
  title: string;
  fields: { key: string; label: string; placeholder?: string; type?: string; required?: boolean }[];
  onSubmit: (values: Record<string, string>) => Promise<void>;
  onCancel: () => void;
  submitLabel?: string;
}

const InlineForm: React.FC<InlineFormProps> = ({ title, fields, onSubmit, onCancel, submitLabel = 'Create' }) => {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      style={{
        background: 'var(--palette-surface-container)',
        border: '1px solid var(--palette-outline-variant)',
        borderRadius: 'var(--radius-card)',
        padding: 'var(--spacing-lg)',
        marginTop: 'var(--spacing-md)',
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-md)', fontSize: '0.875rem' }}>{title}</div>
      {fields.map(field => (
        <div key={field.key} style={{ marginBottom: 'var(--spacing-md)' }}>
          <label
            htmlFor={`field-${field.key}`}
            style={{ display: 'block', fontSize: '0.75rem', color: 'var(--palette-on-surface-variant)', marginBottom: 4 }}
          >
            {field.label}{field.required && <span style={{ color: 'var(--palette-error)', marginLeft: 2 }}>*</span>}
          </label>
          <input
            id={`field-${field.key}`}
            type={field.type ?? 'text'}
            placeholder={field.placeholder ?? field.label}
            value={values[field.key] ?? ''}
            required={field.required}
            onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
            style={{
              width: '100%',
              padding: '6px 10px',
              border: '1px solid var(--palette-outline)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.875rem',
              background: 'var(--palette-surface)',
              color: 'var(--palette-on-surface)',
              boxSizing: 'border-box',
            }}
          />
        </div>
      ))}
      {error && (
        <div style={{ color: 'var(--palette-error)', fontSize: '0.75rem', marginBottom: 'var(--spacing-sm)' }}>
          {error}
        </div>
      )}
      <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
        <button
          type="submit"
          disabled={busy}
          data-part="button"
          data-variant="primary"
        >
          {busy ? 'Saving…' : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          data-part="button"
          data-variant="ghost"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

// ---------------------------------------------------------------------------
// Structure mode — sidebar tree
// ---------------------------------------------------------------------------

interface TeamTreeProps {
  teams: TeamRecord[];
  selectedId: string | null;
  onSelect: (team: TeamRecord) => void;
}

const TeamTree: React.FC<TeamTreeProps> = ({ teams, selectedId, onSelect }) => {
  if (teams.length === 0) {
    return (
      <div style={{ padding: 'var(--spacing-md)', color: 'var(--palette-on-surface-variant)', fontSize: '0.875rem' }}>
        No teams yet. Create the first one.
      </div>
    );
  }

  const renderNode = (team: TeamRecord, depth: number): React.ReactNode => {
    const children = teams.filter(t => t.parent === team.id);
    return (
      <li key={team.id}>
        <button
          onClick={() => onSelect(team)}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            paddingTop: 7,
            paddingBottom: 7,
            paddingRight: 12,
            paddingLeft: 12 + depth * 16,
            border: 'none',
            background: selectedId === team.id ? 'var(--palette-primary-container)' : 'transparent',
            color: selectedId === team.id ? 'var(--palette-on-primary-container)' : 'var(--palette-on-surface)',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            fontSize: '0.875rem',
            fontWeight: selectedId === team.id ? 600 : 400,
          }}
        >
          {depth > 0 ? '⤷ ' : '◉ '}{team.name}
          {team.domain && (
            <span style={{ fontSize: '0.7rem', color: 'var(--palette-on-surface-variant)', display: 'block' }}>
              {team.domain}
            </span>
          )}
        </button>
        {children.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {children.map(c => renderNode(c, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  const roots = teams.filter(t => !t.parent);
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {roots.map(t => renderNode(t, 0))}
    </ul>
  );
};

// ---------------------------------------------------------------------------
// Structure mode — team detail panel
// ---------------------------------------------------------------------------

interface TeamDetailPanelProps {
  team: TeamRecord;
  allTeams: TeamRecord[];
  onRefresh: () => void;
  onBack: () => void;
  onNavigate: (team: TeamRecord) => void;
  onDelete: () => void;
}

const TEAM_ROLES = ['member', 'lead', 'admin', 'observer', 'reviewer', 'approver'] as const;

const AddMemberForm: React.FC<{ team: TeamRecord; onSubmit: (member: string, role: string) => Promise<void>; onCancel: () => void }> = ({ team, onSubmit, onCancel }) => {
  const [member, setMember] = useState('');
  const [role, setRole] = useState<string>('member');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!member.trim()) { setError('Member ID is required'); return; }
    setBusy(true);
    setError(null);
    try { await onSubmit(member.trim(), role); }
    catch (err) { setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setBusy(false); }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '6px 10px',
    border: '1px solid var(--palette-outline)',
    borderRadius: 'var(--radius-sm)', fontSize: '0.875rem',
    background: 'var(--palette-surface)', color: 'var(--palette-on-surface)',
    boxSizing: 'border-box',
  };

  return (
    <form onSubmit={handleSubmit} style={{ background: 'var(--palette-surface-container)', border: '1px solid var(--palette-outline-variant)', borderRadius: 'var(--radius-card)', padding: 'var(--spacing-lg)', marginTop: 'var(--spacing-md)' }}>
      <div style={{ fontWeight: 600, marginBottom: 'var(--spacing-md)', fontSize: '0.875rem' }}>Add Member to {team.name}</div>
      <div style={{ marginBottom: 'var(--spacing-md)' }}>
        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--palette-on-surface-variant)', marginBottom: 4 }}>Member ID / Username</label>
        <input type="text" placeholder="user@example.com" value={member} onChange={e => setMember(e.target.value)} style={inputStyle} />
      </div>
      <div style={{ marginBottom: 'var(--spacing-md)' }}>
        <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--palette-on-surface-variant)', marginBottom: 4 }}>Role</label>
        <select value={role} onChange={e => setRole(e.target.value)} style={inputStyle}>
          {TEAM_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      {error && <div style={{ color: 'var(--palette-error)', fontSize: '0.75rem', marginBottom: 'var(--spacing-sm)' }}>{error}</div>}
      <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
        <button type="submit" disabled={busy} data-part="button" data-variant="primary">{busy ? 'Adding…' : 'Add'}</button>
        <button type="button" onClick={onCancel} data-part="button" data-variant="ghost">Cancel</button>
      </div>
    </form>
  );
};

const TeamDetailPanel: React.FC<TeamDetailPanelProps> = ({ team, allTeams, onRefresh, onBack, onNavigate, onDelete }) => {
  const invoke = useKernelInvoke();
  const [showAddMember, setShowAddMember] = useState(false);
  const [showCreateChild, setShowCreateChild] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const deleteTeam = useCallback(async () => {
    setDeleting(true);
    try {
      await invoke('ContentNode', 'delete', { node: team.id });
      onBack();
      onDelete();
    } catch (err) {
      setStatus('Delete failed: ' + (err instanceof Error ? err.message : String(err)));
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }, [invoke, team.id, onBack, onDelete]);

  const addMember = useCallback(async (member: string, role: string) => {
    const currentMembers = team.members ?? [];
    if (currentMembers.includes(member)) {
      throw new Error(`${member} is already a member`);
    }
    const updatedContent = JSON.stringify({
      name: team.name,
      domain: team.domain,
      purpose: team.purpose,
      members: [...currentMembers, member],
      memberRoles: { ...(team as Record<string, unknown>).memberRoles as Record<string, string> ?? {}, [member]: role },
    });
    const result = await invoke('ContentNode', 'update', { node: team.id, content: updatedContent });
    if (result.variant === 'ok') {
      setStatus(`Added ${member} (${role}) to ${team.name}`);
      setShowAddMember(false);
      onRefresh();
    } else {
      throw new Error((result.message as string) ?? 'Failed to add member');
    }
  }, [invoke, team, onRefresh]);

  const createChild = useCallback(async (values: Record<string, string>) => {
    const nodeId = `team-${Date.now()}`;
    const createResult = await invoke('ContentNode', 'create', {
      node: nodeId,
      type: 'team',
      content: JSON.stringify({
        name: values.name,
        domain: values.domain || undefined,
        parent: team.id,
        members: [],
      }),
    });
    if (createResult.variant !== 'ok') {
      throw new Error((createResult.message as string) ?? 'Failed to create sub-team');
    }
    await invoke('Schema', 'applyTo', { entity_id: nodeId, schema: 'team' });
    setStatus(`Created sub-team "${values.name}"`);
    setShowCreateChild(false);
    onRefresh();
  }, [invoke, team, onRefresh]);

  return (
    <div>
      <button
        onClick={onBack}
        data-part="button"
        data-variant="ghost"
        style={{ fontSize: '0.8rem', marginBottom: 'var(--spacing-md)', padding: '4px 8px' }}
      >
        ← All Teams
      </button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-lg)' }}>
        <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>◉ {team.name}</h2>
        {team.domain && <Badge variant="secondary">{team.domain}</Badge>}
      </div>

      {team.purpose && (
        <p style={{ color: 'var(--palette-on-surface-variant)', marginBottom: 'var(--spacing-lg)', fontSize: '0.875rem' }}>
          {team.purpose}
        </p>
      )}

      {status && (
        <div style={{ padding: '8px 12px', background: 'var(--palette-primary-container)', borderRadius: 'var(--radius-sm)', marginBottom: 'var(--spacing-md)', fontSize: '0.875rem' }}>
          {status}
        </div>
      )}

      {/* Members */}
      <div style={{ marginBottom: 'var(--spacing-xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Members ({(team.members ?? []).length})</span>
          <button
            data-part="button"
            data-variant="ghost"
            style={{ fontSize: '0.75rem' }}
            onClick={() => { setShowAddMember(v => !v); setShowCreateChild(false); }}
          >
            + Add Member
          </button>
        </div>

        {(team.members ?? []).length === 0 ? (
          <div style={{ fontSize: '0.875rem', color: 'var(--palette-on-surface-variant)', padding: '8px 0' }}>
            No members yet.
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {(team.members ?? []).filter(Boolean).map(m => (
              <li key={m} style={{ padding: '6px 0', borderBottom: '1px solid var(--palette-outline-variant)', fontSize: '0.875rem' }}>
                👤 {m}
              </li>
            ))}
          </ul>
        )}

        {showAddMember && (
          <AddMemberForm
            team={team}
            onSubmit={addMember}
            onCancel={() => setShowAddMember(false)}
          />
        )}
      </div>

      {/* Sub-teams */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>
            Sub-teams ({allTeams.filter(t => t.parent === team.id).length})
          </span>
          <button
            data-part="button"
            data-variant="ghost"
            style={{ fontSize: '0.75rem' }}
            onClick={() => { setShowCreateChild(v => !v); setShowAddMember(false); }}
          >
            + Create Sub-team
          </button>
        </div>

        {allTeams.filter(t => t.parent === team.id).length === 0 ? (
          <div style={{ fontSize: '0.875rem', color: 'var(--palette-on-surface-variant)', padding: '4px 0' }}>
            No sub-teams yet.
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 var(--spacing-md)' }}>
            {allTeams.filter(t => t.parent === team.id).map(child => (
              <li key={child.id} style={{ borderBottom: '1px solid var(--palette-outline-variant)' }}>
                <button
                  onClick={() => onNavigate(child)}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 4px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: '0.875rem', color: 'var(--palette-on-surface)' }}
                >
                  ⤷ {child.name}
                  {child.domain && <span style={{ color: 'var(--palette-on-surface-variant)', marginLeft: 8 }}>{child.domain}</span>}
                </button>
              </li>
            ))}
          </ul>
        )}

        {showCreateChild && (
          <InlineForm
            title="Create Sub-team"
            fields={[
              { key: 'name', label: 'Team Name', placeholder: 'Engineering' },
              { key: 'domain', label: 'Domain / Circle (optional)', placeholder: 'Product delivery' },
            ]}
            onSubmit={createChild}
            onCancel={() => setShowCreateChild(false)}
          />
        )}
      </div>

      {/* Danger zone */}
      <div style={{ marginTop: 'var(--spacing-xl)', paddingTop: 'var(--spacing-md)', borderTop: '1px solid var(--palette-outline-variant)' }}>
        {confirmDelete ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', background: 'var(--palette-error-container, #fdecea)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
            <span style={{ fontSize: '0.8rem', flex: 1, color: 'var(--palette-on-error-container, #b71c1c)' }}>
              Delete &ldquo;{team.name}&rdquo;? This cannot be undone.
            </span>
            <button
              onClick={() => void deleteTeam()}
              disabled={deleting}
              data-part="button"
              style={{ fontSize: '0.8rem', padding: '4px 10px', background: 'var(--palette-error)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600 }}
            >
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              data-part="button"
              data-variant="ghost"
              style={{ fontSize: '0.8rem', padding: '4px 10px' }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            data-part="button"
            data-variant="ghost"
            style={{ fontSize: '0.8rem', color: 'var(--palette-error)', padding: '4px 8px' }}
          >
            Delete Team
          </button>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// ProcessSpecDetail — inline step/edge viewer for the Routes tab
// ---------------------------------------------------------------------------

interface StepRow { key: string; label?: string; step_type?: string; description?: string; assignee?: string; }
interface EdgeRow { from: string; to: string; label?: string; condition?: string; }

const ProcessSpecDetail: React.FC<{ specId: string }> = ({ specId }) => {
  const invoke = useKernelInvoke();
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [edges, setEdges] = useState<EdgeRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void (async () => {
      try {
        const result = await invoke('ProcessSpec', 'get', { spec: specId });
        if (!active) return;
        if (result.variant === 'ok') {
          try { setSteps(JSON.parse(result.steps as string ?? '[]') as StepRow[]); } catch { setSteps([]); }
          try { setEdges(JSON.parse(result.edges as string ?? '[]') as EdgeRow[]); } catch { setEdges([]); }
        }
      } catch { /* silent */ } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [specId, invoke]);

  if (loading) return <div style={{ fontSize: '0.875rem', color: 'var(--palette-on-surface-variant)' }}>Loading…</div>;

  return (
    <>
      <div style={{ marginBottom: 'var(--spacing-xl)' }}>
        <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 'var(--spacing-md)' }}>Step Definitions</div>
        {steps.length === 0 ? (
          <div style={{ fontSize: '0.875rem', color: 'var(--palette-on-surface-variant)' }}>No steps defined yet.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-subtle, #eee)', textAlign: 'left' }}>
                <th style={{ padding: '4px 8px' }}>Key</th>
                <th style={{ padding: '4px 8px' }}>Label</th>
                <th style={{ padding: '4px 8px' }}>Type</th>
                <th style={{ padding: '4px 8px' }}>Assignee</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((s, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--color-border-subtle, #eee)' }}>
                  <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>{s.key}</td>
                  <td style={{ padding: '4px 8px' }}>{s.label ?? '—'}</td>
                  <td style={{ padding: '4px 8px' }}>{s.step_type ?? '—'}</td>
                  <td style={{ padding: '4px 8px' }}>{s.assignee ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div>
        <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 'var(--spacing-md)' }}>Routing Edges</div>
        {edges.length === 0 ? (
          <div style={{ fontSize: '0.875rem', color: 'var(--palette-on-surface-variant)' }}>No routing edges defined yet.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border-subtle, #eee)', textAlign: 'left' }}>
                <th style={{ padding: '4px 8px' }}>From</th>
                <th style={{ padding: '4px 8px' }}>To</th>
                <th style={{ padding: '4px 8px' }}>Label</th>
                <th style={{ padding: '4px 8px' }}>Condition</th>
              </tr>
            </thead>
            <tbody>
              {edges.map((e, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--color-border-subtle, #eee)' }}>
                  <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>{e.from}</td>
                  <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>{e.to}</td>
                  <td style={{ padding: '4px 8px' }}>{e.label ?? '—'}</td>
                  <td style={{ padding: '4px 8px' }}>{e.condition ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
};

// ---------------------------------------------------------------------------
// Routes mode — spec selector + step editor
// ---------------------------------------------------------------------------

interface RoutesSidepanelProps {
  specs: ProcessSpecRecord[];
  selectedId: string | null;
  onSelect: (spec: ProcessSpecRecord) => void;
}

const RoutesSidebar: React.FC<RoutesSidepanelProps> = ({ specs, selectedId, onSelect }) => {
  if (specs.length === 0) {
    return (
      <div style={{ padding: 'var(--spacing-md)', color: 'var(--palette-on-surface-variant)', fontSize: '0.875rem' }}>
        No process specs yet. Use + to create one.
      </div>
    );
  }
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {specs.map(spec => (
        <li key={spec.spec}>
          <button
            onClick={() => onSelect(spec)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '8px 12px',
              border: 'none',
              background: selectedId === spec.spec ? 'var(--palette-primary-container)' : 'transparent',
              color: selectedId === spec.spec ? 'var(--palette-on-primary-container)' : 'var(--palette-on-surface)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: selectedId === spec.spec ? 600 : 400,
            }}
          >
            ⤷ {spec.name ?? spec.spec}
            <Badge
              variant={spec.status === 'active' ? 'success' : 'secondary'}
              style={{ marginLeft: 6, fontSize: '0.65rem' }}
            >
              {spec.status ?? 'draft'}
            </Badge>
          </button>
        </li>
      ))}
    </ul>
  );
};

// ---------------------------------------------------------------------------
// RecentRunsList — shows latest ProcessRuns for a given spec
// ---------------------------------------------------------------------------

interface RunRow {
  run: string;
  status: string;
  started_at: string;
  ended_at?: string;
  input?: string;
}

const STATUS_COLOR: Record<string, string> = {
  running:   'var(--palette-primary)',
  completed: 'var(--palette-success, #2e7d32)',
  failed:    'var(--palette-error)',
  cancelled: 'var(--palette-on-surface-variant)',
  suspended: '#c07000',
};

const RecentRunsList: React.FC<{ specId: string; refreshKey: number }> = ({ specId, refreshKey }) => {
  const invoke = useKernelInvoke();
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    invoke('ProcessRun', 'listBySpec', { spec_ref: specId })
      .then(result => {
        if (!active) return;
        if (result.variant === 'ok') {
          const raw: RunRow[] = Array.isArray(result.runs) ? (result.runs as RunRow[]) : [];
          setRuns(raw.slice().sort((a, b) =>
            new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
          ).slice(0, 10));
        } else {
          setRuns([]);
        }
      })
      .catch(() => { if (active) setRuns([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [specId, refreshKey, invoke]);

  if (loading) return <div style={{ fontSize: '0.8rem', color: 'var(--palette-on-surface-variant)', padding: 'var(--spacing-xs)' }}>Loading runs…</div>;
  if (runs.length === 0) return (
    <div style={{ fontSize: '0.8rem', color: 'var(--palette-on-surface-variant)', padding: 'var(--spacing-xs)' }}>
      No runs yet. Click ▶ Run to start the first one.
    </div>
  );

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {runs.map(r => {
        const dur = r.ended_at
          ? Math.round((new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()) / 1000) + 's'
          : 'running…';
        const color = STATUS_COLOR[r.status] ?? 'var(--palette-on-surface-variant)';
        return (
          <li key={r.run}>
            <a
              href={`/admin/process-runs/${r.run}`}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 8px', borderRadius: 'var(--radius-sm)',
                textDecoration: 'none', color: 'var(--palette-on-surface)',
                fontSize: '0.8rem', background: 'var(--palette-surface-variant)',
              }}
            >
              <span style={{ color, fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 70 }}>
                {r.status}
              </span>
              <span style={{ fontFamily: 'var(--typography-code-family)', fontSize: '0.72rem', color: 'var(--palette-on-surface-variant)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {r.run}
              </span>
              <span style={{ fontSize: '0.72rem', color: 'var(--palette-on-surface-variant)', flexShrink: 0 }}>{dur}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
};

// ---------------------------------------------------------------------------
// RunProcessDialog — modal for starting a process run
// ---------------------------------------------------------------------------

const RunProcessDialog: React.FC<{
  spec: ProcessSpecRecord;
  onClose: () => void;
  onStarted: (runId: string) => void;
}> = ({ spec, onClose, onStarted }) => {
  const invoke = useKernelInvoke();
  const [inputJson, setInputJson] = useState('{}');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { textareaRef.current?.focus(); }, []);

  const handleStart = useCallback(async () => {
    setJsonError(null);
    setError(null);
    let parsedInput: unknown = {};
    try { parsedInput = JSON.parse(inputJson); } catch (e) {
      setJsonError('Invalid JSON: ' + (e instanceof Error ? e.message : String(e)));
      return;
    }
    setStarting(true);
    try {
      const result = await invoke('ProcessRun', 'start', {
        spec_ref: spec.spec,
        spec_version: 0,
        input: JSON.stringify(parsedInput),
      });
      if (result.variant === 'ok') {
        onStarted(result.run as string);
      } else {
        setError((result.message as string) ?? 'Failed to start run');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start run');
    } finally {
      setStarting(false);
    }
  }, [invoke, spec.spec, inputJson, onStarted]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Start process run"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: 'var(--palette-surface)', borderRadius: 'var(--radius-md)',
          padding: 'var(--spacing-xl)', width: '480px', maxWidth: '90vw',
          boxShadow: 'var(--elevation-3, 0 8px 32px rgba(0,0,0,0.2))',
          display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
            ▶ Run: {spec.name ?? spec.spec}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'none', border: 'none', fontSize: '1.1rem', cursor: 'pointer', color: 'var(--palette-on-surface-variant)', lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        <div>
          <label
            htmlFor="run-input-json"
            style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--palette-on-surface-variant)', marginBottom: 6 }}
          >
            Trigger inputs (JSON)
          </label>
          <textarea
            id="run-input-json"
            ref={textareaRef}
            rows={5}
            value={inputJson}
            onChange={e => { setInputJson(e.target.value); setJsonError(null); }}
            spellCheck={false}
            style={{
              width: '100%', boxSizing: 'border-box', resize: 'vertical',
              fontFamily: 'var(--typography-code-family)', fontSize: '0.8rem',
              padding: '8px 10px', borderRadius: 'var(--radius-sm)',
              border: jsonError ? '1px solid var(--palette-error)' : '1px solid var(--palette-outline-variant)',
              background: 'var(--palette-surface-container)',
              color: 'var(--palette-on-surface)',
            }}
          />
          {jsonError && (
            <p role="alert" style={{ margin: '4px 0 0', fontSize: '0.75rem', color: 'var(--palette-error)' }}>{jsonError}</p>
          )}
          <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: 'var(--palette-on-surface-variant)' }}>
            These values are passed to the trigger step as the initial context.
          </p>
        </div>

        {error && (
          <p role="alert" style={{ margin: 0, padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--palette-error-container, #fdecea)', color: 'var(--palette-error)', fontSize: '0.8rem' }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-sm)' }}>
          <button
            onClick={onClose}
            data-part="button"
            data-variant="ghost"
            style={{ padding: '6px 16px', fontSize: '0.875rem' }}
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={starting}
            data-part="button"
            data-variant="filled"
            style={{
              padding: '6px 16px', fontSize: '0.875rem',
              background: 'var(--palette-primary)', color: 'var(--palette-on-primary)',
              border: 'none', borderRadius: 'var(--radius-sm)', cursor: starting ? 'not-allowed' : 'pointer',
              opacity: starting ? 0.7 : 1, fontWeight: 600,
            }}
          >
            {starting ? 'Starting…' : '▶ Start Run'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const GovernanceOrgEditorView: React.FC = () => {
  const invoke = useKernelInvoke();

  const [mode, setMode] = useState<Mode>('structure');
  const [teams, setTeams] = useState<TeamRecord[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<TeamRecord | null>(null);
  const [specs, setSpecs] = useState<ProcessSpecRecord[]>([]);
  const [selectedSpec, setSelectedSpec] = useState<ProcessSpecRecord | null>(null);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [loadingSpecs, setLoadingSpecs] = useState(false);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [showCreateSpec, setShowCreateSpec] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [showRunDialog, setShowRunDialog] = useState(false);
  const [runsRefreshKey, setRunsRefreshKey] = useState(0);
  const [lastRunId, setLastRunId] = useState<string | null>(null);
  const [confirmDeleteSpec, setConfirmDeleteSpec] = useState(false);
  const [deletingSpec, setDeletingSpec] = useState(false);

  // Load teams via ContentNode schema filter
  const loadTeams = useCallback(async () => {
    setLoadingTeams(true);
    try {
      const result = await invoke('ContentNode', 'listBySchema', { schema: 'team' });
      if (result.variant === 'ok') {
        let rows: Record<string, unknown>[] = [];
        try { rows = JSON.parse(result.items as string ?? '[]'); } catch { /* empty */ }
        const parsed: TeamRecord[] = rows.map(n => ({
          id: n.node as string,
          name: ((n.name as string) || (n.node as string)) as string,
          domain: n.domain as string | undefined,
          purpose: n.purpose as string | undefined,
          parent: (n.parent ?? null) as string | null,
          members: (n.members ?? []) as string[],
        }));
        setTeams(parsed);
        setSelectedTeam(prev => prev ? (parsed.find(t => t.id === prev.id) ?? prev) : prev);
      } else {
        setTeams([]);
      }
    } catch {
      setTeams([]);
    } finally {
      setLoadingTeams(false);
    }
  }, [invoke]);

  // Load process specs via ContentNode schema filter
  const loadSpecs = useCallback(async () => {
    setLoadingSpecs(true);
    try {
      const result = await invoke('ContentNode', 'listBySchema', { schema: 'process-spec' });
      if (result.variant === 'ok') {
        let rows: Record<string, unknown>[] = [];
        try { rows = JSON.parse(result.items as string ?? '[]'); } catch { /* empty */ }
        const parsed: ProcessSpecRecord[] = rows.map(n => ({
          spec: n.node as string,
          name: (((n.name as string) || (n.spec_name as string) || (n.node as string))) as string,
          status: (n.run_status ?? n.status ?? 'draft') as string,
          steps: [],
        }));
        setSpecs(parsed);
      } else {
        setSpecs([]);
      }
    } catch {
      setSpecs([]);
    } finally {
      setLoadingSpecs(false);
    }
  }, [invoke]);

  useEffect(() => {
    if (mode === 'structure') loadTeams();
    else if (mode === 'routes') loadSpecs();
  }, [mode, refreshKey, loadTeams, loadSpecs]);

  const createTeam = useCallback(async (values: Record<string, string>) => {
    if (!values.name?.trim()) throw new Error('Team Name is required');
    const nodeId = `team-${Date.now()}`;
    const createResult = await invoke('ContentNode', 'create', {
      node: nodeId,
      type: 'team',
      content: JSON.stringify({
        name: values.name.trim(),
        domain: values.domain?.trim() || undefined,
        purpose: values.purpose?.trim() || undefined,
        members: [],
      }),
    });
    if (createResult.variant !== 'ok') {
      throw new Error((createResult.message as string) ?? 'Failed to create team node');
    }
    await invoke('Schema', 'applyTo', { entity_id: nodeId, schema: 'team' });
    setShowCreateTeam(false);
    setRefreshKey(k => k + 1);
    setSelectedTeam({ id: nodeId, name: values.name.trim(), domain: values.domain?.trim(), purpose: values.purpose?.trim(), members: [] });
  }, [invoke]);

  const createSpec = useCallback(async (values: Record<string, string>) => {
    if (!values.name?.trim()) throw new Error('Spec Name is required');
    const nodeId = `spec-${Date.now()}`;
    const createResult = await invoke('ContentNode', 'create', {
      node: nodeId,
      type: 'process-spec',
      content: JSON.stringify({
        name: values.name.trim(),
        description: values.description?.trim() || undefined,
        status: 'draft',
      }),
    });
    if (createResult.variant !== 'ok') {
      throw new Error((createResult.message as string) ?? 'Failed to create process spec');
    }
    await invoke('Schema', 'applyTo', { entity_id: nodeId, schema: 'process-spec' });
    setShowCreateSpec(false);
    setRefreshKey(k => k + 1);
    setSelectedSpec({ spec: nodeId, name: values.name.trim(), status: 'draft', steps: [] });
  }, [invoke]);

  const deleteSpec = useCallback(async (specId: string) => {
    setDeletingSpec(true);
    try {
      await invoke('ContentNode', 'delete', { node: specId });
      setSelectedSpec(null);
      setConfirmDeleteSpec(false);
      setRefreshKey(k => k + 1);
    } catch {
      /* silent — keep confirm open so user sees nothing happened */
    } finally {
      setDeletingSpec(false);
    }
  }, [invoke]);

  const MODES: { id: Mode; label: string }[] = [
    { id: 'structure', label: 'Structure' },
    { id: 'routes', label: 'Routes' },
    { id: 'permissions', label: 'Permissions' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Run process dialog */}
      {showRunDialog && selectedSpec && (
        <RunProcessDialog
          spec={selectedSpec}
          onClose={() => setShowRunDialog(false)}
          onStarted={(runId) => {
            setLastRunId(runId);
            setRunsRefreshKey(k => k + 1);
            setShowRunDialog(false);
            window.location.href = `/admin/process-runs/${runId}`;
          }}
        />
      )}

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--palette-outline-variant)', paddingBottom: 0, marginBottom: 0 }}>
        {MODES.map(m => (
          <button
            key={m.id}
            onClick={() => { setMode(m.id); setSelectedTeam(null); setSelectedSpec(null); }}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderBottom: mode === m.id ? '2px solid var(--palette-primary)' : '2px solid transparent',
              background: 'transparent',
              color: mode === m.id ? 'var(--palette-primary)' : 'var(--palette-on-surface-variant)',
              fontWeight: mode === m.id ? 600 : 400,
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* Left sidebar */}
        <div style={{
          width: 240,
          flexShrink: 0,
          borderRight: '1px solid var(--palette-outline-variant)',
          overflowY: 'auto',
          padding: 'var(--spacing-md)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-sm)',
        }}>
          {/* Sidebar header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-xs)' }}>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', color: 'var(--palette-on-surface-variant)', textTransform: 'uppercase' }}>
              {mode === 'structure' ? 'Teams' : mode === 'routes' ? 'Process Specs' : 'Roles & Routes'}
            </span>
            {(mode === 'structure' || mode === 'routes') && (
              <button
                onClick={() => {
                  if (mode === 'structure') setShowCreateTeam(v => !v);
                  else setShowCreateSpec(v => !v);
                }}
                title={mode === 'structure' ? 'Create team' : 'Create process spec'}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--palette-primary)', fontWeight: 700, fontSize: '1rem', lineHeight: 1 }}
              >
                +
              </button>
            )}
          </div>

          {mode === 'structure' && (
            <>
              {showCreateTeam && (
                <InlineForm
                  title="New Top-level Team"
                  fields={[
                    { key: 'name', label: 'Team Name', placeholder: 'Engineering', required: true },
                    { key: 'domain', label: 'Domain (optional)', placeholder: 'Product' },
                    { key: 'purpose', label: 'Purpose (optional)', placeholder: 'Build the product' },
                  ]}
                  onSubmit={createTeam}
                  onCancel={() => setShowCreateTeam(false)}
                />
              )}
              {loadingTeams ? (
                <div style={{ fontSize: '0.875rem', color: 'var(--palette-on-surface-variant)' }}>Loading…</div>
              ) : (
                <TeamTree
                  teams={teams}
                  selectedId={selectedTeam?.id ?? null}
                  onSelect={t => { setSelectedTeam(t); setShowCreateTeam(false); }}
                />
              )}
            </>
          )}

          {mode === 'routes' && (
            <>
              {showCreateSpec && (
                <InlineForm
                  title="New Process Spec"
                  fields={[
                    { key: 'name', label: 'Spec Name', placeholder: 'Onboarding', required: true },
                    { key: 'description', label: 'Description (optional)', placeholder: 'Employee onboarding process' },
                  ]}
                  onSubmit={createSpec}
                  onCancel={() => setShowCreateSpec(false)}
                />
              )}
              {loadingSpecs ? (
                <div style={{ fontSize: '0.875rem', color: 'var(--palette-on-surface-variant)' }}>Loading…</div>
              ) : (
                <RoutesSidebar
                  specs={specs}
                  selectedId={selectedSpec?.spec ?? null}
                  onSelect={s => setSelectedSpec(s)}
                />
              )}
            </>
          )}

          {mode === 'permissions' && (
            <div style={{ fontSize: '0.875rem', color: 'var(--palette-on-surface-variant)' }}>
              <div style={{ marginBottom: 'var(--spacing-sm)', fontStyle: 'italic' }}>
                Select a role or route to view and edit permissions.
              </div>
              <div style={{ borderTop: '1px solid var(--palette-outline-variant)', paddingTop: 'var(--spacing-sm)' }}>
                <a href="/admin/access" style={{ color: 'var(--palette-primary)', fontSize: '0.8rem' }}>
                  → Full Access Control Admin
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Right content panel */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--spacing-xl)' }}>

          {/* Structure mode */}
          {mode === 'structure' && (
            selectedTeam ? (
              <TeamDetailPanel
                key={selectedTeam.id}
                team={selectedTeam}
                allTeams={teams}
                onRefresh={() => setRefreshKey(k => k + 1)}
                onBack={() => setSelectedTeam(null)}
                onNavigate={t => setSelectedTeam(t)}
                onDelete={() => setRefreshKey(k => k + 1)}
              />
            ) : teams.length > 0 ? (
              <div>
                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 'var(--spacing-lg)', color: 'var(--palette-on-surface)' }}>
                  Organisation Chart
                </div>
                <TreeDisplay
                  data={teams as unknown as Record<string, unknown>[]}
                  fields={[
                    { key: 'id', label: 'ID' },
                    { key: 'name', label: 'Team' },
                    { key: 'domain', label: 'Domain' },
                  ]}
                  onRowClick={row => {
                    const t = teams.find(t => t.id === row.id);
                    if (t) setSelectedTeam(t);
                  }}
                />
              </div>
            ) : (
              <EmptyState
                title="No teams yet"
                description="Create your first team with the + button in the sidebar."
              />
            )
          )}

          {/* Routes mode */}
          {mode === 'routes' && (
            selectedSpec ? (
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                {/* Spec header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)', flexShrink: 0, flexWrap: 'wrap' }}>
                  <button
                    onClick={() => { setSelectedSpec(null); setLastRunId(null); setConfirmDeleteSpec(false); }}
                    data-part="button"
                    data-variant="ghost"
                    style={{ fontSize: '0.8rem', padding: '4px 8px' }}
                  >
                    ← All Specs
                  </button>
                  <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>
                    ⤷ {selectedSpec.name ?? selectedSpec.spec}
                  </h2>
                  <Badge variant={selectedSpec.status === 'active' ? 'success' : 'secondary'}>
                    {selectedSpec.status ?? 'draft'}
                  </Badge>
                  <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--spacing-xs)' }}>
                    {lastRunId && (
                      <a
                        href={`/admin/process-runs/${lastRunId}`}
                        style={{ fontSize: '0.75rem', color: 'var(--palette-primary)', textDecoration: 'none', padding: '4px 8px', border: '1px solid var(--palette-primary)', borderRadius: 'var(--radius-sm)' }}
                      >
                        View last run →
                      </a>
                    )}
                    {confirmDeleteSpec ? (
                      <>
                        <span style={{ fontSize: '0.75rem', color: 'var(--palette-error)' }}>Delete this spec?</span>
                        <button
                          onClick={() => void deleteSpec(selectedSpec.spec)}
                          disabled={deletingSpec}
                          style={{ fontSize: '0.75rem', padding: '4px 10px', background: 'var(--palette-error)', color: '#fff', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600 }}
                        >
                          {deletingSpec ? 'Deleting…' : 'Delete'}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteSpec(false)}
                          data-part="button"
                          data-variant="ghost"
                          style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteSpec(true)}
                        data-part="button"
                        data-variant="ghost"
                        style={{ fontSize: '0.75rem', padding: '4px 8px', color: 'var(--palette-error)' }}
                      >
                        Delete
                      </button>
                    )}
                    <button
                      onClick={() => setShowRunDialog(true)}
                      data-part="button"
                      data-variant="filled"
                      style={{
                        padding: '5px 14px', fontSize: '0.8rem', fontWeight: 600,
                        background: 'var(--palette-primary)', color: 'var(--palette-on-primary)',
                        border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                      }}
                    >
                      ▶ Run Process
                    </button>
                  </div>
                </div>

                {/* FlowBuilder — step authoring */}
                <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
                  <FlowBuilder
                    processSpecId={selectedSpec.spec}
                    initialView="steps"
                    onSave={async () => {
                      // Individual step configs auto-save via ProcessSpec/putStep;
                      // this refreshes the runs list to reflect any pending changes.
                      setRunsRefreshKey(k => k + 1);
                    }}
                    onPublish={async () => {
                      await invoke('ProcessSpec', 'publish', { spec: selectedSpec.spec });
                      setRefreshKey(k => k + 1);
                    }}
                  />
                </div>

                {/* Recent runs panel */}
                <div style={{ flexShrink: 0, borderTop: '1px solid var(--palette-outline-variant)', paddingTop: 'var(--spacing-sm)', marginTop: 'var(--spacing-sm)' }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--palette-on-surface-variant)', marginBottom: 6 }}>
                    Recent Runs
                  </div>
                  <RecentRunsList specId={selectedSpec.spec} refreshKey={runsRefreshKey} />
                </div>
              </div>
            ) : (
              <EmptyState
                title="Select a governance process spec"
                description="Choose a process spec from the sidebar to view and edit its steps and routing edges."
              />
            )
          )}

          {/* Permissions mode */}
          {mode === 'permissions' && (
            <div>
              <div className="page-header">
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Permissions</h2>
              </div>
              <p style={{ color: 'var(--palette-on-surface-variant)', fontSize: '0.875rem', marginBottom: 'var(--spacing-xl)' }}>
                Governance permissions control which roles can submit proposals, vote, and execute actions for each process route.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                <a href="/admin/governance/permissions" style={{ color: 'var(--color-primary)', textDecoration: 'underline', fontSize: '0.875rem' }}>
                  → Permissions by Subject
                </a>
                <a href="/admin/governance/permissions/by-resource" style={{ color: 'var(--color-primary)', textDecoration: 'underline', fontSize: '0.875rem' }}>
                  → Permissions by Resource
                </a>
                <a href="/admin/governance/permissions/effective" style={{ color: 'var(--color-primary)', textDecoration: 'underline', fontSize: '0.875rem' }}>
                  → Effective Permissions
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GovernanceOrgEditorView;
