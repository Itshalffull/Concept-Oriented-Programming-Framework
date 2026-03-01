'use client';
import {
  forwardRef,
  useReducer,
  useCallback,
  useId,
  type ReactNode,
  type KeyboardEvent,
} from 'react';
import { timelineReducer, timelineInitialState } from './Timeline.reducer.js';

// Props from timeline.widget spec
export interface TimelineItem {
  id: string;
  label: string;
  start: string;
  end: string;
  dependencies?: string[];
}

export interface TimelineProps {
  items: TimelineItem[];
  scale?: 'day' | 'week' | 'month';
  ariaLabel?: string;
  resizable?: boolean;
  zoomLevel?: number;
  size?: 'sm' | 'md' | 'lg';
  onSelectItem?: (id: string) => void;
  onDeselectItem?: () => void;
  className?: string;
  children?: ReactNode;
}

export const Timeline = forwardRef<HTMLDivElement, TimelineProps>(
  function Timeline(
    {
      items,
      scale = 'week',
      ariaLabel = 'Timeline',
      resizable = false,
      zoomLevel = 1.0,
      size = 'md',
      onSelectItem,
      onDeselectItem,
      className,
      children,
    },
    ref
  ) {
    const [state, dispatch] = useReducer(timelineReducer, timelineInitialState);
    const baseId = useId();

    const handleBarSelect = useCallback(
      (id: string) => {
        if (state.selectedId === id) {
          dispatch({ type: 'DESELECT_BAR' });
          onDeselectItem?.();
        } else {
          dispatch({ type: 'SELECT_BAR', id });
          onSelectItem?.(id);
        }
      },
      [state.selectedId, onSelectItem, onDeselectItem]
    );

    const handleBarKeyDown = useCallback(
      (e: KeyboardEvent<HTMLDivElement>, id: string) => {
        switch (e.key) {
          case 'Enter':
          case ' ':
            e.preventDefault();
            handleBarSelect(id);
            break;
          case 'Escape':
            e.preventDefault();
            dispatch({ type: 'DESELECT_BAR' });
            onDeselectItem?.();
            break;
        }
      },
      [handleBarSelect, onDeselectItem]
    );

    return (
      <div
        ref={ref}
        className={className}
        role="grid"
        aria-label={ariaLabel}
        aria-roledescription="timeline"
        data-surface-widget=""
        data-widget-name="timeline"
        data-part="root"
        data-scale={scale}
        data-state={state.current === 'scrolling' ? 'scrolling' : state.current === 'resizing' ? 'resizing' : 'idle'}
        data-zoom={zoomLevel}
        data-size={size}
      >
        <div data-part="header" data-scale={scale}>
          <div
            data-part="time-axis"
            data-scale={scale}
            role="row"
            aria-label="Time scale"
          >
            {/* Time axis ticks rendered by consumer or theme */}
          </div>
        </div>
        <div
          data-part="body"
          role="rowgroup"
          data-state={state.current === 'scrolling' ? 'scrolling' : 'idle'}
          onScroll={() => dispatch({ type: 'SCROLL' })}
        >
          <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {items.map((item, rowIndex) => {
              const isSelected = state.selectedId === item.id;
              const isHovered = state.hoveredId === item.id;
              const labelId = `${baseId}-label-${rowIndex}`;

              return (
                <li
                  key={item.id}
                  role="row"
                  aria-label={item.label}
                  aria-rowindex={rowIndex + 1}
                  data-part="row"
                >
                  <span id={labelId} data-part="row-label">
                    {item.label}
                  </span>
                  <div
                    role="gridcell"
                    aria-label={`${item.label} from ${item.start} to ${item.end}`}
                    aria-selected={isSelected ? 'true' : 'false'}
                    tabIndex={isSelected ? 0 : -1}
                    data-part="bar"
                    data-state={isSelected ? 'selected' : isHovered ? 'hovered' : 'idle'}
                    data-resizable={resizable ? 'true' : 'false'}
                    onClick={() => handleBarSelect(item.id)}
                    onMouseEnter={() => dispatch({ type: 'HOVER_BAR', id: item.id })}
                    onMouseLeave={() => dispatch({ type: 'UNHOVER_BAR' })}
                    onKeyDown={(e) => handleBarKeyDown(e, item.id)}
                  />
                  {/* Dependency arrows */}
                  {item.dependencies?.map((depId) => (
                    <div
                      key={`${item.id}-${depId}`}
                      data-part="dependency-arrow"
                      data-from={depId}
                      data-to={item.id}
                      aria-hidden="true"
                    />
                  ))}
                </li>
              );
            })}
          </ol>
        </div>
        {children}
      </div>
    );
  }
);

Timeline.displayName = 'Timeline';
export default Timeline;
