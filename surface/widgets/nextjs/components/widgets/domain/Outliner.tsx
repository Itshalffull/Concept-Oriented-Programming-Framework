'use client';

import {
  forwardRef,
  useCallback,
  useReducer,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { outlinerReducer } from './Outliner.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface OutlineItem {
  id: string;
  content: string;
  children?: OutlineItem[];
  collapsed?: boolean;
}

export interface OutlinerProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Tree of outline items. */
  items: OutlineItem[];
  /** Accessible label. */
  ariaLabel?: string;
  /** Current zoom path (item IDs from root to zoom target). */
  zoomPath?: string[];
  /** Read-only mode. */
  readOnly?: boolean;
  /** Enable collapsing. */
  collapsible?: boolean;
  /** Enable drag reorder. */
  draggable?: boolean;
  /** Placeholder for new items. */
  placeholder?: string;
  /** Show bullet indicators. */
  showBullets?: boolean;
  /** Called when items change. */
  onItemsChange?: (items: OutlineItem[]) => void;
  /** Called when zoom changes. */
  onZoomChange?: (path: string[]) => void;
  /** Called when collapse toggles. */
  onToggleCollapse?: (id: string) => void;
  /** Breadcrumb slot. */
  breadcrumb?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Recursive item renderer
 * ------------------------------------------------------------------------- */

function OutlineItemNode({
  item,
  depth,
  index,
  siblingCount,
  readOnly,
  collapsible,
  draggable: draggableProp,
  placeholder,
  showBullets,
  onZoomIn,
  onToggleCollapse,
}: {
  item: OutlineItem;
  depth: number;
  index: number;
  siblingCount: number;
  readOnly: boolean;
  collapsible: boolean;
  draggable: boolean;
  placeholder: string;
  showBullets: boolean;
  onZoomIn: (id: string) => void;
  onToggleCollapse: (id: string) => void;
}) {
  const hasChildren = (item.children?.length ?? 0) > 0;
  const isExpanded = !item.collapsed;

  return (
    <div
      role="treeitem"
      aria-expanded={hasChildren && collapsible ? isExpanded : undefined}
      aria-level={depth}
      aria-posinset={index + 1}
      aria-setsize={siblingCount}
      aria-selected={false}
      data-depth={depth}
      data-state={item.collapsed ? 'collapsed' : 'expanded'}
      data-has-children={hasChildren ? 'true' : 'false'}
      tabIndex={-1}
    >
      {showBullets && (
        <button
          type="button"
          role="button"
          aria-label="Zoom into item"
          data-part="bullet"
          data-has-children={hasChildren ? 'true' : 'false'}
          data-visible="true"
          tabIndex={-1}
          onClick={() => onZoomIn(item.id)}
        >
          {'\u2022'}
        </button>
      )}

      {hasChildren && collapsible && (
        <button
          type="button"
          role="button"
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
          aria-expanded={isExpanded}
          data-part="collapse-toggle"
          data-visible="true"
          tabIndex={-1}
          onClick={() => onToggleCollapse(item.id)}
        >
          {isExpanded ? '\u25BE' : '\u25B8'}
        </button>
      )}

      <span
        contentEditable={!readOnly}
        suppressContentEditableWarning
        data-part="content"
        data-placeholder={placeholder}
        data-empty={!item.content ? 'true' : 'false'}
      >
        {item.content}
      </span>

      {draggableProp && !readOnly && (
        <button
          type="button"
          role="button"
          aria-label="Drag to reorder"
          aria-roledescription="drag handle"
          data-part="drag-handle"
          data-visible="true"
          draggable
          tabIndex={-1}
        >
          &#x2630;
        </button>
      )}

      {hasChildren && isExpanded && (
        <div role="group" data-part="children" data-depth={depth + 1} data-visible="true">
          {item.children!.map((child, ci) => (
            <OutlineItemNode
              key={child.id}
              item={child}
              depth={depth + 1}
              index={ci}
              siblingCount={item.children!.length}
              readOnly={readOnly}
              collapsible={collapsible}
              draggable={draggableProp}
              placeholder={placeholder}
              showBullets={showBullets}
              onZoomIn={onZoomIn}
              onToggleCollapse={onToggleCollapse}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const Outliner = forwardRef<HTMLDivElement, OutlinerProps>(function Outliner(
  {
    items,
    ariaLabel = 'Outliner',
    zoomPath = [],
    readOnly = false,
    collapsible = true,
    draggable: draggableProp = true,
    placeholder = 'New item...',
    showBullets = true,
    onItemsChange,
    onZoomChange,
    onToggleCollapse,
    breadcrumb,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(outlinerReducer, { drag: 'idle', focusedId: null });

  const handleZoomIn = useCallback(
    (id: string) => {
      onZoomChange?.([...zoomPath, id]);
    },
    [zoomPath, onZoomChange],
  );

  const handleToggleCollapse = useCallback(
    (id: string) => {
      onToggleCollapse?.(id);
    },
    [onToggleCollapse],
  );

  return (
    <div
      ref={ref}
      role="tree"
      aria-label={ariaLabel}
      aria-multiselectable={false}
      data-surface-widget=""
      data-widget-name="outliner"
      data-zoom-depth={zoomPath.length}
      data-readonly={readOnly ? 'true' : 'false'}
      data-draggable={draggableProp ? 'true' : 'false'}
      {...rest}
    >
      {zoomPath.length > 0 && (
        <div data-part="breadcrumb" data-visible="true" aria-label="Zoom navigation">
          {breadcrumb}
        </div>
      )}

      {items.map((item, index) => (
        <OutlineItemNode
          key={item.id}
          item={item}
          depth={1}
          index={index}
          siblingCount={items.length}
          readOnly={readOnly}
          collapsible={collapsible}
          draggable={draggableProp}
          placeholder={placeholder}
          showBullets={showBullets}
          onZoomIn={handleZoomIn}
          onToggleCollapse={handleToggleCollapse}
        />
      ))}
    </div>
  );
});

Outliner.displayName = 'Outliner';
export { Outliner };
export default Outliner;
