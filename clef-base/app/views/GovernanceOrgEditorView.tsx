'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useKernelInvoke } from '../../lib/clef-provider';
import { ViewRenderer } from '../components/ViewRenderer';
import { Badge } from '../components/widgets/Badge';
import { EmptyState } from '../components/widgets/EmptyState';
import { TreeDisplay } from '../components/widgets/TreeDisplay';

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
  fields: { key: string; label: string; placeholder?: string; type?: string }[];
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
            {field.label}
          </label>
          <input
            id={`field-${field.key}`}
            type={field.type ?? 'text'}
            placeholder={field.placeholder ?? field.label}
            value={values[field.key] ?? ''}
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
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {teams.map(team => (
        <li key={team.id}>
          <button
            onClick={() => onSelect(team)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '8px 12px',
              border: 'none',
              background: selectedId === team.id ? 'var(--palette-primary-container)' : 'transparent',
              color: selectedId === team.id ? 'var(--palette-on-primary-container)' : 'var(--palette-on-surface)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: selectedId === team.id ? 600 : 400,
            }}
          >
            ◉ {team.name}
            {team.domain && (
              <span style={{ fontSize: '0.7rem', color: 'var(--palette-on-surface-variant)', display: 'block' }}>
                {team.domain}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
};

// ---------------------------------------------------------------------------
// Structure mode — team detail panel
// ---------------------------------------------------------------------------

interface TeamDetailPanelProps {
  team: TeamRecord;
  onRefresh: () => void;
}

const TeamDetailPanel: React.FC<TeamDetailPanelProps> = ({ team, onRefresh }) => {
  const invoke = useKernelInvoke();
  const [showAddMember, setShowAddMember] = useState(false);
  const [showCreateChild, setShowCreateChild] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const addMember = useCallback(async (values: Record<string, string>) => {
    const currentMembers = team.members ?? [];
    if (currentMembers.includes(values.member)) {
      throw new Error(`${values.member} is already a member`);
    }
    const updatedContent = JSON.stringify({
      name: team.name,
      domain: team.domain,
      purpose: team.purpose,
      members: [...currentMembers, values.member],
    });
    const result = await invoke('ContentNode', 'update', { node: team.id, content: updatedContent });
    if (result.variant === 'ok') {
      setStatus(`Added ${values.member} to ${team.name}`);
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
            {(team.members ?? []).map(m => (
              <li key={m} style={{ padding: '6px 0', borderBottom: '1px solid var(--palette-outline-variant)', fontSize: '0.875rem' }}>
                👤 {m}
              </li>
            ))}
          </ul>
        )}

        {showAddMember && (
          <InlineForm
            title="Add Member"
            fields={[
              { key: 'member', label: 'Member ID / Username', placeholder: 'user@example.com' },
              { key: 'role', label: 'Role in team', placeholder: 'member' },
            ]}
            onSubmit={addMember}
            onCancel={() => setShowAddMember(false)}
            submitLabel="Add"
          />
        )}
      </div>

      {/* Sub-team creation */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--spacing-sm)' }}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Sub-teams</span>
          <button
            data-part="button"
            data-variant="ghost"
            style={{ fontSize: '0.75rem' }}
            onClick={() => { setShowCreateChild(v => !v); setShowAddMember(false); }}
          >
            + Create Sub-team
          </button>
        </div>

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
    </div>
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
          name: (n.name ?? n.node) as string,
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
          name: (n.name ?? n.spec_name ?? n.node) as string,
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
    const nodeId = `team-${Date.now()}`;
    const createResult = await invoke('ContentNode', 'create', {
      node: nodeId,
      type: 'team',
      content: JSON.stringify({
        name: values.name,
        domain: values.domain || undefined,
        purpose: values.purpose || undefined,
        members: [],
      }),
    });
    if (createResult.variant !== 'ok') {
      throw new Error((createResult.message as string) ?? 'Failed to create team node');
    }
    await invoke('Schema', 'applyTo', { entity_id: nodeId, schema: 'team' });
    setShowCreateTeam(false);
    setRefreshKey(k => k + 1);
  }, [invoke]);

  const createSpec = useCallback(async (values: Record<string, string>) => {
    const nodeId = `spec-${Date.now()}`;
    const createResult = await invoke('ContentNode', 'create', {
      node: nodeId,
      type: 'process-spec',
      content: JSON.stringify({
        name: values.name,
        description: values.description || undefined,
        status: 'draft',
      }),
    });
    if (createResult.variant !== 'ok') {
      throw new Error((createResult.message as string) ?? 'Failed to create process spec');
    }
    await invoke('Schema', 'applyTo', { entity_id: nodeId, schema: 'process-spec' });
    setShowCreateSpec(false);
    setRefreshKey(k => k + 1);
  }, [invoke]);

  const MODES: { id: Mode; label: string }[] = [
    { id: 'structure', label: 'Structure' },
    { id: 'routes', label: 'Routes' },
    { id: 'permissions', label: 'Permissions' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
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
                    { key: 'name', label: 'Team Name', placeholder: 'Engineering' },
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
                    { key: 'name', label: 'Spec Name', placeholder: 'Onboarding' },
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
                onRefresh={() => setRefreshKey(k => k + 1)}
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
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-lg)' }}>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
                    ⤷ {selectedSpec.name ?? selectedSpec.spec}
                  </h2>
                  <Badge variant={selectedSpec.status === 'active' ? 'success' : 'secondary'}>
                    {selectedSpec.status ?? 'draft'}
                  </Badge>
                </div>

                <div style={{ marginBottom: 'var(--spacing-xl)' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 'var(--spacing-md)' }}>Step Definitions</div>
                  <ViewRenderer viewId="process-steps-editor" context={{ spec: selectedSpec.spec }} />
                </div>

                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 'var(--spacing-md)' }}>Routing Edges</div>
                  <ViewRenderer viewId="process-edges-editor" context={{ spec: selectedSpec.spec }} />
                </div>
              </div>
            ) : (
              <EmptyState
                title="Select a process spec"
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
              <ViewRenderer viewId="admin" context={{}} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GovernanceOrgEditorView;
