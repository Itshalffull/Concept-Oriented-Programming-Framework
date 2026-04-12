'use client';

/**
 * ConceptBrowserView — Browse and manage concept packages
 * Layout: Available packages (registry) + Installed packages
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Card } from '../components/widgets/Card';
import { DataTable, type ColumnDef } from '../components/widgets/DataTable';
import { EmptyState } from '../components/widgets/EmptyState';
import { Badge } from '../components/widgets/Badge';
import { ActionButton } from '../components/widgets/ActionButton';
import { useKernelInvoke } from '../../lib/clef-provider';

interface InstalledPackage extends Record<string, unknown> {
  id: string;
  name: string;
  version: string;
  registry?: string;
  status: string;
  description?: string;
  concepts: number;
  syncs: number;
  dependencies?: string[];
  installedAt?: string | null;
}

export const ConceptBrowserView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'installed' | 'browse'>('installed');
  const [searchQuery, setSearchQuery] = useState('');
  const [packages, setPackages] = useState<InstalledPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [browseResults, setBrowseResults] = useState<InstalledPackage[]>([]);
  const [previewPackage, setPreviewPackage] = useState<InstalledPackage | null>(null);
  const [previewDetails, setPreviewDetails] = useState<Record<string, unknown> | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const invoke = useKernelInvoke();

  const loadInstalled = useCallback(async () => {
    const data = await invoke('ConceptBrowser', 'listInstalled', {});
    if (data.variant === 'ok' && Array.isArray(data.packages)) {
      setPackages(data.packages as InstalledPackage[]);
    }
  }, [invoke]);

  useEffect(() => {
    async function load() {
      try {
        await loadInstalled();
      } catch {
        setPackages([]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [loadInstalled]);

  const handleSearch = useCallback(async () => {
    const query = searchQuery.trim();
    try {
      const data = await invoke('ConceptBrowser', 'search', {
        query,
        registry: 'all',
      });
      if (data.variant === 'ok' && Array.isArray(data.results)) {
        setBrowseResults(data.results as InstalledPackage[]);
        setStatusMessage(data.results.length === 0 ? 'No packages matched this query.' : null);
      } else {
        setBrowseResults([]);
        setStatusMessage('No packages matched this query.');
      }
    } catch {
      setBrowseResults([]);
      setStatusMessage('Package search is currently unavailable.');
    }
  }, [searchQuery, invoke]);

  const handlePreview = useCallback(async (pkg: InstalledPackage) => {
    try {
      const result = await invoke('ConceptBrowser', 'preview', {
        package_name: pkg.name,
        version: pkg.version,
      });
      if (result.variant === 'ok') {
        setPreviewPackage(pkg);
        setPreviewDetails((result.details as Record<string, unknown>) ?? null);
        setStatusMessage(null);
      }
    } catch {
      setStatusMessage(`Preview failed for ${pkg.name}.`);
    }
  }, [invoke]);


  const columns: ColumnDef[] = [
    { key: 'name', label: 'Suite Name' },
    { key: 'version', label: 'Version' },
    { key: 'concepts', label: 'Concepts' },
    { key: 'syncs', label: 'Syncs' },
    {
      key: 'status',
      label: 'Status',
      render: (val) => (
        <Badge variant={val === 'installed' ? 'success' : 'warning'}>{String(val)}</Badge>
      ),
    },
    {
      key: 'installedAt',
      label: 'Installed',
      render: (val) => val ? new Date(String(val)).toLocaleDateString() : '—',
    },
  ];

  const filtered = packages.filter(
    (p) =>
      !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="view-shell">
      <div className="view-page-header">
        <h1>Concept Browser</h1>
      </div>

      <p className="view-page-copy">
        Package discovery and installation runs through the `ConceptBrowser` concept.
        Preview computes schema, sync, provider, and widget impact before install.
      </p>

      {statusMessage && (
        <Card variant="filled" className="view-status-banner view-status-banner--filled">
          <span>{statusMessage}</span>
        </Card>
      )}

      {/* Tabs */}
      <div className="view-tabs" data-part="tabs">
        <button
          data-part="tab"
          data-active={activeTab === 'installed' ? 'true' : 'false'}
          onClick={() => setActiveTab('installed')}
        >
          Installed ({packages.length})
        </button>
        <button
          data-part="tab"
          data-active={activeTab === 'browse' ? 'true' : 'false'}
          onClick={() => setActiveTab('browse')}
        >
          Browse Registry
        </button>
      </div>

      {/* Search */}
      <div className="view-field-shell view-field-shell--sm" data-part="search-input">
        <input
          type="text"
          placeholder={activeTab === 'installed' ? 'Filter installed suites...' : 'Search registry...'}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && activeTab === 'browse' && handleSearch()}
        />
      </div>

      {activeTab === 'installed' && (
        <Card variant="outlined" padding="none">
          {loading ? (
            <div className="view-loading">
              Loading...
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              title="No suites found"
              description={searchQuery ? 'Try a different search term' : 'No suites installed yet'}
            />
          ) : (
            <DataTable
              columns={columns}
              data={filtered}
              sortable
              ariaLabel="Installed suites"
            />
          )}
        </Card>
      )}

      {activeTab === 'browse' && (
        <div>
          {browseResults.length === 0 ? (
            <EmptyState
              title="Search the Registry"
              description={statusMessage ?? 'Enter a search term to find concept suites from the local registry and Clef Hub mirrors.'}
              action={
                <button
                  data-part="button"
                  data-variant="filled"
                  onClick={handleSearch}
                >
                  Search
                </button>
              }
            />
          ) : (
            <div className="card-grid">
              {browseResults.map((pkg) => (
                <Card key={pkg.id ?? pkg.name} variant="outlined" className="view-panel">
                  <div className="view-toolbar" style={{ marginBottom: 'var(--spacing-sm)' }}>
                    <strong>{pkg.name}</strong>
                    <Badge variant={pkg.status === 'installed' ? 'success' : 'warning'}>
                      {pkg.status}
                    </Badge>
                    {pkg.registry && <Badge variant="secondary">{pkg.registry}</Badge>}
                  </div>
                  <p className="view-page-copy" style={{ marginBottom: 'var(--spacing-sm)' }}>
                    {pkg.description ?? 'No description available.'}
                  </p>
                  <div className="view-chip-row" style={{ marginBottom: 'var(--spacing-md)' }}>
                    <Badge variant="info">{pkg.concepts} concepts</Badge>
                    <Badge variant="secondary">{pkg.syncs} syncs</Badge>
                    <Badge variant="secondary">v{pkg.version}</Badge>
                  </div>
                  <div className="view-toolbar">
                    <button
                      data-part="button"
                      data-variant="outlined"
                      onClick={() => handlePreview(pkg)}
                    >
                      Preview
                    </button>
                    <ActionButton
                      binding="concept-install"
                      context={{ package_name: pkg.name, version: pkg.version }}
                      label={pkg.status === 'installed' ? 'Reinstall' : 'Install'}
                      buttonVariant="primary"
                      onSuccess={() => {
                        loadInstalled();
                        setStatusMessage(`Installed ${pkg.name} ${pkg.version}.`);
                        setBrowseResults((prev) =>
                          prev.map((entry) =>
                            entry.name === pkg.name ? { ...entry, status: 'installed' } : entry,
                          ),
                        );
                      }}
                      onError={(message) => setStatusMessage(message ?? `Install failed for ${pkg.name}.`)}
                    />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {previewPackage && previewDetails && (
        <Card variant="outlined" className="view-panel" style={{ marginTop: 'var(--spacing-xl)' }}>
          <div className="view-section-header">
            <div>
              <h2 style={{ margin: 0 }}>{previewPackage.name}</h2>
              <p className="view-page-copy" style={{ marginTop: 4 }}>
                Previewing install impact for v{previewPackage.version}
              </p>
            </div>
            <button
              data-part="button"
              data-variant="outlined"
              onClick={() => {
                setPreviewPackage(null);
                setPreviewDetails(null);
              }}
            >
              Close Preview
            </button>
          </div>

          <div className="view-card-grid view-card-grid--tiles">
            <div>
              <strong>Schemas</strong>
              <div style={{ marginTop: 'var(--spacing-xs)' }}>
                {((previewDetails.new_schemas as string[]) ?? []).map((value) => (
                  <Badge key={value} variant="info">{value}</Badge>
                ))}
              </div>
            </div>
            <div>
              <strong>Syncs</strong>
              <div style={{ marginTop: 'var(--spacing-xs)' }}>
                {((previewDetails.new_syncs as string[]) ?? []).slice(0, 4).map((value) => (
                  <Badge key={value} variant="secondary">{value}</Badge>
                ))}
              </div>
            </div>
            <div>
              <strong>Providers</strong>
              <div style={{ marginTop: 'var(--spacing-xs)' }}>
                {(((previewDetails.new_providers as string[]) ?? []).length > 0
                  ? (previewDetails.new_providers as string[])
                  : ['No new providers']).map((value) => (
                  <Badge key={value} variant="secondary">{value}</Badge>
                ))}
              </div>
            </div>
            <div>
              <strong>Size Impact</strong>
              <p style={{ margin: 'var(--spacing-xs) 0 0' }}>{String(previewDetails.size_impact ?? 0)} KB</p>
            </div>
          </div>
        </Card>
      )}

      {activeTab === 'installed' && filtered.length > 0 && (
        <div className="view-toolbar" style={{ marginTop: 'var(--spacing-lg)' }}>
          {filtered.map((pkg) => (
            <ActionButton
              key={`remove-${pkg.id}`}
              binding="concept-remove"
              context={{ package_name: pkg.name }}
              label={`Remove ${pkg.name}`}
              buttonVariant="ghost"
              onSuccess={() => {
                loadInstalled();
                setStatusMessage(`Removed ${pkg.name}.`);
              }}
              onError={(message) => setStatusMessage(message ?? `Remove failed for ${pkg.name}.`)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ConceptBrowserView;
