'use client';

/**
 * SplitLayoutRenderer — Recursively renders a SplitLayout tree.
 *
 * Split nodes → nested flex containers with Splitter dividers.
 * Leaf nodes → TabGroup (using tab UI) containing Pane content.
 * Each pane renders its Host's mounted view via ViewRenderer/LayoutRenderer.
 *
 * Connects to concepts:
 * - SplitLayout/getTree → provides the tree structure
 * - SplitLayout/resize → handles divider drag
 * - TabGroup/get → provides tab list and active tab
 * - TabGroup/activateTab → handles tab click
 * - TabGroup/addTab → handles new tab creation
 * - TabGroup/removeTab → handles tab close
 * - TabGroup/moveTab → handles tab reorder
 * - Pane/get → provides pane title, icon, status
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useKernelInvoke } from '../../lib/clef-provider';
import { useConceptQuery } from '../../lib/use-concept-query';
import { ViewRenderer } from './ViewRenderer';
import { LayoutRenderer } from './LayoutRenderer';
import { HostedPage } from './HostedPage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TreeNode {
  id: string;
  type: 'split' | 'leaf';
  direction?: 'horizontal' | 'vertical';
  ratio?: number;
  children?: [string, string];
  contentRef?: string;
  collapsed?: boolean;
}

interface TabInfo {
  paneId: string;
  title: string;
  icon?: string;
  pinned: boolean;
  status: string;
}

// ---------------------------------------------------------------------------
// SplitNode — renders a split with two children and a draggable divider
// ---------------------------------------------------------------------------

interface SplitNodeProps {
  node: TreeNode;
  nodes: Map<string, TreeNode>;
  layoutId: string;
}

const SplitNode: React.FC<SplitNodeProps> = ({ node, nodes, layoutId }) => {
  const invoke = useKernelInvoke();
  const [ratio, setRatio] = useState(node.ratio ?? 0.5);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const isHorizontal = node.direction === 'horizontal';
  const [firstId, secondId] = node.children ?? ['', ''];
  const firstNode = nodes.get(firstId);
  const secondNode = nodes.get(secondId);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newRatio = isHorizontal
        ? (moveEvent.clientX - rect.left) / rect.width
        : (moveEvent.clientY - rect.top) / rect.height;
      const clamped = Math.max(0.1, Math.min(0.9, newRatio));
      setRatio(clamped);
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      // Persist the new ratio
      invoke('SplitLayout', 'resize', {
        layout: layoutId,
        splitId: node.id,
        ratio,
      }).catch(() => {});
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [invoke, isHorizontal, layoutId, node.id, ratio]);

  if (!firstNode || !secondNode) return null;

  const firstCollapsed = node.collapsed === true;
  const secondCollapsed = false; // TODO: support per-side collapse

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: isHorizontal ? 'row' : 'column',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
      }}
      data-split-id={node.id}
      data-direction={node.direction}
    >
      {/* First child */}
      <div style={{
        flex: firstCollapsed ? '0 0 0px' : `0 0 ${ratio * 100}%`,
        overflow: 'hidden',
        display: firstCollapsed ? 'none' : 'flex',
      }}>
        <TreeNodeRenderer node={firstNode} nodes={nodes} layoutId={layoutId} />
      </div>

      {/* Divider */}
      <div
        role="separator"
        aria-orientation={isHorizontal ? 'vertical' : 'horizontal'}
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuemin={10}
        aria-valuemax={90}
        onMouseDown={handleMouseDown}
        style={{
          flex: '0 0 4px',
          background: 'var(--palette-outline-variant)',
          cursor: isHorizontal ? 'col-resize' : 'row-resize',
          transition: 'background 0.15s',
        }}
        onMouseEnter={(e) => {
          (e.target as HTMLElement).style.background = 'var(--palette-primary)';
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLElement).style.background = 'var(--palette-outline-variant)';
        }}
      />

      {/* Second child */}
      <div style={{
        flex: secondCollapsed ? '0 0 0px' : '1',
        overflow: 'hidden',
        display: secondCollapsed ? 'none' : 'flex',
      }}>
        <TreeNodeRenderer node={secondNode} nodes={nodes} layoutId={layoutId} />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// LeafNode — renders a TabGroup with pane content
// ---------------------------------------------------------------------------

interface LeafNodeProps {
  node: TreeNode;
  layoutId: string;
}

