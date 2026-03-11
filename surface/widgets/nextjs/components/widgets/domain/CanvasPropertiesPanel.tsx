'use client';

import {
  forwardRef,
  useEffect,
  useReducer,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';

import { propertiesPanelReducer } from './CanvasPropertiesPanel.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface CanvasPropertiesPanelProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** Canvas this panel belongs to. */
  canvasId: string;
  /** Selected item ID (if an item is selected). */
  selectedItemId?: string;
  /** Selected connector ID (if a connector is selected). */
  selectedConnectorId?: string;
  /** Current selection type. */
  selectionType?: 'none' | 'item' | 'connector' | 'canvas';
  /** Item properties form slot. */
  itemProperties?: ReactNode;
  /** Connector properties form slot. */
  connectorProperties?: ReactNode;
  /** Canvas properties form slot. */
  canvasProperties?: ReactNode;
  /** Empty state slot. */
  emptyState?: ReactNode;
  /** Called when deselecting. */
  onDeselect?: () => void;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const CanvasPropertiesPanel = forwardRef<HTMLDivElement, CanvasPropertiesPanelProps>(
  function CanvasPropertiesPanel(
    {
      canvasId,
      selectedItemId,
      selectedConnectorId,
      selectionType = 'none',
      itemProperties,
      connectorProperties,
      canvasProperties,
      emptyState,
      onDeselect,
      ...rest
    },
    ref,
  ) {
    const [state, send] = useReducer(propertiesPanelReducer, 'empty');

    // Sync reducer state with the controlled selectionType prop
    useEffect(() => {
      switch (selectionType) {
        case 'item':
          send({ type: 'SELECT_ITEM' });
          break;
        case 'connector':
          send({ type: 'SELECT_CONNECTOR' });
          break;
        case 'canvas':
          send({ type: 'SELECT_CANVAS' });
          break;
        default:
          send({ type: 'DESELECT' });
          break;
      }
    }, [selectionType]);

    const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        send({ type: 'DESELECT' });
        onDeselect?.();
      }
    };

    return (
      <div
        ref={ref}
        role="complementary"
        aria-label="Properties panel"
        data-surface-widget=""
        data-widget-name="canvas-properties-panel"
        data-part="properties-panel"
        data-canvas={canvasId}
        data-selection-type={selectionType}
        data-state={state}
        onKeyDown={handleKeyDown}
        {...rest}
      >
        <div
          data-part="item-properties"
          data-visible={selectionType === 'item' ? 'true' : 'false'}
          data-item-id={selectedItemId}
          role="form"
          aria-label="Item properties"
        >
          {selectionType === 'item' && itemProperties}
        </div>

        <div
          data-part="connector-properties"
          data-visible={selectionType === 'connector' ? 'true' : 'false'}
          data-connector-id={selectedConnectorId}
          role="form"
          aria-label="Connector properties"
        >
          {selectionType === 'connector' && connectorProperties}
        </div>

        <div
          data-part="canvas-properties"
          data-visible={selectionType === 'canvas' ? 'true' : 'false'}
          role="form"
          aria-label="Canvas properties"
        >
          {selectionType === 'canvas' && canvasProperties}
        </div>

        <div
          data-part="empty-state"
          data-visible={selectionType === 'none' ? 'true' : 'false'}
        >
          {selectionType === 'none' && (emptyState ?? <p>Nothing selected</p>)}
        </div>
      </div>
    );
  },
);

CanvasPropertiesPanel.displayName = 'CanvasPropertiesPanel';
export { CanvasPropertiesPanel };
export default CanvasPropertiesPanel;
