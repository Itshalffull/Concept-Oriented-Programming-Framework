export type DependencyTreeState = 'idle' | 'nodeSelected' | 'filtering';
export type DependencyTreeEvent =
  | { type: 'SELECT'; name?: string }
  | { type: 'EXPAND' }
  | { type: 'COLLAPSE' }
  | { type: 'SEARCH' }
  | { type: 'FILTER_SCOPE' }
  | { type: 'DESELECT' }
  | { type: 'CLEAR' };

export function dependencyTreeReducer(state: DependencyTreeState, event: DependencyTreeEvent): DependencyTreeState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT') return 'nodeSelected';
      if (event.type === 'EXPAND') return 'idle';
      if (event.type === 'COLLAPSE') return 'idle';
      if (event.type === 'SEARCH') return 'filtering';
      if (event.type === 'FILTER_SCOPE') return 'idle';
      return state;
    case 'nodeSelected':
      if (event.type === 'DESELECT') return 'idle';
      if (event.type === 'SELECT') return 'nodeSelected';
      return state;
    case 'filtering':
      if (event.type === 'CLEAR') return 'idle';
      return state;
    default:
      return state;
  }
}

import {
  forwardRef,
  useReducer,
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
  type HTMLAttributes,
  type ReactNode,
  type KeyboardEvent,
} from 'react';

// --- Types ---

export interface DependencyNode {
  name: string;
  version: string;
  resolved?: string;
  type?: 'prod' | 'dev' | 'peer' | 'optional';
  dependencies?: DependencyNode[];
}

export interface DependencyTreeProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  root: { name: string; version: string; dependencies?: DependencyNode[] };
  /** @deprecated Use root.name instead */
  rootPackage?: string;
  /** @deprecated Use root.dependencies instead */
  dependencies?: DependencyNode[];
  expandDepth?: number;
  showDevDeps?: boolean;
  showVulnerabilities?: boolean;
  selectedPackage?: string | undefined;
  children?: ReactNode;
}

type ScopeFilter = 'all' | 'prod' | 'dev' | 'peer' | 'optional';

// --- Helpers ---

/** Flatten tree to collect all package occurrences for duplicate/conflict detection */
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

/** Count packages by type */
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

/** Check if a node or any descendant matches the search query */
function matchesSearch(node: DependencyNode, query: string): boolean {
  const q = query.toLowerCase();
  if (node.name.toLowerCase().includes(q)) return true;
  if (node.version.toLowerCase().includes(q)) return true;
  if (node.dependencies) {
    return node.dependencies.some((child) => matchesSearch(child, q));
  }
  return false;
}

/** Filter nodes by scope */
function matchesScope(node: DependencyNode, scope: ScopeFilter): boolean {
  if (scope === 'all') return true;
  return (node.type ?? 'prod') === scope;
}

// --- Scope filter chips ---

const SCOPE_OPTIONS: ScopeFilter[] = ['all', 'prod', 'dev', 'peer', 'optional'];

// --- Tree node component ---

interface TreeNodeProps {
  node: DependencyNode;
  depth: number;
  expandDepth: number;
  packageMap: Map<string, string[]>;
  selectedName: string | null;
  focusedId: string;
  searchQuery: string;
  scopeFilter: ScopeFilter;
  onSelect: (name: string) => void;
  onFocusChange: (id: string) => void;
  nodeRefs: React.MutableRefObject<Map<string, HTMLLIElement>>;
  idPrefix: string;
  index: number;
}

