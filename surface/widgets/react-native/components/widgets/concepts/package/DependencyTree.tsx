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

import React, { forwardRef, useReducer, useState, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import { View, Text, Pressable, TextInput, ScrollView, StyleSheet } from 'react-native';

export interface DependencyNode {
  name: string;
  version: string;
  resolved?: string;
  type?: 'prod' | 'dev' | 'peer' | 'optional';
  dependencies?: DependencyNode[];
}

export interface DependencyTreeProps {
  root: { name: string; version: string; dependencies?: DependencyNode[] };
  rootPackage?: string;
  dependencies?: DependencyNode[];
  expandDepth?: number;
  showDevDeps?: boolean;
  showVulnerabilities?: boolean;
  selectedPackage?: string | undefined;
  children?: ReactNode;
}

type ScopeFilter = 'all' | 'prod' | 'dev' | 'peer' | 'optional';

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

interface TreeNodeProps {
  node: DependencyNode;
  depth: number;
  expandDepth: number;
  packageMap: Map<string, string[]>;
  selectedName: string | null;
  searchQuery: string;
  scopeFilter: ScopeFilter;
  onSelect: (name: string) => void;
}

function TreeNodeItem({ node, depth, expandDepth, packageMap, selectedName, searchQuery, scopeFilter, onSelect }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(depth < expandDepth);
  const hasChildren = !!(node.dependencies && node.dependencies.length > 0);
  const versions = packageMap.get(node.name) ?? [];
  const isDuplicate = versions.length > 1;
  const hasConflict = isDuplicate && new Set(versions).size > 1;
  const isSelected = selectedName === node.name;
  const typeBadgeLabel = node.type ?? 'prod';

  if (!matchesScope(node, scopeFilter)) return null;
  if (searchQuery && !matchesSearch(node, searchQuery)) return null;

  const filteredChildren = node.dependencies?.filter(
    (child) => matchesScope(child, scopeFilter) && (!searchQuery || matchesSearch(child, searchQuery)),
  );

  return (
    <View style={{ paddingLeft: depth * 16 }}>
      <Pressable
        onPress={() => onSelect(node.name)}
        accessibilityRole="none"
        accessibilityLabel={`${node.name}@${node.version}`}
        style={[s.treeNode, isSelected && s.treeNodeSelected]}
      >
        <View style={s.treeNodeContent}>
          {hasChildren ? (
            <Pressable onPress={() => setExpanded(!expanded)} accessibilityRole="button" accessibilityLabel={expanded ? 'Collapse' : 'Expand'}>
              <Text style={s.toggleIcon}>{expanded ? '\u25BE' : '\u25B8'}</Text>
            </Pressable>
          ) : (
            <View style={s.toggleSpacer} />
          )}
          <Text style={s.packageName}>{node.name}</Text>
          <Text style={s.versionText}>@{node.version}</Text>
          <View style={s.scopeBadge}>
            <Text style={s.scopeBadgeText}>{typeBadgeLabel}</Text>
          </View>
          {hasConflict && (
            <Text style={s.conflictIcon} accessibilityLabel="Version conflict">{'\u26A0'}</Text>
          )}
          {isDuplicate && (
            <Text style={s.dupBadge} accessibilityLabel={`Duplicate: appears ${versions.length} times`}>x{versions.length}</Text>
          )}
        </View>
      </Pressable>

      {hasChildren && expanded && filteredChildren && filteredChildren.length > 0 && (
        <View>
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
              onSelect={onSelect}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const DependencyTree = forwardRef<View, DependencyTreeProps>(function DependencyTree(
  {
    root,
    rootPackage: _rootPackage,
    dependencies: _deps,
    expandDepth = 2,
    showDevDeps = true,
    selectedPackage: controlledSelected,
    children,
  },
  ref,
) {
  const [state, send] = useReducer(dependencyTreeReducer, 'idle');
  const [searchQuery, setSearchQuery] = useState('');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');
  const [selectedName, setSelectedName] = useState<string | null>(controlledSelected ?? null);

  const rootName = root?.name ?? _rootPackage ?? '';
  const deps: DependencyNode[] = root?.dependencies ?? (_deps as DependencyNode[]) ?? [];

  const visibleDeps = useMemo(() => {
    if (showDevDeps) return deps;
    return deps.filter((d) => (d.type ?? 'prod') !== 'dev');
  }, [deps, showDevDeps]);

  const packageMap = useMemo(() => collectPackages(visibleDeps), [visibleDeps]);
  const counts = useMemo(() => countByType(visibleDeps), [visibleDeps]);

  useEffect(() => {
    if (controlledSelected !== undefined) {
      setSelectedName(controlledSelected);
      if (controlledSelected) send({ type: 'SELECT', name: controlledSelected });
      else send({ type: 'DESELECT' });
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
    if (value) send({ type: 'SEARCH' });
    else send({ type: 'CLEAR' });
  }, []);

  const handleScopeChange = useCallback((scope: ScopeFilter) => {
    setScopeFilter(scope);
    send({ type: 'FILTER_SCOPE' });
  }, []);

  const summaryParts: string[] = [];
  if (counts.prod > 0) summaryParts.push(`${counts.prod} prod`);
  if (counts.dev > 0) summaryParts.push(`${counts.dev} dev`);
  if (counts.peer > 0) summaryParts.push(`${counts.peer} peer`);
  if (counts.optional > 0) summaryParts.push(`${counts.optional} optional`);
  const summaryText = `${counts.total} packages${summaryParts.length > 0 ? ` (${summaryParts.join(', ')})` : ''}`;

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

  const renderedDeps = visibleDeps.filter(
    (d) => matchesScope(d, scopeFilter) && (!searchQuery || matchesSearch(d, searchQuery)),
  );

  return (
    <View ref={ref} testID="dependency-tree" accessibilityRole="none" accessibilityLabel={`Dependencies for ${rootName}`} style={s.root}>
      {/* Search */}
      <TextInput
        style={s.searchInput}
        placeholder="Search dependencies..."
        value={searchQuery}
        onChangeText={handleSearchChange}
        accessibilityLabel="Search dependencies"
      />

      {/* Scope filter chips */}
      <View style={s.scopeRow} accessibilityRole="none" accessibilityLabel="Filter by dependency type">
        {SCOPE_OPTIONS.map((scope) => (
          <Pressable
            key={scope}
            onPress={() => handleScopeChange(scope)}
            accessibilityRole="radio"
            accessibilityState={{ checked: scopeFilter === scope }}
            style={[s.scopeChip, scopeFilter === scope && s.scopeChipActive]}
          >
            <Text style={[s.scopeChipText, scopeFilter === scope && s.scopeChipTextActive]}>{scope}</Text>
          </Pressable>
        ))}
      </View>

      {/* Summary */}
      <Text style={s.summary}>{summaryText}</Text>

      {/* Tree */}
      <ScrollView style={s.treeContainer}>
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
            onSelect={handleSelect}
          />
        ))}
      </ScrollView>

      {/* Detail panel */}
      {state === 'nodeSelected' && selectedNode && (
        <View style={s.detail} accessibilityRole="none" accessibilityLabel="Package details">
          <Text style={s.detailName}>{selectedNode.name}</Text>
          <Text style={s.detailLine}>Version: {selectedNode.version}</Text>
          {selectedNode.resolved && <Text style={s.detailLine}>Resolved: {selectedNode.resolved}</Text>}
          <Text style={s.detailLine}>Type: {selectedNode.type ?? 'prod'}</Text>
          {selectedNode.dependencies && selectedNode.dependencies.length > 0 && (
            <Text style={s.detailLine}>Direct dependencies: {selectedNode.dependencies.length}</Text>
          )}
          {(() => {
            const versions = packageMap.get(selectedNode.name) ?? [];
            const uniqueVersions = [...new Set(versions)];
            if (uniqueVersions.length > 1) {
              return <Text style={s.conflictText}>Version conflict: {uniqueVersions.join(', ')}</Text>;
            }
            return null;
          })()}
        </View>
      )}

      {children}
    </View>
  );
});

const s = StyleSheet.create({
  root: { padding: 12 },
  searchInput: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 6, padding: 8, fontSize: 14, marginBottom: 8 },
  scopeRow: { flexDirection: 'row', gap: 4, marginBottom: 8 },
  scopeChip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, borderWidth: 1, borderColor: '#d1d5db' },
  scopeChipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  scopeChipText: { fontSize: 12, color: '#374151' },
  scopeChipTextActive: { color: '#fff' },
  summary: { fontSize: 13, color: '#6b7280', marginBottom: 8 },
  treeContainer: { flex: 1 },
  treeNode: { paddingVertical: 4 },
  treeNodeSelected: { backgroundColor: '#ede9fe', borderRadius: 4 },
  treeNodeContent: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  toggleIcon: { fontSize: 12, width: 14, textAlign: 'center' },
  toggleSpacer: { width: 14 },
  packageName: { fontSize: 13, fontWeight: '600' },
  versionText: { fontSize: 12, opacity: 0.7 },
  scopeBadge: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 3, paddingHorizontal: 4, paddingVertical: 0 },
  scopeBadgeText: { fontSize: 10, color: '#6b7280' },
  conflictIcon: { color: '#f59e0b', fontSize: 12 },
  dupBadge: { fontSize: 10, color: '#6b7280' },
  detail: { borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 12, marginTop: 12 },
  detailName: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  detailLine: { fontSize: 13, marginBottom: 2 },
  conflictText: { fontSize: 13, color: '#f59e0b', marginTop: 4 },
});

DependencyTree.displayName = 'DependencyTree';
export { DependencyTree };
export default DependencyTree;
