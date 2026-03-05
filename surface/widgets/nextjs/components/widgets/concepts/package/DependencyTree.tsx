/* ---------------------------------------------------------------------------
 * DependencyTree — Server Component
 *
 * Interactive dependency tree viewer for package manifests. Displays a
 * recursive tree with search, scope filter chips, duplicate/conflict
 * detection, and detail panel.
 * ------------------------------------------------------------------------- */

import type { ReactNode } from 'react';

/* ---------------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------------- */

export interface DependencyNode {
  name: string;
  version: string;
  resolved?: string;
  type?: 'prod' | 'dev' | 'peer' | 'optional';
  dependencies?: DependencyNode[];
}

export interface DependencyTreeProps {
  root: { name: string; version: string; dependencies?: DependencyNode[] };
  expandDepth?: number;
  showDevDeps?: boolean;
  showVulnerabilities?: boolean;
  selectedPackage?: string | undefined;
  /** Scope filter: 'all' | 'prod' | 'dev' | 'peer' | 'optional'. */
  scopeFilter?: string;
  /** Search query to filter dependencies. */
  searchQuery?: string;
  children?: ReactNode;
}

type ScopeFilter = 'all' | 'prod' | 'dev' | 'peer' | 'optional';

/* ---------------------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------------------- */

function collectPackages(nodes: DependencyNode[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  function walk(deps: DependencyNode[]) {
    for (const dep of deps) {
      const versions = map.get(dep.name) ?? [];
      versions.push(dep.version);
      map.set(dep.name, versions);
      if (dep.dependencies) walk(dep.dependencies);
    }
  }
  walk(nodes);
  return map;
}

function countByType(nodes: DependencyNode[]): Record<string, number> {
  const counts: Record<string, number> = { prod: 0, dev: 0, peer: 0, optional: 0 };
  let total = 0;
  function walk(deps: DependencyNode[]) {
    for (const dep of deps) {
      const t = dep.type ?? 'prod';
      counts[t] = (counts[t] ?? 0) + 1;
      total++;
      if (dep.dependencies) walk(dep.dependencies);
    }
  }
  walk(nodes);
  return { ...counts, total };
}

function matchesSearch(node: DependencyNode, query: string): boolean {
  const q = query.toLowerCase();
  if (node.name.toLowerCase().includes(q)) return true;
  if (node.version.toLowerCase().includes(q)) return true;
  if (node.dependencies) {
    return node.dependencies.some((child) => matchesSearch(child, q));
  }
  return false;
}

function matchesScope(node: DependencyNode, scope: ScopeFilter): boolean {
  if (scope === 'all') return true;
  return (node.type ?? 'prod') === scope;
}

const SCOPE_OPTIONS: ScopeFilter[] = ['all', 'prod', 'dev', 'peer', 'optional'];

/* ---------------------------------------------------------------------------
 * TreeNodeItem — recursive tree rendering
 * ------------------------------------------------------------------------- */

function TreeNodeItem({
  node,
  depth,
  expandDepth,
  packageMap,
  selectedName,
  searchQuery,
  scopeFilter,
}: {
  node: DependencyNode;
  depth: number;
  expandDepth: number;
  packageMap: Map<string, string[]>;
  selectedName: string | null;
  searchQuery: string;
  scopeFilter: ScopeFilter;
}) {
  const hasChildren = !!(node.dependencies && node.dependencies.length > 0);
  const isExpanded = depth < expandDepth;
  const versions = packageMap.get(node.name) ?? [];
  const isDuplicate = versions.length > 1;
  const hasConflict = isDuplicate && new Set(versions).size > 1;
  const isSelected = selectedName === node.name;
  const typeBadgeLabel = node.type ?? 'prod';

  if (!matchesScope(node, scopeFilter)) return null;
  if (searchQuery && !matchesSearch(node, searchQuery)) return null;

  const filteredChildren = node.dependencies?.filter(
    (child) =>
      matchesScope(child, scopeFilter) &&
      (!searchQuery || matchesSearch(child, searchQuery))
  );

  return (
    <li
      role="treeitem"
      aria-expanded={hasChildren ? isExpanded : undefined}
      aria-selected={isSelected}
      aria-label={`${node.name}@${node.version}`}
      data-part="tree-node"
      data-scope={typeBadgeLabel}
      data-conflict={hasConflict ? 'true' : 'false'}
      data-duplicate={isDuplicate ? 'true' : 'false'}
      data-selected={isSelected ? 'true' : 'false'}
      tabIndex={-1}
      style={{ paddingLeft: `${depth * 20}px` }}
    >
      <span
        data-part="tree-node-content"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
      >
        {hasChildren && (
          <button
            type="button"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
            data-part="toggle"
            style={{ background: 'none', border: 'none', padding: 0, fontSize: '12px' }}
          >
            {isExpanded ? '\u25BE' : '\u25B8'}
          </button>
        )}
        {!hasChildren && (
          <span style={{ display: 'inline-block', width: '12px' }} />
        )}

        <span data-part="package-name">{node.name}</span>

        <span data-part="version" style={{ fontSize: '0.85em', opacity: 0.8 }}>
          @{node.version}
        </span>

        <span
          data-part="type-badge"
          data-type={typeBadgeLabel}
          style={{
            fontSize: '0.75em',
            padding: '1px 5px',
            borderRadius: '3px',
            border: '1px solid currentColor',
            opacity: 0.7,
          }}
        >
          {typeBadgeLabel}
        </span>

        {hasConflict && (
          <span
            data-part="conflict"
            data-visible="true"
            aria-label="Version conflict"
            title={`Conflicting versions: ${[...new Set(versions)].join(', ')}`}
            style={{ color: 'orange' }}
          >
            &#9888;
          </span>
        )}

        {isDuplicate && (
          <span
            data-part="dup"
            data-visible="true"
            aria-label={`Duplicate: appears ${versions.length} times`}
            title={`Appears ${versions.length} times`}
            style={{ fontSize: '0.75em', opacity: 0.7 }}
          >
            x{versions.length}
          </span>
        )}
      </span>

      {hasChildren && isExpanded && filteredChildren && filteredChildren.length > 0 && (
        <ul role="group" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {filteredChildren.map((child, i) => (
            <TreeNodeItem
              key={`${child.name}-${child.version}-${i}`}
              node={child}
              depth={depth + 1}
              expandDepth={expandDepth}
              packageMap={packageMap}
              selectedName={selectedName}
              searchQuery={searchQuery}
              scopeFilter={scopeFilter}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

export default function DependencyTree({
  root,
  expandDepth = 2,
  showDevDeps = true,
  selectedPackage,
  scopeFilter: scopeFilterProp = 'all',
  searchQuery: searchQueryProp = '',
  children,
}: DependencyTreeProps) {
  const rootName = root?.name ?? '';
  const deps: DependencyNode[] = root?.dependencies ?? [];
  const scopeFilter = scopeFilterProp as ScopeFilter;
  const searchQuery = searchQueryProp;

  const visibleDeps = showDevDeps ? deps : deps.filter((d) => (d.type ?? 'prod') !== 'dev');
  const packageMap = collectPackages(visibleDeps);
  const counts = countByType(visibleDeps);
  const selectedName = selectedPackage ?? null;

  const state = selectedName ? 'nodeSelected' : (searchQuery ? 'filtering' : 'idle');

  const summaryParts: string[] = [];
  if (counts.prod > 0) summaryParts.push(`${counts.prod} prod`);
  if (counts.dev > 0) summaryParts.push(`${counts.dev} dev`);
  if (counts.peer > 0) summaryParts.push(`${counts.peer} peer`);
  if (counts.optional > 0) summaryParts.push(`${counts.optional} optional`);
  const summaryText = `${counts.total} packages${summaryParts.length > 0 ? ` (${summaryParts.join(', ')})` : ''}`;

  // Find selected node for detail panel
  function findNode(nodes: DependencyNode[], name: string): DependencyNode | null {
    for (const n of nodes) {
      if (n.name === name) return n;
      if (n.dependencies) {
        const found = findNode(n.dependencies, name);
        if (found) return found;
      }
    }
    return null;
  }
  const selectedNode = selectedName ? findNode(visibleDeps, selectedName) : null;

  const renderedDeps = visibleDeps.filter(
    (d) =>
      matchesScope(d, scopeFilter) &&
      (!searchQuery || matchesSearch(d, searchQuery)),
  );

  return (
    <div
      data-surface-widget=""
      data-widget-name="dependency-tree"
      data-part="root"
      data-state={state}
      aria-label={`Dependencies for ${rootName}`}
      role="group"
      tabIndex={0}
    >
      {/* Search bar */}
      <div data-part="search" data-state={state}>
        <input
          type="search"
          placeholder="Search dependencies..."
          defaultValue={searchQuery}
          aria-label="Search dependencies"
          style={{ width: '100%', padding: '6px 8px', boxSizing: 'border-box' }}
        />
      </div>

      {/* Scope filter chips */}
      <div data-part="scope-filter" data-state={state} role="radiogroup" aria-label="Filter by dependency type">
        {SCOPE_OPTIONS.map((scope) => (
          <button
            key={scope}
            type="button"
            role="radio"
            aria-checked={scopeFilter === scope}
            data-part="scope-chip"
            data-scope={scope}
            data-active={scopeFilter === scope ? 'true' : 'false'}
            style={{
              padding: '3px 10px',
              marginRight: '4px',
              border: '1px solid currentColor',
              borderRadius: '12px',
              background: scopeFilter === scope ? 'currentColor' : 'transparent',
              fontSize: '0.85em',
            }}
          >
            {scope}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div data-part="summary" aria-live="polite" style={{ padding: '6px 0', fontSize: '0.9em', opacity: 0.8 }}>
        {summaryText}
      </div>

      {/* Dependency tree */}
      <ul data-part="tree" data-state={state} role="tree" aria-label="Dependency tree" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {renderedDeps.map((dep, i) => (
          <TreeNodeItem
            key={`${dep.name}-${dep.version}-${i}`}
            node={dep}
            depth={0}
            expandDepth={expandDepth}
            packageMap={packageMap}
            selectedName={selectedName}
            searchQuery={searchQuery}
            scopeFilter={scopeFilter}
          />
        ))}
      </ul>

      {/* Detail panel */}
      <div
        data-part="detail"
        data-visible={state === 'nodeSelected' ? 'true' : 'false'}
        data-state={state}
        role="complementary"
        aria-label="Package details"
        style={{
          display: state === 'nodeSelected' && selectedNode ? 'block' : 'none',
          borderLeft: '1px solid',
          padding: '12px',
          marginTop: '8px',
        }}
      >
        {selectedNode && (
          <>
            <h3 data-part="detail-name">{selectedNode.name}</h3>
            <div data-part="detail-version">
              <strong>Version:</strong> {selectedNode.version}
            </div>
            {selectedNode.resolved && (
              <div data-part="detail-resolved">
                <strong>Resolved:</strong> {selectedNode.resolved}
              </div>
            )}
            <div data-part="detail-type">
              <strong>Type:</strong> {selectedNode.type ?? 'prod'}
            </div>
            {selectedNode.dependencies && selectedNode.dependencies.length > 0 && (
              <div data-part="detail-deps">
                <strong>Direct dependencies:</strong> {selectedNode.dependencies.length}
              </div>
            )}
            {(() => {
              const vers = packageMap.get(selectedNode.name) ?? [];
              const uniqueVersions = [...new Set(vers)];
              if (uniqueVersions.length > 1) {
                return (
                  <div data-part="detail-conflict" style={{ color: 'orange' }}>
                    <strong>Version conflict:</strong> {uniqueVersions.join(', ')}
                  </div>
                );
              }
              return null;
            })()}
          </>
        )}
      </div>

      {children}
    </div>
  );
}

export { DependencyTree };
