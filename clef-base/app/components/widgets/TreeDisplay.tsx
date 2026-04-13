'use client';

/**
 * TreeDisplay — Hierarchical tree display type for ViewRenderer.
 *
 * Renders data rows as a nested tree. Expects either a parentId / parent
 * field for adjacency-list hierarchies, or uses _children / hasChildren
 * fields (pre-nested from the data source). Clicking a node triggers onRowClick.
 * Nodes are collapsible; all nodes start expanded by default.
 *
 * Conforms to tree-display.widget spec (repertoire/widgets/data-display/tree-display.widget).
 * Implements WAI-ARIA tree pattern with treeitem roles, aria-expanded, aria-level,
 * aria-setsize, aria-posinset, and roving tabindex keyboard navigation.
 */

import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import type { FieldConfig } from './TableDisplay';

interface TreeDisplayProps {
  data: Record<string, unknown>[];
  fields: FieldConfig[];
  onRowClick?: (row: Record<string, unknown>) => void;
}

interface TreeNode {
  row: Record<string, unknown>;
  children: TreeNode[];
  depth: number;
  id: string;
}

function getIdField(fields: FieldConfig[]): string {
  const f = fields.find(f => /^(id|node|key|uuid)$/i.test(f.key));
  return f?.key ?? fields[0]?.key ?? 'id';
}

function getParentField(data: Record<string, unknown>[]): string | null {
  for (const row of data) {
    if ('parent' in row) return 'parent';
    if ('parentId' in row) return 'parentId';
    if ('parent_id' in row) return 'parent_id';
  }
  return null;
}

function buildTree(
  data: Record<string, unknown>[],
  idField: string,
  parentField: string,
): TreeNode[] {
  const byId = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const row of data) {
    const id = String(row[idField] ?? '');
    byId.set(id, { row, children: [], depth: 0, id });
  }

  for (const row of data) {
    const id = String(row[idField] ?? '');
    const parentId = row[parentField];
    const node = byId.get(id)!;
    if (!parentId || parentId === id) {
      roots.push(node);
    } else {
      const parent = byId.get(String(parentId));
      if (parent) {
        parent.children.push(node);
      } else {
        roots.push(node);
      }
    }
  }

  function setDepths(nodes: TreeNode[], depth: number) {
    for (const n of nodes) {
      n.depth = depth;
      setDepths(n.children, depth + 1);
    }
  }
  setDepths(roots, 0);

  return roots;
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Collect all node IDs in document order (visible nodes only, respecting expanded set) */
function collectVisibleIds(nodes: TreeNode[], expanded: Set<string>): string[] {
  const ids: string[] = [];
  for (const node of nodes) {
    ids.push(node.id);
    if (expanded.has(node.id) && node.children.length > 0) {
      ids.push(...collectVisibleIds(node.children, expanded));
    }
  }
  return ids;
}

/** Collect all node IDs recursively (regardless of expanded state) */
function collectAllIds(nodes: TreeNode[]): Set<string> {
  const ids = new Set<string>();
  for (const n of nodes) {
    ids.add(n.id);
    for (const id of collectAllIds(n.children)) ids.add(id);
  }
  return ids;
}

interface TreeNodeViewProps {
  node: TreeNode;
  fields: FieldConfig[];
  idField: string;
  onRowClick?: (row: Record<string, unknown>) => void;
  expanded: Set<string>;
  onToggle: (id: string) => void;
  focusedId: string | null;
  setFocusedId: (id: string) => void;
  onKeyDown: (e: React.KeyboardEvent, node: TreeNode) => void;
  siblingCount: number;
  positionInParent: number;
}