const LeafNode: React.FC<LeafNodeProps> = ({ node }) => {
  const invoke = useKernelInvoke();
  const tabGroupId = node.contentRef;

  // Load tab group data
  const { data: tabGroupData } = useConceptQuery<Record<string, unknown>>(
    tabGroupId ? 'TabGroup' : '__none__',
    tabGroupId ? 'get' : '__none__',
    tabGroupId ? { group: tabGroupId } : undefined,
  );

  const tabs: string[] = (() => {
    if (!tabGroupData) return [];
    const raw = tabGroupData.tabs;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return []; }
    }
    return Array.isArray(raw) ? raw : [];
  })();

  const activeTab = tabGroupData?.activeTab as string | undefined;

  const handleActivate = useCallback((paneId: string) => {
    if (tabGroupId) {
      invoke('TabGroup', 'activateTab', { group: tabGroupId, paneId }).catch(() => {});
    }
  }, [invoke, tabGroupId]);

  const handleClose = useCallback((paneId: string) => {
    if (tabGroupId) {
      invoke('TabGroup', 'removeTab', { group: tabGroupId, paneId }).catch(() => {});
    }
  }, [invoke, tabGroupId]);

  if (!tabGroupId || tabs.length === 0) {
    return (
      <div style={{
        width: '100%', height: '100%',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--palette-on-surface-variant)',
        fontSize: '14px',
      }}>
        Empty pane — drag a view here
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Tab bar */}
      <div
        role="tablist"
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--palette-outline-variant)',
          background: 'var(--palette-surface)',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {tabs.map((paneId) => (
          <TabButton
            key={paneId}
            paneId={paneId}
            isActive={paneId === activeTab}
            onActivate={() => handleActivate(paneId)}
            onClose={() => handleClose(paneId)}
          />
        ))}
      </div>

      {/* Active tab content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab && <PaneContent paneId={activeTab} />}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// TabButton — single tab in the tab bar
// ---------------------------------------------------------------------------

interface TabButtonProps {
  paneId: string;
  isActive: boolean;
  onActivate: () => void;
  onClose: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ paneId, isActive, onActivate, onClose }) => {
  const { data: paneData } = useConceptQuery<Record<string, unknown>>(
    'Pane', 'get', { pane: paneId },
  );

  const title = (paneData?.title as string) ?? paneId;
  const icon = paneData?.icon as string | undefined;
  const pinned = paneData?.pinned === true;

  return (
    <div
      role="tab"
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      onClick={onActivate}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '6px 12px',
        fontSize: '12px',
        cursor: 'pointer',
        borderBottom: isActive ? '2px solid var(--palette-primary)' : '2px solid transparent',
        background: isActive ? 'var(--palette-surface-container)' : 'transparent',
        color: isActive ? 'var(--palette-on-surface)' : 'var(--palette-on-surface-variant)',
        whiteSpace: 'nowrap',
        userSelect: 'none',
      }}
    >
      {icon && <span>{icon}</span>}
      <span>{title}</span>
      {!pinned && (
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          aria-label={`Close ${title}`}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'inherit', fontSize: '14px', lineHeight: 1,
            padding: '0 2px', opacity: 0.5,
          }}
        >
          ×
        </button>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// PaneContent — renders the content of a single pane via its hostRef
// ---------------------------------------------------------------------------

const PaneContent: React.FC<{ paneId: string }> = ({ paneId }) => {
  const { data: paneData } = useConceptQuery<Record<string, unknown>>(
    'Pane', 'get', { pane: paneId },
  );

  const hostRef = paneData?.hostRef as string | undefined;
  if (!hostRef) return null;

  // hostRef format: "view:<viewId>" or "layout:<layoutId>"
  if (hostRef.startsWith('view:')) {
    return (
      <HostedPage>
        <ViewRenderer viewId={hostRef.slice(5)} />
      </HostedPage>
    );
  }
  if (hostRef.startsWith('layout:')) {
    return (
      <HostedPage>
        <LayoutRenderer layoutId={hostRef.slice(7)} />
      </HostedPage>
    );
  }

  // Fallback: treat as viewId
  return (
    <HostedPage>
      <ViewRenderer viewId={hostRef} />
    </HostedPage>
  );
};

// ---------------------------------------------------------------------------
// TreeNodeRenderer — dispatches to SplitNode or LeafNode
// ---------------------------------------------------------------------------

interface TreeNodeRendererProps {
  node: TreeNode;
  nodes: Map<string, TreeNode>;
  layoutId: string;
}

const TreeNodeRenderer: React.FC<TreeNodeRendererProps> = ({ node, nodes, layoutId }) => {
  if (node.type === 'split') {
    return <SplitNode node={node} nodes={nodes} layoutId={layoutId} />;
  }
  return <LeafNode node={node} layoutId={layoutId} />;
};

// ---------------------------------------------------------------------------
// SplitLayoutRenderer — top-level component
// ---------------------------------------------------------------------------

interface SplitLayoutRendererProps {
  layoutId: string;
}

export const SplitLayoutRenderer: React.FC<SplitLayoutRendererProps> = ({ layoutId }) => {
  const { data: layoutData, loading } = useConceptQuery<Record<string, unknown>>(
    'SplitLayout', 'getTree', { layout: layoutId },
  );

  if (loading) {
    return <div style={{ padding: 'var(--spacing-lg)', color: 'var(--palette-on-surface-variant)' }}>Loading layout...</div>;
  }

  if (!layoutData) {
    return <div style={{ padding: 'var(--spacing-lg)', color: 'var(--palette-error)' }}>Layout &quot;{layoutId}&quot; not found</div>;
  }

  // Parse the tree JSON
  const treeStr = layoutData.tree as string;
  let treeNodes: TreeNode[] = [];
  try {
    const parsed = JSON.parse(treeStr);
    treeNodes = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return <div style={{ padding: 'var(--spacing-lg)', color: 'var(--palette-error)' }}>Invalid layout tree</div>;
  }

  // Build node map
  const nodeMap = new Map<string, TreeNode>();
  for (const node of treeNodes) {
    nodeMap.set(node.id, node);
  }

  // Find root (first split node, or first node)
  const rootNode = treeNodes.find(n => n.type === 'split') ?? treeNodes[0];
  if (!rootNode) {
    return <div style={{ padding: 'var(--spacing-lg)', color: 'var(--palette-on-surface-variant)' }}>Empty layout</div>;
  }

  return (
    <div data-keybinding-scope="app.layout.split" style={{ width: '100%', height: '100%', display: 'flex' }}>
      <TreeNodeRenderer node={rootNode} nodes={nodeMap} layoutId={layoutId} />
    </div>
  );
};

export default SplitLayoutRenderer;
