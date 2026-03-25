'use client';

/**
 * TreeDisplay — Hierarchical tree display type for ViewRenderer.
 *
 * Renders data rows as a nested tree. Expects either a `parent` / `parentId`
 * field for adjacency-list hierarchies, or uses `_children` / `hasChildren`
 * fields (pre-nested from the data source). Clicking a node triggers onRowClick.
 * Nodes are collapsible; all nodes start expanded.
 */

import React, { useMemo, useState, useCallback } from 'react';
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
}

function getIdField(fields: FieldConfig[]): string {
  const f = fields.find(f => /^(id|node|key|uuid)$/i.test(f.key));
  return f?.key ?? fields[0]?.key ?? 'id';
}

function getParentField(data: Record<string, unknown>[]): string | null {
  // Check if any row has parent-like fields
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

  // First pass: create nodes
  for (const row of data) {
    const id = String(row[idField] ?? '');
    byId.set(id, { row, children: [], depth: 0 });
  }

  // Second pass: wire children
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
        node.depth = parent.depth + 1;
      } else {
        roots.push(node); // orphan → treat as root
      }
    }
  }

  // Set depths recursively
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

interface TreeNodeViewProps {
  node: TreeNode;
  fields: FieldConfig[];
  idField: string;
  onRowClick?: (row: Record<string, unknown>) => void;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}

const TreeNodeView: React.FC<TreeNodeViewProps> = ({
  node, fields, idField, onRowClick, expanded, onToggle,
}) => {
  const id = String(node.row[idField] ?? '');
  const isExpanded = expanded.has(id);
  const hasChildren = node.children.length > 0
    || (node.row.hasChildren === true)
    || ((node.row._children as unknown[])?.length ?? 0) > 0;

  // Title: first non-id field
  const titleField = fields.find(f => f.key !== idField)?.key ?? idField;
  // Meta: second non-id field
  const metaField = fields.find(f => f.key !== idField && f.key !== titleField);

  return (
    <div>
      <div
        style={{
          display: 'flex', alignItems: 'center',
          paddingLeft: node.depth * 20,
          gap: 4,
        }}
      >
        {/* Expand/collapse toggle */}
        <button
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
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {isExpanded ? '▾' : '▸'}
        </button>

        {/* Node content */}
        <div
          onClick={() => onRowClick?.(node.row)}
          style={{
            flex: 1, display: 'flex', alignItems: 'center', gap: 8,
            padding: '4px 6px',
            borderRadius: 'var(--radius-sm)',
            cursor: onRowClick ? 'pointer' : 'default',
            background: 'transparent',
            transition: 'background 0.1s',
          }}
          onMouseEnter={e => {
            if (onRowClick) {
              (e.currentTarget as HTMLElement).style.background =
                'var(--palette-surface-variant)';
            }
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'transparent';
          }}
        >
          {/* Node icon */}
          <span style={{
            fontSize: '14px', opacity: 0.7,
            color: 'var(--palette-on-surface-variant)',
          }}>
            {hasChildren ? '📁' : '📄'}
          </span>

          {/* Primary label */}
          <span style={{
            fontSize: 'var(--typography-body-sm-size, 13px)',
            color: 'var(--palette-on-surface)',
            fontWeight: hasChildren ? 600 : 400,
            flex: 1,
          }}>
            {formatValue(node.row[titleField]) || '(untitled)'}
          </span>

          {/* Meta label */}
          {metaField && node.row[metaField.key] !== undefined && (
            <span style={{
              fontSize: '11px',
              color: 'var(--palette-on-surface-variant)',
              opacity: 0.7,
            }}>
              {formatValue(node.row[metaField.key])}
            </span>
          )}

          {/* Child count badge */}
          {hasChildren && (
            <span style={{
              fontSize: '10px', padding: '0 5px',
              borderRadius: 10,
              background: 'var(--palette-outline-variant)',
              color: 'var(--palette-on-surface-variant)',
              fontFamily: 'var(--typography-font-family-mono)',
            }}>
              {node.children.length || String(node.row.childCount ?? '')}
            </span>
          )}
        </div>
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {node.children.map((child, i) => (
            <TreeNodeView
              key={i}
              node={child}
              fields={fields}
              idField={idField}
              onRowClick={onRowClick}
              expanded={expanded}
              onToggle={onToggle}
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
    // No parent field — check for _children (pre-nested structure)
    if (data.some(r => Array.isArray(r._children))) {
      // Convert pre-nested format
      function nestRow(row: Record<string, unknown>, depth: number): TreeNode {
        const children = (row._children as Record<string, unknown>[] | undefined) ?? [];
        return {
          row,
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
    // Flat list — render as flat tree (all at root level)
    return data.map(row => ({ row, children: [], depth: 0 }));
  }, [data, idField, parentField]);

  // Expand all nodes by default
  const allIds = useMemo(() => {
    const ids = new Set<string>();
    function collect(nodes: TreeNode[]) {
      for (const n of nodes) {
        ids.add(String(n.row[idField] ?? ''));
        collect(n.children);
      }
    }
    collect(tree);
    return ids;
  }, [tree, idField]);

  const [expanded, setExpanded] = useState<Set<string>>(allIds);

  const toggle = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => setExpanded(allIds), [allIds]);
  const collapseAll = useCallback(() => setExpanded(new Set()), []);

  if (tree.length === 0) {
    return (
      <div style={{
        padding: 'var(--spacing-lg)', textAlign: 'center',
        color: 'var(--palette-on-surface-variant)',
      }}>
        No data to display
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{
        display: 'flex', gap: 'var(--spacing-xs)',
        marginBottom: 'var(--spacing-xs)',
        paddingBottom: 'var(--spacing-xs)',
        borderBottom: '1px solid var(--palette-outline-variant)',
      }}>
        <button
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
        <span style={{
          fontSize: '11px', color: 'var(--palette-on-surface-variant)',
          marginLeft: 'auto', alignSelf: 'center',
          fontFamily: 'var(--typography-font-family-mono)',
        }}>
          {data.length} node{data.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Tree nodes */}
      <div style={{
        background: 'var(--palette-surface)',
        border: '1px solid var(--palette-outline-variant)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        padding: 'var(--spacing-xs) 0',
      }}>
        {tree.map((node, i) => (
          <TreeNodeView
            key={i}
            node={node}
            fields={fields}
            idField={idField}
            onRowClick={onRowClick}
            expanded={expanded}
            onToggle={toggle}
          />
        ))}
      </div>
    </div>
  );
};

export default TreeDisplay;
