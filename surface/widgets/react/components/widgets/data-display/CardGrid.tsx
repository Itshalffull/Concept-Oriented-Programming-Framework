export type CardGridState = { current: 'static' | 'loading' | 'empty' };

export type CardGridAction =
  | { type: 'LOAD' }
  | { type: 'LOAD_COMPLETE' }
  | { type: 'LOAD_COMPLETE_EMPTY' }
  | { type: 'DATA_EMPTY' }
  | { type: 'DATA_AVAILABLE' };

export function cardGridReducer(state: CardGridState, action: CardGridAction): CardGridState {
  switch (state.current) {
    case 'static':
      if (action.type === 'LOAD') return { current: 'loading' };
      if (action.type === 'DATA_EMPTY') return { current: 'empty' };
      return state;
    case 'loading':
      if (action.type === 'LOAD_COMPLETE') return { current: 'static' };
      if (action.type === 'LOAD_COMPLETE_EMPTY') return { current: 'empty' };
      return state;
    case 'empty':
      if (action.type === 'LOAD') return { current: 'loading' };
      if (action.type === 'DATA_AVAILABLE') return { current: 'static' };
      return state;
    default:
      return state;
  }
}

export const cardGridInitialState: CardGridState = { current: 'static' };

import { forwardRef, useReducer, type ReactNode } from 'react';

// Props from card-grid.widget spec
export interface CardGridProps {
  columns?: number;
  gap?: number;
  minCardWidth?: string;
  ariaLabel?: string;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
  emptyContent?: ReactNode;
  className?: string;
  children?: ReactNode;
}

export const CardGrid = forwardRef<HTMLDivElement, CardGridProps>(
  function CardGrid(
    {
      columns = 3,
      gap = 16,
      minCardWidth = '280px',
      ariaLabel,
      loading = false,
      size = 'md',
      emptyContent,
      className,
      children,
    },
    ref
  ) {
    const [state] = useReducer(cardGridReducer, cardGridInitialState);

    const resolvedState = loading ? 'loading' : state.current;
    const isEmpty = !loading && !children;

    return (
      <div
        ref={ref}
        className={className}
        role="list"
        aria-label={ariaLabel}
        aria-busy={loading ? 'true' : 'false'}
        data-surface-widget=""
        data-widget-name="card-grid"
        data-part="root"
        data-state={isEmpty ? 'empty' : resolvedState}
        data-columns={columns}
        data-gap={gap}
        data-size={size}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, minmax(${minCardWidth}, 1fr))`,
          gap: `${gap}px`,
        }}
      >
        {isEmpty && emptyContent ? emptyContent : children}
      </div>
    );
  }
);

CardGrid.displayName = 'CardGrid';
export default CardGrid;
