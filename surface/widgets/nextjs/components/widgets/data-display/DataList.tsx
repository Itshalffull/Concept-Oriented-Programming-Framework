'use client';
import { forwardRef, useReducer, useId, type ReactNode } from 'react';
import { dataListReducer, dataListInitialState } from './DataList.reducer.js';

// Props from data-list.widget spec
export interface DataListItem {
  label: string;
  value: string | ReactNode;
}

export interface DataListProps {
  items: DataListItem[];
  orientation?: 'horizontal' | 'vertical';
  ariaLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  children?: ReactNode;
}

export const DataList = forwardRef<HTMLDListElement, DataListProps>(
  function DataList(
    {
      items,
      orientation = 'horizontal',
      ariaLabel,
      size = 'md',
      className,
      children,
    },
    ref
  ) {
    const [state] = useReducer(dataListReducer, dataListInitialState);
    const baseId = useId();

    return (
      <dl
        ref={ref}
        className={className}
        role="list"
        aria-label={ariaLabel}
        data-surface-widget=""
        data-widget-name="data-list"
        data-part="data-list"
        data-orientation={orientation}
        data-state={state.current}
        data-size={size}
      >
        {items.map((item, index) => {
          const termId = `${baseId}-term-${index}`;
          return (
            <div
              key={termId}
              role="listitem"
              data-part="item"
              data-orientation={orientation}
            >
              <dt id={termId} role="term" data-part="term">
                {item.label}
              </dt>
              <dd
                role="definition"
                data-part="detail"
                aria-labelledby={termId}
              >
                {item.value}
              </dd>
            </div>
          );
        })}
        {children}
      </dl>
    );
  }
);

DataList.displayName = 'DataList';
export default DataList;
