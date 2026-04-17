'use client';

/**
 * BlockSubtreeView — renders a block + its full descendant subtree,
 * each node as a live BlockSlot in its own schema's display mode.
 *
 * Exposed as the "block-subtree" DisplayMode (see
 * DisplayMode.block-subtree.seeds.yaml + ComponentMapping.block-subtree.seeds.yaml).
 * Views (kanban, outline, list, gallery, table, etc.) pick this
 * display mode when they want each item to render as its full
 * recursive block subtree rather than a one-line summary.
 *
 * Each nested block carries a hover-visible gear that re-opens the
 * BlockChildrenSettings menu scoped to that specific parent — so
 * users can flip ANY nested subtree to a different view / sort /
 * filter independently.
 *
 * The component is pure-props: the host editor injects `renderBlockSlot`
 * to avoid circular imports and passes its adjacency map + settings
 * resolver through. This keeps BlockSubtreeView trivial to mount from
 * any view shell without dragging the whole RecursiveBlockEditor
 * context into the tree.
 */

import React from 'react';

export interface BlockSubtreeItem {
  id: string;
  schema: string;
  displayMode: string;
  depth: number;
  parent: string;
  hasChildren: boolean;
}

export interface BlockSubtreeSettings {
  view: string;
  sort: string;
  filter: string;
}

export interface BlockSubtreeViewProps {
  rootId: string;
  depth?: number;
  keyNamespace?: string;
  byParent: Map<string, BlockSubtreeItem[]>;
  byId: Map<string, BlockSubtreeItem>;
  renderBlockSlot: (props: {
    nodeId: string;
    schema: string;
    displayMode: string;
    key: string;
  }) => React.ReactNode;
  settingsFor: (parentId: string) => BlockSubtreeSettings;
  openSettingsMenu: (x: number, y: number, parentId: string) => void;
  /** If a nested parent's view is non-blocks, stop recursing so the
   * outer view pipeline can render that subtree in its chosen shell. */
  subtreeRenderMode: Map<string, string>;
  /** Render alt-view children for a parent whose childViewMode is not
   * block-children-blocks. Called when shouldRecurse is false and the
   * node has children, so they are never silently dropped. */
  renderAltChildren?: (nodeId: string) => React.ReactNode;
}

export const BlockSubtreeView: React.FC<BlockSubtreeViewProps> = (props) => {
  const {
    rootId, depth = 0, keyNamespace = 'block-subtree',
    byParent, byId, renderBlockSlot,
    settingsFor, openSettingsMenu, subtreeRenderMode,
    renderAltChildren,
  } = props;

  const rec = byId.get(rootId);
  if (!rec) return null;

  const nodeKey = `${keyNamespace}:${rec.id}:${depth}`;
  const showGear = rec.hasChildren;
  const childViewMode = subtreeRenderMode.get(rec.id) ?? 'block-children-blocks';
  const shouldRecurse = childViewMode === 'block-children-blocks';

  return (
    <>
      <div
        key={nodeKey}
        data-part="block-subtree-node"
        data-display-mode="block-subtree"
        data-block-id={rec.id}
        style={{
          position: 'relative',
          marginLeft: depth * 12,
          borderLeft: depth > 0 ? '1px solid var(--palette-outline-variant, rgba(0,0,0,0.08))' : 'none',
          paddingLeft: depth > 0 ? 6 : 0,
          paddingRight: showGear ? 44 : 0,
        }}
        onMouseEnter={(e) => {
          const g = e.currentTarget.querySelector(':scope > [data-part="nested-children-gear"]') as HTMLElement | null;
          if (g) g.style.opacity = '0.9';
        }}
        onMouseLeave={(e) => {
          const g = e.currentTarget.querySelector(':scope > [data-part="nested-children-gear"]') as HTMLElement | null;
          if (g) g.style.opacity = '0';
        }}
      >
        {renderBlockSlot({
          nodeId: rec.id,
          schema: rec.schema,
          displayMode: rec.displayMode,
          key: nodeKey + ':slot',
        })}
        {showGear && (
          <button
            data-part="nested-children-gear"
            data-parent-id={rec.id}
            title="View settings for this block's children"
            aria-label="Nested children view settings"
            onClick={(e) => { e.stopPropagation(); openSettingsMenu(e.clientX, e.clientY, rec.id); }}
            style={{
              position: 'absolute', right: 4, top: 4, zIndex: 7,
              fontSize: 11, padding: '1px 6px', borderRadius: 4, cursor: 'pointer',
              background: 'var(--palette-surface, #fff)',
              border: '1px solid var(--palette-outline-variant, rgba(0,0,0,0.12))',
              color: 'var(--palette-on-surface-variant, #666)',
              opacity: 0, transition: 'opacity 120ms ease',
            }}
          >⚙ {settingsFor(rec.id).view.replace('block-children-', '')}</button>
        )}
      </div>
      {shouldRecurse && (byParent.get(rec.id) ?? []).map((c) => (
        <BlockSubtreeView key={`${keyNamespace}:${c.id}`} {...props} rootId={c.id} depth={depth + 1} />
      ))}
      {!shouldRecurse && rec.hasChildren && renderAltChildren
        ? renderAltChildren(rec.id)
        : null}
    </>
  );
};

export default BlockSubtreeView;