function TreeNodeItem({
  node,
  depth,
  expandDepth,
  packageMap,
  selectedName,
  focusedId,
  searchQuery,
  scopeFilter,
  onSelect,
  onFocusChange,
  nodeRefs,
  idPrefix,
  index,
}: TreeNodeProps) {
  const nodeId = `${idPrefix}-${index}`;
  const [expanded, setExpanded] = useState(depth < expandDepth);
  const hasChildren = !!(node.dependencies && node.dependencies.length > 0);

  // Duplicate detection
  const versions = packageMap.get(node.name) ?? [];
  const isDuplicate = versions.length > 1;
  const hasConflict = isDuplicate && new Set(versions).size > 1;
  const isSelected = selectedName === node.name;
  const isFocused = focusedId === nodeId;

  // Filter by scope
  if (!matchesScope(node, scopeFilter)) return null;

  // Filter by search
  if (searchQuery && !matchesSearch(node, searchQuery)) return null;

  const typeBadgeLabel = node.type ?? 'prod';

  const filteredChildren = node.dependencies?.filter(
    (child) =>
      matchesScope(child, scopeFilter) &&
      (!searchQuery || matchesSearch(child, searchQuery))
  );

  return (
    <li
      ref={(el) => {
        if (el) nodeRefs.current.set(nodeId, el);
        else nodeRefs.current.delete(nodeId);
      }}
      role="treeitem"
      aria-expanded={hasChildren ? expanded : undefined}
      aria-selected={isSelected}
      aria-label={`${node.name}@${node.version}`}
      data-part="tree-node"
      data-scope={typeBadgeLabel}
      data-conflict={hasConflict ? 'true' : 'false'}
      data-duplicate={isDuplicate ? 'true' : 'false'}
      data-selected={isSelected ? 'true' : 'false'}
      data-focused={isFocused ? 'true' : 'false'}
      data-node-id={nodeId}
      tabIndex={isFocused ? 0 : -1}
      style={{ paddingLeft: `${depth * 20}px` }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(node.name);
        onFocusChange(nodeId);
      }}
      onFocus={() => onFocusChange(nodeId)}
    >
      <span
        data-part="tree-node-content"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
      >
        {/* Expand/collapse toggle */}
        {hasChildren && (
          <button
            type="button"
            aria-label={expanded ? 'Collapse' : 'Expand'}
            data-part="toggle"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '12px' }}
          >
            {expanded ? '\u25BE' : '\u25B8'}
          </button>
        )}
        {!hasChildren && (
          <span style={{ display: 'inline-block', width: '12px' }} />
        )}

        {/* Package name */}
        <span data-part="package-name">{node.name}</span>

        {/* Version badge */}
        <span data-part="version" style={{ fontSize: '0.85em', opacity: 0.8 }}>
          @{node.version}
        </span>

        {/* Type badge */}
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

        {/* Conflict icon */}
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

        {/* Duplicate badge */}
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

      {/* Children */}
      {hasChildren && expanded && filteredChildren && filteredChildren.length > 0 && (
        <ul role="group" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {filteredChildren.map((child, i) => (
            <TreeNodeItem
              key={`${child.name}-${child.version}-${i}`}
              node={child}
              depth={depth + 1}
              expandDepth={expandDepth}
              packageMap={packageMap}
              selectedName={selectedName}
              focusedId={focusedId}
              searchQuery={searchQuery}
              scopeFilter={scopeFilter}
              onSelect={onSelect}
              onFocusChange={onFocusChange}
              nodeRefs={nodeRefs}
              idPrefix={`${nodeId}-${i}`}
              index={i}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// --- Main component ---

const DependencyTree = forwardRef<HTMLDivElement, DependencyTreeProps>(function DependencyTree(
  {
    root,
    rootPackage: _rootPackage,
    dependencies: _deps,
    expandDepth = 2,
    showDevDeps = true,
    showVulnerabilities = true,
    selectedPackage: controlledSelected,
    children,
    ...restProps
  },
  ref,
) {
  const [state, send] = useReducer(dependencyTreeReducer, 'idle');
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [selectedName, setSelectedName] = useState<string | null>(controlledSelected ?? null);
  const [focusedId, setFocusedId] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const nodeRefs = useRef<Map<string, HTMLLIElement>>(new Map());

  // Resolve props: prefer `root`, fall back to deprecated separate props
  const rootName = root?.name ?? _rootPackage ?? '';
  const deps: DependencyNode[] = root?.dependencies ?? (_deps as DependencyNode[]) ?? [];

  // Filter dev deps if showDevDeps is false
  const visibleDeps = useMemo(() => {
    if (showDevDeps) return deps;
    return deps.filter((d) => (d.type ?? 'prod') !== 'dev');
  }, [deps, showDevDeps]);

  // Package map for duplicate/conflict detection
  const packageMap = useMemo(() => collectPackages(visibleDeps), [visibleDeps]);

  // Summary counts
  const counts = useMemo(() => countByType(visibleDeps), [visibleDeps]);

  // Build ordered list of visible node IDs for keyboard navigation
  const flatNodeIds = useMemo(() => {
    const ids: string[] = [];
    function walk(nodes: DependencyNode[], prefix: string) {
      nodes.forEach((node, i) => {
        if (!matchesScope(node, scopeFilter)) return;
        if (searchQuery && !matchesSearch(node, searchQuery)) return;
        const id = `${prefix}-${i}`;
        ids.push(id);
        if (node.dependencies) {
          walk(node.dependencies, `${id}-${i}`);
        }
      });
    }
    walk(visibleDeps, 'node');
    return ids;
  }, [visibleDeps, scopeFilter, searchQuery]);

  // Sync controlled selectedPackage
  useEffect(() => {
    if (controlledSelected !== undefined) {
      setSelectedName(controlledSelected);
      if (controlledSelected) {
        send({ type: 'SELECT', name: controlledSelected });
      } else {
        send({ type: 'DESELECT' });
      }
    }
  }, [controlledSelected]);

  const handleSelect = useCallback((name: string) => {
    setSelectedName((prev) => {
      if (prev === name) {
        send({ type: 'DESELECT' });
        return null;
      }
      send({ type: 'SELECT', name });
      return name;
    });
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    if (value) {
      send({ type: 'SEARCH' });
    } else {
      send({ type: 'CLEAR' });
    }
  }, []);

  const handleScopeChange = useCallback((scope: ScopeFilter) => {
    setScopeFilter(scope);
    send({ type: 'FILTER_SCOPE' });
  }, []);

  const handleFocusChange = useCallback((id: string) => {
    setFocusedId(id);
  }, []);

  // Focus the node element when focusedId changes
  useEffect(() => {
    if (focusedId) {
      const el = nodeRefs.current.get(focusedId);
      el?.focus();
    }
  }, [focusedId]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      const currentIdx = flatNodeIds.indexOf(focusedId);

      switch (e.key) {
        case 'ArrowDown': {
          e.preventDefault();
          const nextIdx = Math.min(currentIdx + 1, flatNodeIds.length - 1);
          if (flatNodeIds[nextIdx]) setFocusedId(flatNodeIds[nextIdx]);
          break;
        }
        case 'ArrowUp': {
          e.preventDefault();
          const prevIdx = Math.max(currentIdx - 1, 0);
          if (flatNodeIds[prevIdx]) setFocusedId(flatNodeIds[prevIdx]);
          break;
        }
        case 'ArrowRight': {
          e.preventDefault();
          // Expand is handled at the node level via toggle; dispatch for state machine
          send({ type: 'EXPAND' });
          const el = nodeRefs.current.get(focusedId);
          if (el) {
            const toggle = el.querySelector<HTMLButtonElement>('[data-part="toggle"]');
            if (toggle && el.getAttribute('aria-expanded') === 'false') toggle.click();
          }
          break;
        }
        case 'ArrowLeft': {
          e.preventDefault();
          send({ type: 'COLLAPSE' });
          const el = nodeRefs.current.get(focusedId);
          if (el) {
            const toggle = el.querySelector<HTMLButtonElement>('[data-part="toggle"]');
            if (toggle && el.getAttribute('aria-expanded') === 'true') toggle.click();
          }
          break;
        }
        case 'Enter': {
          e.preventDefault();
          const el = nodeRefs.current.get(focusedId);
          if (el) el.click();
          break;
        }
        case 'Escape': {
          e.preventDefault();
          setSelectedName(null);
          send({ type: 'DESELECT' });
          break;
        }
        case 'f': {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            searchInputRef.current?.focus();
          }
          break;
        }
      }
    },
    [flatNodeIds, focusedId],
  );

  // Summary text
  const summaryParts: string[] = [];
  if (counts.prod > 0) summaryParts.push(`${counts.prod} prod`);
  if (counts.dev > 0) summaryParts.push(`${counts.dev} dev`);
  if (counts.peer > 0) summaryParts.push(`${counts.peer} peer`);
  if (counts.optional > 0) summaryParts.push(`${counts.optional} optional`);
  const summaryText = `${counts.total} packages${summaryParts.length > 0 ? ` (${summaryParts.join(', ')})` : ''}`;

  // Selected node detail
  const selectedNode = useMemo(() => {
    if (!selectedName) return null;
    function find(nodes: DependencyNode[]): DependencyNode | null {
      for (const n of nodes) {
        if (n.name === selectedName) return n;
        if (n.dependencies) {
          const found = find(n.dependencies);
          if (found) return found;
        }
      }
      return null;
    }
    return find(visibleDeps);
  }, [selectedName, visibleDeps]);

  // Filter visible deps for rendering
  const renderedDeps = visibleDeps.filter(
    (d) =>
      matchesScope(d, scopeFilter) &&
      (!searchQuery || matchesSearch(d, searchQuery)),
  );

  return (
    <div
      ref={ref}
      data-surface-widget=""
      data-widget-name="dependency-tree"
      data-part="root"
      data-state={state}
      aria-label={`Dependencies for ${rootName}`}
      role="group"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      {...restProps}
    >
      {/* Search bar */}
      <div data-part="search" data-state={state}>
        <input
          ref={searchInputRef}
          type="search"
          placeholder="Search dependencies..."
          value={searchQuery}
          aria-label="Search dependencies"
          onChange={(e) => handleSearchChange(e.target.value)}
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
            onClick={() => handleScopeChange(scope)}
            style={{
              padding: '3px 10px',
              marginRight: '4px',
              border: '1px solid currentColor',
              borderRadius: '12px',
              background: scopeFilter === scope ? 'currentColor' : 'transparent',
              cursor: 'pointer',
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
            focusedId={focusedId}
            searchQuery={searchQuery}
            scopeFilter={scopeFilter}
            onSelect={handleSelect}
            onFocusChange={handleFocusChange}
            nodeRefs={nodeRefs}
            idPrefix={`node`}
            index={i}
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
              const versions = packageMap.get(selectedNode.name) ?? [];
              const uniqueVersions = [...new Set(versions)];
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
});

DependencyTree.displayName = 'DependencyTree';
export { DependencyTree };
export default DependencyTree;
