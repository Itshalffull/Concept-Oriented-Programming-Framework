'use client';

import {
  forwardRef,
  useCallback,
  useId,
  type ReactNode,
  type HTMLAttributes,
} from 'react';
import { useRovingFocus } from '../shared/useRovingFocus.js';
import { useControllableState } from '../shared/useControllableState.js';

// ---------------------------------------------------------------------------
// Tabs — Tab list + panels with roving focus keyboard navigation.
// Derived from tabs.widget spec.
// ---------------------------------------------------------------------------

export interface TabItem {
  value: string;
  trigger: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  items: TabItem[];
  value?: string;
  defaultValue?: string;
  orientation?: 'horizontal' | 'vertical';
  activationMode?: 'automatic' | 'manual';
  disabled?: boolean;
  loop?: boolean;
  onValueChange?: (value: string) => void;
  variant?: string;
  size?: string;
}

export const Tabs = forwardRef<HTMLDivElement, TabsProps>(
  function Tabs(
    {
      items,
      value,
      defaultValue,
      orientation = 'horizontal',
      activationMode = 'automatic',
      disabled = false,
      loop = true,
      onValueChange,
      variant,
      size,
      className,
      ...rest
    },
    ref
  ) {
    const id = useId();
    const initialValue = defaultValue ?? (items.length > 0 ? items[0].value : '');

    const [activeValue, setActiveValue] = useControllableState<string>({
      value,
      defaultValue: initialValue,
      onChange: onValueChange,
    });

    const rovingOrientation = orientation === 'horizontal' ? 'horizontal' : 'vertical';
    const { getItemProps } = useRovingFocus({
      orientation: rovingOrientation,
      loop,
      onFocusChange: (index) => {
        if (activationMode === 'automatic' && !items[index]?.disabled) {
          setActiveValue(items[index].value);
        }
      },
    });

    const handleSelect = useCallback(
      (itemValue: string) => {
        if (disabled) return;
        setActiveValue(itemValue);
      },
      [disabled, setActiveValue]
    );

    return (
      <div
        ref={ref}
        className={className}
        data-surface-widget=""
        data-widget-name="tabs"
        data-part="root"
        data-orientation={orientation}
        data-disabled={disabled ? 'true' : 'false'}
        data-variant={variant}
        data-size={size}
        {...rest}
      >
        <div
          role="tablist"
          aria-orientation={orientation}
          data-part="list"
          data-orientation={orientation}
        >
          {items.map((item, index) => {
            const isActive = item.value === activeValue;
            const itemState = isActive ? 'active' : 'inactive';
            const isItemDisabled = disabled || !!item.disabled;
            const triggerId = `tabs-trigger-${id}-${index}`;
            const contentId = `tabs-content-${id}-${index}`;
            const rovingProps = getItemProps(index);

            return (
              <button
                key={item.value}
                id={triggerId}
                ref={rovingProps.ref}
                type="button"
                role="tab"
                aria-selected={isActive}
                aria-controls={contentId}
                tabIndex={rovingProps.tabIndex}
                data-part="trigger"
                data-state={itemState}
                data-orientation={orientation}
                data-disabled={isItemDisabled ? 'true' : 'false'}
                disabled={isItemDisabled}
                onClick={() => handleSelect(item.value)}
                onKeyDown={(e) => {
                  rovingProps.onKeyDown(e);
                  if (activationMode === 'manual' && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    handleSelect(item.value);
                  }
                }}
                onFocus={rovingProps.onFocus}
              >
                {item.trigger}
              </button>
            );
          })}
          <span
            data-part="indicator"
            data-orientation={orientation}
            data-state={activeValue ? 'active' : 'inactive'}
            aria-hidden="true"
          />
        </div>
        {items.map((item, index) => {
          const isActive = item.value === activeValue;
          const itemState = isActive ? 'active' : 'inactive';
          const triggerId = `tabs-trigger-${id}-${index}`;
          const contentId = `tabs-content-${id}-${index}`;

          return (
            <div
              key={item.value}
              id={contentId}
              role="tabpanel"
              aria-labelledby={triggerId}
              tabIndex={0}
              data-part="content"
              data-state={itemState}
              data-orientation={orientation}
              hidden={!isActive}
            >
              {item.content}
            </div>
          );
        })}
      </div>
    );
  }
);

Tabs.displayName = 'Tabs';
export default Tabs;
