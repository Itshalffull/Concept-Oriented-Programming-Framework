'use client';

/**
 * LayoutBuilderView — Visual editor for composing SplitLayout trees.
 *
 * Canvas showing the split tree as nested resizable boxes.
 * Click a leaf to assign a View/Layout to it.
 * Add/remove splits via toolbar. Configure dock zones and their rules.
 * Save as a Workspace or named Layout entity.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Card } from '../components/widgets/Card';
import { Badge } from '../components/widgets/Badge';
import { EmptyState } from '../components/widgets/EmptyState';
import { useKernelInvoke, useNavigator } from '../../lib/clef-provider';
import { useConceptQuery } from '../../lib/use-concept-query';

interface TreeNode {
  id: string;
  type: 'split' | 'leaf';
  direction?: 'horizontal' | 'vertical';
  ratio?: number;
  children?: [string, string];
  contentRef?: string;
}

let nodeIdCounter = 0;
function nextNodeId(): string {
  return `node-${++nodeIdCounter}`;
}

function createLeaf(contentRef?: string): TreeNode {
  return { id: nextNodeId(), type: 'leaf', contentRef };
}

function createSplit(direction: 'horizontal' | 'vertical', first: TreeNode, second: TreeNode): TreeNode {
  return {
    id: nextNodeId(),
    type: 'split',
    direction,
    ratio: 0.5,
    children: [first.id, second.id],
  };
}

// ---------------------------------------------------------------------------
// TreeCanvas — recursive visual representation of the tree
// ---------------------------------------------------------------------------

interface TreeCanvasProps {
  node: TreeNode;
  nodes: Map<string, TreeNode>;
  selectedId: string | null;
  onSelect: (id: string) => void;
  depth: number;
}

const TreeCanvas: React.FC<TreeCanvasProps> = ({ node, nodes, selectedId, onSelect, depth }) => {
  if (node.type === 'leaf') {
    const isSelected = node.id === selectedId;
    return (
      <div
        onClick={(e) => { e.stopPropagation(); onSelect(node.id); }}
        style={{
          flex: 1,
          minWidth: 80,
          minHeight: 60,
          border: `2px ${isSelected ? 'solid' : 'dashed'} ${isSelected ? 'var(--palette-primary)' : 'var(--palette-outline-variant)'}`,
          borderRadius: 'var(--radius-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          background: isSelected ? 'var(--palette-primary-container)' : 'var(--palette-surface-container)',
          fontSize: '12px',
          color: 'var(--palette-on-surface-variant)',
          padding: '8px',
          textAlign: 'center',
        }}
      >
        {node.contentRef || 'Empty — click to assign'}
      </div>
    );
  }

  const [firstId, secondId] = node.children ?? ['', ''];
  const firstNode = nodes.get(firstId);
  const secondNode = nodes.get(secondId);
  const isHorizontal = node.direction === 'horizontal';

  return (
    <div style={{
      display: 'flex',
      flexDirection: isHorizontal ? 'row' : 'column',
      gap: '4px',
      flex: 1,
      minWidth: 0,
      minHeight: 0,
    }}>
      {firstNode && <TreeCanvas node={firstNode} nodes={nodes} selectedId={selectedId} onSelect={onSelect} depth={depth + 1} />}
      <div style={{
        flex: '0 0 4px',
        background: 'var(--palette-outline)',
        borderRadius: '2px',
        alignSelf: 'stretch',
      }} />
      {secondNode && <TreeCanvas node={secondNode} nodes={nodes} selectedId={selectedId} onSelect={onSelect} depth={depth + 1} />}
    </div>
  );
};

// ---------------------------------------------------------------------------
// LayoutBuilderView
// ---------------------------------------------------------------------------

export const LayoutBuilderView: React.FC = () => {
  const invoke = useKernelInvoke();
  const { navigateToHref } = useNavigator();

  // Load available views for the leaf assignment picker
  const { data: viewsRaw } = useConceptQuery<Record<string, unknown>>('View', 'list', {});
  const availableViews: string[] = useMemo(() => {
    if (!viewsRaw) return [];
    const raw = viewsRaw as Record<string, unknown>;
    if (typeof raw.items === 'string') {
      try {
        const items = JSON.parse(raw.items) as Array<Record<string, unknown>>;
        return items.map(v => v.view as string).filter(Boolean);
      } catch { return []; }
    }
    return [];
  }, [viewsRaw]);

  // Tree state
  const [nodes, setNodes] = useState<Map<string, TreeNode>>(() => {
    const leaf = createLeaf();
    return new Map([[leaf.id, leaf]]);
  });
  const [rootId, setRootId] = useState<string>(() => nodes.keys().next().value!);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [layoutName, setLayoutName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSplitH = useCallback(() => {
    if (!selectedId) return;
    const selectedNode = nodes.get(selectedId);
    if (!selectedNode || selectedNode.type !== 'leaf') return;

    const newLeaf = createLeaf();
    const splitNode = createSplit('horizontal', selectedNode, newLeaf);
    const updated = new Map(nodes);
    updated.set(newLeaf.id, newLeaf);
    updated.set(splitNode.id, splitNode);

    // Replace references to selectedId with splitNode.id
    if (rootId === selectedId) {
      setRootId(splitNode.id);
    } else {
      for (const [, node] of updated) {
        if (node.type === 'split' && node.children) {
          if (node.children[0] === selectedId) node.children[0] = splitNode.id;
          if (node.children[1] === selectedId) node.children[1] = splitNode.id;
        }
      }
    }
    setNodes(updated);
    setSelectedId(newLeaf.id);
  }, [selectedId, nodes, rootId]);

  const handleSplitV = useCallback(() => {
    if (!selectedId) return;
    const selectedNode = nodes.get(selectedId);
    if (!selectedNode || selectedNode.type !== 'leaf') return;

    const newLeaf = createLeaf();
    const splitNode = createSplit('vertical', selectedNode, newLeaf);
    const updated = new Map(nodes);
    updated.set(newLeaf.id, newLeaf);
    updated.set(splitNode.id, splitNode);

    if (rootId === selectedId) {
      setRootId(splitNode.id);
    } else {
      for (const [, node] of updated) {
        if (node.type === 'split' && node.children) {
          if (node.children[0] === selectedId) node.children[0] = splitNode.id;
          if (node.children[1] === selectedId) node.children[1] = splitNode.id;
        }
      }
    }
    setNodes(updated);
    setSelectedId(newLeaf.id);
  }, [selectedId, nodes, rootId]);

  const handleAssignView = useCallback((viewId: string) => {
    if (!selectedId) return;
    const updated = new Map(nodes);
    const node = updated.get(selectedId);
    if (node && node.type === 'leaf') {
      updated.set(selectedId, { ...node, contentRef: `view:${viewId}` });
      setNodes(updated);
    }
  }, [selectedId, nodes]);

  const handleSave = useCallback(async () => {
    if (!layoutName.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const tree = JSON.stringify(Array.from(nodes.values()));
      const result = await invoke('SplitLayout', 'create', {
        layout: layoutName,
        name: layoutName,
        tree,
      });
      if (result.variant === 'ok') {
        navigateToHref('/admin/layout-builder');
      } else {
        setSaveError((result.message as string | undefined) ?? 'Failed to save layout.');
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save layout.');
    } finally {
      setSaving(false);
    }
  }, [invoke, layoutName, navigateToHref, nodes]);

  const rootNode = nodes.get(rootId);
  const selectedNode = selectedId ? nodes.get(selectedId) : null;

  return (
    <div>
      <div className="page-header">
        <h1>Layout Builder</h1>
        <Badge variant="info">{nodes.size} nodes</Badge>
      </div>
      <p style={{ color: 'var(--palette-on-surface-variant)', marginBottom: 'var(--spacing-lg)' }}>
        Build a split layout by selecting leaves and splitting them. Assign views to each leaf.
      </p>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-md)', flexWrap: 'wrap' }}>
        <button data-part="button" data-variant="outlined" onClick={handleSplitH} disabled={!selectedId || selectedNode?.type !== 'leaf'}>
          Split Horizontal ⬌
        </button>
        <button data-part="button" data-variant="outlined" onClick={handleSplitV} disabled={!selectedId || selectedNode?.type !== 'leaf'}>
          Split Vertical ⬍
        </button>
        <div style={{ flex: 1 }} />
        <input
          value={layoutName}
          onChange={(e) => setLayoutName(e.target.value)}
          placeholder="Layout name..."
          style={{
            padding: '6px 12px', border: '1px solid var(--palette-outline-variant)',
            borderRadius: 'var(--radius-sm)', background: 'var(--palette-surface)',
            color: 'var(--palette-on-surface)',
          }}
        />
        <button data-part="button" data-variant="filled" onClick={handleSave} disabled={saving || !layoutName.trim()}>
          {saving ? 'Saving...' : 'Save Layout'}
        </button>
      </div>
      {saveError && (
        <div style={{
          marginBottom: 'var(--spacing-sm)',
          padding: '6px 12px',
          background: 'var(--palette-error-container)',
          color: 'var(--palette-on-error-container)',
          borderRadius: 'var(--radius-sm)',
          fontSize: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
        }}>
          <span>{saveError}</span>
          <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: 13, lineHeight: 1 }} onClick={() => setSaveError(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      {/* Canvas */}
      <Card variant="outlined" style={{ padding: 'var(--spacing-md)', minHeight: 400 }}>
        {rootNode ? (
          <TreeCanvas node={rootNode} nodes={nodes} selectedId={selectedId} onSelect={setSelectedId} depth={0} />
        ) : (
          <EmptyState title="Empty layout" description="Add a split to get started." />
        )}
      </Card>

      {/* Leaf config panel */}
      {selectedNode?.type === 'leaf' && (
        <Card variant="outlined" style={{ padding: 'var(--spacing-md)', marginTop: 'var(--spacing-md)' }}>
          <h3 style={{ margin: 0, marginBottom: 'var(--spacing-sm)' }}>Leaf Configuration</h3>
          <div style={{ display: 'flex', gap: 'var(--spacing-sm)', alignItems: 'center' }}>
            <label style={{ fontSize: '13px', color: 'var(--palette-on-surface-variant)' }}>Assign View:</label>
            <select
              value={selectedNode.contentRef?.replace('view:', '') ?? ''}
              onChange={(e) => handleAssignView(e.target.value)}
              style={{
                padding: '4px 8px', border: '1px solid var(--palette-outline-variant)',
                borderRadius: 'var(--radius-sm)', background: 'var(--palette-surface)',
                color: 'var(--palette-on-surface)',
              }}
            >
              <option value="">— Select a view —</option>
              {availableViews.map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
          </div>
        </Card>
      )}
    </div>
  );
};

export default LayoutBuilderView;
