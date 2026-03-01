'use client';
import { forwardRef, useReducer, useCallback, useRef, type ReactNode, type KeyboardEvent } from 'react';
import { createViewToggleReducer } from './ViewToggle.reducer.js';

// Props from view-toggle.widget spec
export interface ViewToggleOption {
  value: string;
  icon: string;
  label: string;
}

export interface ViewToggleProps {
  value: string;
  options: ViewToggleOption[];
  ariaLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  onChange?: (value: string) => void;
  className?: string;
  children?: ReactNode;
}

export const ViewToggle = forwardRef<HTMLDivElement, ViewToggleProps>(
  function ViewToggle(
    {
      value,
      options,
      ariaLabel = 'View options',
      size = 'md',
      onChange,
      className,
    },
    ref
  ) {
    const reducer = createViewToggleReducer(options.length);
    const initialIndex = Math.max(0, options.findIndex((o) => o.value === value));
    const [state, dispatch] = useReducer(reducer, {
      activeValue: value,
      focusedIndex: initialIndex,
    });
    const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

    const activeValue = value ?? state.activeValue;

    const handleSelect = useCallback(
      (optValue: string, index: number) => {
        dispatch({ type: 'SELECT', value: optValue, index });
        onChange?.(optValue);
      },
      [onChange]
    );

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
        let nextIndex = index;
        switch (e.key) {
          case 'ArrowLeft':
          case 'ArrowUp':
            e.preventDefault();
            nextIndex = (index - 1 + options.length) % options.length;
            dispatch({ type: 'NAVIGATE_PREV' });
            itemRefs.current[nextIndex]?.focus();
            break;
          case 'ArrowRight':
          case 'ArrowDown':
            e.preventDefault();
            nextIndex = (index + 1) % options.length;
            dispatch({ type: 'NAVIGATE_NEXT' });
            itemRefs.current[nextIndex]?.focus();
            break;
          case 'Home':
            e.preventDefault();
            dispatch({ type: 'NAVIGATE_FIRST' });
            itemRefs.current[0]?.focus();
            break;
          case 'End':
            e.preventDefault();
            dispatch({ type: 'NAVIGATE_LAST' });
            itemRefs.current[options.length - 1]?.focus();
            break;
          case ' ':
          case 'Enter':
            e.preventDefault();
            handleSelect(options[index].value, index);
            break;
        }
      },
      [options, handleSelect]
    );

    return (
      <div
        ref={ref}
        className={className}
        role="radiogroup"
        aria-label={ariaLabel}
        data-surface-widget=""
        data-widget-name="view-toggle"
        data-part="view-toggle"
        data-size={size}
      >
        {options.map((option, index) => {
          const isActive = option.value === activeValue;
          return (
            <button
              key={option.value}
              ref={(el) => { itemRefs.current[index] = el; }}
              type="button"
              role="radio"
              aria-checked={isActive ? 'true' : 'false'}
              aria-label={option.label}
              tabIndex={isActive ? 0 : -1}
              data-state={isActive ? 'active' : 'inactive'}
              data-value={option.value}
              onClick={() => handleSelect(option.value, index)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              onFocus={() => dispatch({ type: 'FOCUS', index })}
              onBlur={() => dispatch({ type: 'BLUR' })}
            >
              <span
                data-part="item-icon"
                data-icon={option.icon}
                aria-hidden="true"
              />
            </button>
          );
        })}
      </div>
    );
  }
);

ViewToggle.displayName = 'ViewToggle';
export default ViewToggle;