const TreeNodeView: React.FC<TreeNodeViewProps> = ({
  node, fields, idField, onRowClick, expanded, onToggle,
  focusedId, setFocusedId, onKeyDown, siblingCount, positionInParent,
}) => {
  const id = node.id;
  const isExpanded = expanded.has(id);
  const hasChildren = node.children.length > 0
    || (node.row.hasChildren === true)
    || ((node.row._children as unknown[])?.length ?? 0) > 0;

  const titleField = fields.find(f => f.key !== idField)?.key ?? idField;
  const metaField = fields.find(f => f.key !== idField && f.key !== titleField);

  const isFocused = focusedId === id;
  const nodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isFocused && nodeRef.current) {
      nodeRef.current.focus({ preventScroll: false });
    }
  }, [isFocused]);

  const label = formatValue(node.row[titleField]) || '(untitled)';

  return (
    <div
      data-part="tree-node"
      data-depth={node.depth}
      data-has-children={hasChildren ? 'true' : 'false'}
      data-state={isExpanded ? 'expanded' : 'collapsed'}
    >
      {/* Treeitem row */}
      <div
        ref={nodeRef}
        role="treeitem"
        aria-expanded={hasChildren ? isExpanded : undefined}
        aria-selected="false"
        aria-level={node.depth + 1}
        aria-setsize={siblingCount}
        aria-posinset={positionInParent}
        tabIndex={isFocused ? 0 : -1}
        style={{
          display: 'flex',
          alignItems: 'center',
          paddingLeft: node.depth * 20,
          gap: 4,
          outline: 'none',
        }}
        onFocus={() => setFocusedId(id)}
        onKeyDown={e => onKeyDown(e, node)}
        onClick={() => {
          setFocusedId(id);
          if (hasChildren) onToggle(id);
          onRowClick?.(node.row);
        }}
      >
        {/* Expand/collapse toggle */}
        <button
          data-part="expand-toggle"
          data-state={isExpanded ? 'expanded' : 'collapsed'}
          onClick={e => { e.stopPropagation(); onToggle(id); }}
          style={{
            width: 18, height: 18, borderRadius: 3,
            border: '1px solid var(--palette-outline-variant)',
            background: 'var(--palette-surface)',
            color: 'var(--palette-on-surface-variant)',
            cursor: hasChildren ? 'pointer' : 'default',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '10px', padding: 0, flexShrink: 0,
            opacity: hasChildren ? 1 : 0,
          }}
          disabled={!hasChildren}
          aria-hidden="true"
          tabIndex={-1}
        >
          {isExpanded ? '▾' : '▸'}
        </button>

        {/* Node content */}
        <div
          data-part="node-content"
          style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 8,
            padding: '4px 6px',
            borderRadius: 'var(--radius-sm)',
            cursor: onRowClick ? 'pointer' : 'default',
            background: isFocused ? 'var(--palette-surface-variant)' : 'transparent',
            transition: 'background 0.1s',
          }}
        >
          {/* Node icon */}
          <span
            data-part="node-icon"
            data-leaf={hasChildren ? 'false' : 'true'}
            aria-hidden="true"
            style={{
              fontSize: '14px', opacity: 0.7,
              color: 'var(--palette-on-surface-variant)',
            }}
          >
            {hasChildren ? '📁' : '📄'}
          </span>

          {/* Primary label */}
          <span
            data-part="node-label"
            style={{
              fontSize: 'var(--typography-body-sm-size, 13px)',
              color: 'var(--palette-on-surface)',
              fontWeight: hasChildren ? 600 : 400,
              flex: 1,
            }}
          >
            {label}
          </span>

          {/* Meta label */}
          {metaField && node.row[metaField.key] !== undefined && (
            <span
              data-part="node-meta"
              aria-hidden="true"
              style={{
                fontSize: '11px',
                color: 'var(--palette-on-surface-variant)',
                opacity: 0.7,
              }}
            >
              {formatValue(node.row[metaField.key])}
            </span>
          )}

          {/* Child count badge */}
          {hasChildren && (
            <span
              data-part="child-count-badge"
              aria-hidden="true"
              style={{
                fontSize: '10px', padding: '0 5px',
                borderRadius: 10,
                background: 'var(--palette-outline-variant)',
                color: 'var(--palette-on-surface-variant)',
                fontFamily: 'var(--typography-font-family-mono)',
              }}
            >
              {node.children.length || String(node.row.childCount ?? '')}
            </span>
          )}
        </div>
      </div>

      {/* Children container */}
      {hasChildren && (
        <div
          role="group"
          data-part="children-container"
          aria-label={`${label} children`}
          hidden={!isExpanded}
        >
          {isExpanded && node.children.map((child, i) => (
            <TreeNodeView
              key={child.id}
              node={child}
              fields={fields}
              idField={idField}
              onRowClick={onRowClick}
              expanded={expanded}
              onToggle={onToggle}
              focusedId={focusedId}
              setFocusedId={setFocusedId}
              onKeyDown={onKeyDown}
              siblingCount={node.children.length}
              positionInParent={i + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const TreeDisplay: React.FC<TreeDisplayProps> = ({ data, fields, onRowClick }) => {
  const idField = useMemo(() => getIdField(fields), [fields]);
  const parentField = useMemo(() => getParentField(data), [data]);

  const tree = useMemo(() => {
    if (parentField) {
      return buildTree(data, idField, parentField);
    }
    if (data.some(r => Array.isArray(r._children))) {
      function nestRow(row: Record<string, unknown>, depth: number): TreeNode {
        const children = (row._children as Record<string, unknown>[] | undefined) ?? [];
        const id = String(row[idField] ?? '');
        return {
          row,
          id,
          children: children.map(c => nestRow(c, depth + 1)),
          depth,
        };
      }
      const roots = data.filter(r => !data.some(
        other => (other._children as Record<string, unknown>[] | undefined)?.some(
          c => String(c[idField]) === String(r[idField]),
        ),
      ));
      return roots.map(r => nestRow(r, 0));
    }
    return data.map(row => ({ row, children: [], depth: 0, id: String(row[idField] ?? '') }));
  }, [data, idField, parentField]);

  const allIds = useMemo(() => collectAllIds(tree), [tree]);

  const [expanded, setExpanded] = useState<Set<string>>(allIds);

  const firstId = tree[0]?.id ?? null;
  const [focusedId, setFocusedId] = useState<string | null>(firstId);

  const toggle = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => setExpanded(new Set(allIds)), [allIds]);
  const collapseAll = useCallback(() => setExpanded(new Set()), []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, _node: TreeNode) => {
    // Arrow keys (ArrowLeft/Right/Up/Down), Enter, and Space are handled
    // declaratively via KeyBinding seeds (scope: app.tree — KB-20):
    //   clef-base/seeds/KeyBinding.tree.seeds.yaml
    // The useKeyBindings dispatcher routes those keys to the tree-nav
    // ActionBindings defined in ActionBinding.tree-nav.seeds.yaml.
    //
    // Home and End remain inline because they are not in the KB-20 seed set.
    const visibleIds = collectVisibleIds(tree, expanded);

    switch (e.key) {
      case 'Home': {
        e.preventDefault();
        const firstVisible = visibleIds[0];
        if (firstVisible) setFocusedId(firstVisible);
        break;
      }
      case 'End': {
        e.preventDefault();
        const lastVisible = visibleIds[visibleIds.length - 1];
        if (lastVisible) setFocusedId(lastVisible);
        break;
      }
    }
  }, [tree, expanded]);

  // Compute expansion state label for data-state
  const expansionState = useMemo(() => {
    if (expanded.size === 0) return 'allCollapsed';
    if (expanded.size >= allIds.size) return 'allExpanded';
    return 'partiallyExpanded';
  }, [expanded, allIds]);

  if (tree.length === 0) {
    return (
      <div
        data-part="empty-state"
        aria-live="polite"
        style={{
          padding: 'var(--spacing-lg)', textAlign: 'center',
          color: 'var(--palette-on-surface-variant)',
        }}
      >
        No data to display
      </div>
    );
  }

  return (
    <div
      data-part="root"
      data-state={expansionState}
      data-keybinding-scope="app.tree"
      aria-busy="false"
    >
      {/* Toolbar */}
      <div
        data-part="toolbar"
        style={{
          display: 'flex', gap: 'var(--spacing-xs)',
          marginBottom: 'var(--spacing-xs)',
          paddingBottom: 'var(--spacing-xs)',
          borderBottom: '1px solid var(--palette-outline-variant)',
        }}
      >
        <button
          data-part="expand-all-button"
          aria-label="Expand all nodes"
          onClick={expandAll}
          style={{
            padding: '2px 8px', fontSize: '11px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--palette-outline-variant)',
            background: 'var(--palette-surface)',
            color: 'var(--palette-on-surface-variant)',
            cursor: 'pointer',
          }}
        >
          Expand all
        </button>
        <button
          data-part="collapse-all-button"
          aria-label="Collapse all nodes"
          onClick={collapseAll}
          style={{
            padding: '2px 8px', fontSize: '11px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--palette-outline-variant)',
            background: 'var(--palette-surface)',
            color: 'var(--palette-on-surface-variant)',
            cursor: 'pointer',
          }}
        >
          Collapse all
        </button>
        <span
          data-part="node-count"
          aria-live="polite"
          style={{
            fontSize: '11px', color: 'var(--palette-on-surface-variant)',
            marginLeft: 'auto', alignSelf: 'center',
            fontFamily: 'var(--typography-font-family-mono)',
          }}
        >
          {data.length} node{data.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tree */}
      <div
        role="tree"
        aria-label="Tree"
        data-part="tree"
        style={{
          background: 'var(--palette-surface)',
          border: '1px solid var(--palette-outline-variant)',
          borderRadius: 'var(--radius-md)',
          overflow: 'hidden',
          padding: 'var(--spacing-xs) 0',
        }}
      >
        {tree.map((node, i) => (
          <TreeNodeView
            key={node.id}
            node={node}
            fields={fields}
            idField={idField}
            onRowClick={onRowClick}
            expanded={expanded}
            onToggle={toggle}
            focusedId={focusedId}
            setFocusedId={setFocusedId}
            onKeyDown={handleKeyDown}
            siblingCount={tree.length}
            positionInParent={i + 1}
          />
        ))}
      </div>
    </div>
  );
};

export default TreeDisplay;
