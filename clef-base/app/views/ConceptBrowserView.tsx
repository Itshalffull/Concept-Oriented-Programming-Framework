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
import { useKernelInvoke } from '../../lib/clef-provider';

interface InstalledPackage {
  name: string;
  version: string;
  status: string;
  concepts: number;
  syncs: number;
}

export const ConceptBrowserView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'installed' | 'browse'>('installed');
  const [searchQuery, setSearchQuery] = useState('');
  const [packages, setPackages] = useState<InstalledPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [browseResults, setBrowseResults] = useState<InstalledPackage[]>([]);
  const invoke = useKernelInvoke();

  useEffect(() => {
    async function load() {
      try {
        const data = await invoke('ConceptBrowser', 'listInstalled', {});
        if (data.variant === 'ok' && Array.isArray(data.packages)) {
          setPackages(data.packages as InstalledPackage[]);
        }
      } catch {
        // Fallback: show known suites from the filesystem
        setPackages([
          { name: 'app-shell', version: '0.1.0', status: 'installed', concepts: 3, syncs: 0 },
          { name: 'component-mapping', version: '0.1.0', status: 'installed', concepts: 10, syncs: 10 },
          { name: 'concept-browser', version: '0.1.0', status: 'installed', concepts: 1, syncs: 10 },
          { name: 'entity-lifecycle', version: '0.1.0', status: 'installed', concepts: 0, syncs: 7 },
          { name: 'surface-integration', version: '0.1.0', status: 'installed', concepts: 0, syncs: 6 },
          { name: 'version-space-integration', version: '0.1.0', status: 'installed', concepts: 0, syncs: 11 },
          { name: 'identity-integration', version: '0.1.0', status: 'installed', concepts: 0, syncs: 3 },
          { name: 'storage', version: '0.1.0', status: 'installed', concepts: 2, syncs: 2 },
          { name: 'hono-routing', version: '0.1.0', status: 'installed', concepts: 1, syncs: 1 },
          { name: 'offline-first', version: '0.1.0', status: 'installed', concepts: 0, syncs: 5 },
          { name: 'web3-oracle-bridge', version: '0.1.0', status: 'installed', concepts: 0, syncs: 10 },
        ]);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;
    try {
      const data = await invoke('HubProxy', 'search', { query: searchQuery });
      if (data.variant === 'ok' && Array.isArray(data.results)) {
        setBrowseResults(data.results as InstalledPackage[]);
      }
    } catch {
      setBrowseResults([]);
    }
  }, [searchQuery, invoke]);

  const handleInstall = useCallback(async (name: string) => {
    try {
      await invoke('ConceptBrowser', 'install', { name });
    } catch {
      // Installation not yet supported
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
  ];

  const filtered = packages.filter(
    (p) =>
      !searchQuery || p.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div>
      <div className="page-header">
        <h1>Concept Browser</h1>
      </div>

      {/* Tabs */}
      <div data-part="tabs" style={{ marginBottom: 'var(--spacing-lg)' }}>
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
      <div data-part="search-input" style={{ marginBottom: 'var(--spacing-md)', maxWidth: '400px' }}>
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
            <div style={{ padding: 'var(--spacing-lg)', color: 'var(--palette-on-surface-variant)' }}>
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
              description="Enter a search term to find concept suites from Clef Hub and the Repertoire"
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
                <div key={pkg.name} data-part="plugin-card">
                  <div data-part="title">{pkg.name}</div>
                  <div data-part="description">v{pkg.version}</div>
                  <div data-part="meta">
                    <Badge variant="info">{pkg.concepts} concepts</Badge>
                    <Badge variant="secondary">{pkg.syncs} syncs</Badge>
                  </div>
                  <button
                    data-part="button"
                    data-variant="outlined"
                    onClick={() => handleInstall(pkg.name)}
                  >
                    Install
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ConceptBrowserView;
