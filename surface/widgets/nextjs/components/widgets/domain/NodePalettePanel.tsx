'use client';

import {
  forwardRef,
  useCallback,
  useMemo,
  useReducer,
  type HTMLAttributes,
  type ChangeEvent,
  type DragEvent,
} from 'react';

import { paletteReducer } from './NodePalettePanel.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface NodeTypeItem {
  type_key: string;
  label: string;
  shape: string;
  default_fill?: string;
  icon?: string;
}

export interface NodePalettePanelProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Notation ID for this palette. */
  notationId: string;
  /** Display name of the active notation. */
  notationName?: string;
  /** Available node types. */
  types?: NodeTypeItem[];
  /** Panel orientation. */
  orientation?: 'horizontal' | 'vertical';
  /** Current search query. */
  searchQuery?: string;
  /** Called when search query changes. */
  onSearchChange?: (query: string) => void;
  /** Called when a type item is dragged. */
  onDragType?: (typeKey: string) => void;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const NodePalettePanel = forwardRef<HTMLDivElement, NodePalettePanelProps>(function NodePalettePanel(
  {
    notationId,
    notationName = '',
    types = [],
    orientation = 'vertical',
    searchQuery = '',
    onSearchChange,
    onDragType,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(paletteReducer, 'idle');

  const filteredTypes = useMemo(() => {
    if (!searchQuery) return types;
    const q = searchQuery.toLowerCase();
    return types.filter((t) => t.label.toLowerCase().includes(q));
  }, [types, searchQuery]);

  const handleSearchInput = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      if (value) {
        send({ type: 'SEARCH', query: value });
      } else {
        send({ type: 'CLEAR' });
      }
      onSearchChange?.(value);
    },
    [onSearchChange],
  );

  const handleDragStart = useCallback(
    (typeKey: string) => (e: DragEvent<HTMLButtonElement>) => {
      e.dataTransfer.setData('application/x-node-type', typeKey);
      send({ type: 'DRAG_START', typeKey });
      onDragType?.(typeKey);
    },
    [onDragType],
  );

  const handleDragEnd = useCallback(() => {
    send({ type: 'DROP' });
  }, []);

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label="Node palette"
      aria-orientation={orientation}
      data-surface-widget=""
      data-widget-name="node-palette-panel"
      data-part="node-palette"
      data-notation={notationId}
      data-orientation={orientation}
      data-state={state}
      {...rest}
    >
      <div data-part="palette-header">{notationName || 'Palette'}</div>

      <input
        data-part="search-filter"
        type="text"
        placeholder="Search types..."
        value={searchQuery}
        onChange={handleSearchInput}
        aria-label="Filter node types"
      />

      <div data-part="type-grid" role="group" aria-label="Node types">
        {filteredTypes.map((t) => (
          <button
            key={t.type_key}
            data-part="type-item"
            data-type-key={t.type_key}
            draggable="true"
            role="button"
            aria-label={`Add ${t.label} node`}
            aria-roledescription="draggable"
            onDragStart={handleDragStart(t.type_key)}
            onDragEnd={handleDragEnd}
          >
            {t.icon && <span data-part="type-icon" aria-hidden="true">{t.icon}</span>}
            <span data-part="type-label">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
});

NodePalettePanel.displayName = 'NodePalettePanel';
export { NodePalettePanel };
export default NodePalettePanel;
