// ---------------------------------------------------------------------------
// Accordion reducer — state management for vertically stacked collapsible sections.
// ---------------------------------------------------------------------------

export interface AccordionState {
  expandedItems: string[];
}

export type AccordionAction =
  | { type: 'TOGGLE'; value: string; multiple: boolean; collapsible: boolean }
  | { type: 'EXPAND'; value: string; multiple: boolean }
  | { type: 'COLLAPSE'; value: string; collapsible: boolean };

export function accordionReducer(state: AccordionState, action: AccordionAction): AccordionState {
  switch (action.type) {
    case 'TOGGLE': {
      const isExpanded = state.expandedItems.includes(action.value);
      if (isExpanded) {
        if (!action.collapsible && state.expandedItems.length === 1) return state;
        return { expandedItems: state.expandedItems.filter((v) => v !== action.value) };
      }
      if (action.multiple) {
        return { expandedItems: [...state.expandedItems, action.value] };
      }
      return { expandedItems: [action.value] };
    }
    case 'EXPAND': {
      if (state.expandedItems.includes(action.value)) return state;
      if (action.multiple) {
        return { expandedItems: [...state.expandedItems, action.value] };
      }
      return { expandedItems: [action.value] };
    }
    case 'COLLAPSE': {
      if (!action.collapsible && state.expandedItems.length === 1) return state;
      return { expandedItems: state.expandedItems.filter((v) => v !== action.value) };
    }
    default:
      return state;
  }
}


import {
  forwardRef,
  useReducer,
  useCallback,
  useId,
  type ReactNode,
  type HTMLAttributes,
} from 'react';
import { accordionReducer } from './Accordion.reducer.js';

// ---------------------------------------------------------------------------
// Accordion — Vertically stacked collapsible sections.
// Supports single or multiple expanded items.
// Derived from accordion.widget spec.
// ---------------------------------------------------------------------------

export interface AccordionItem {
  value: string;
  trigger: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

export interface AccordionProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  items: AccordionItem[];
  value?: string[];
  defaultValue?: string[];
  multiple?: boolean;
  collapsible?: boolean;
  disabled?: boolean;
  onValueChange?: (value: string[]) => void;
  variant?: string;
  size?: string;
}

export const Accordion = forwardRef<HTMLDivElement, AccordionProps>(
  function Accordion(
    {
      items,
      value,
      defaultValue = [],
      multiple = false,
      collapsible = true,
      disabled = false,
      onValueChange,
      variant,
      size,
      className,
      ...rest
    },
    ref
  ) {
    const id = useId();
    const isControlled = value !== undefined;

    const [internalState, dispatch] = useReducer(accordionReducer, {
      expandedItems: defaultValue,
    });

    const expandedItems = isControlled ? value : internalState.expandedItems;

    const handleToggle = useCallback(
      (itemValue: string) => {
        if (disabled) return;
        if (!isControlled) {
          dispatch({ type: 'TOGGLE', value: itemValue, multiple, collapsible });
        }
        const isExpanded = expandedItems.includes(itemValue);
        let next: string[];
        if (isExpanded) {
          if (!collapsible && expandedItems.length === 1) return;
          next = expandedItems.filter((v) => v !== itemValue);
        } else {
          next = multiple ? [...expandedItems, itemValue] : [itemValue];
        }
        onValueChange?.(next);
      },
      [disabled, isControlled, expandedItems, multiple, collapsible, onValueChange]
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent, index: number) => {
        const triggers = items.filter((it) => !it.disabled);
        const count = triggers.length;
        let targetIndex = -1;

        switch (e.key) {
          case 'Enter':
          case ' ':
            e.preventDefault();
            handleToggle(items[index].value);
            return;
          case 'ArrowDown':
            e.preventDefault();
            targetIndex = (index + 1) % count;
            break;
          case 'ArrowUp':
            e.preventDefault();
            targetIndex = (index - 1 + count) % count;
            break;
          case 'Home':
            e.preventDefault();
            targetIndex = 0;
            break;
          case 'End':
            e.preventDefault();
            targetIndex = count - 1;
            break;
          default:
            return;
        }

        const triggerId = `accordion-trigger-${id}-${targetIndex}`;
        document.getElementById(triggerId)?.focus();
      },
      [items, id, handleToggle]
    );

    return (
      <div
        ref={ref}
        className={className}
        data-surface-widget=""
        data-widget-name="accordion"
        data-part="root"
        data-orientation="vertical"
        data-disabled={disabled ? 'true' : 'false'}
        data-variant={variant}
        data-size={size}
        {...rest}
      >
        {items.map((item, index) => {
          const isExpanded = expandedItems.includes(item.value);
          const itemState = isExpanded ? 'open' : 'closed';
          const triggerId = `accordion-trigger-${id}-${index}`;
          const contentId = `accordion-content-${id}-${index}`;
          const isItemDisabled = disabled || !!item.disabled;

          return (
            <div
              key={item.value}
              data-part="item"
              data-state={itemState}
              data-disabled={isItemDisabled ? 'true' : 'false'}
            >
              <button
                id={triggerId}
                type="button"
                role="button"
                aria-expanded={isExpanded}
                aria-controls={contentId}
                data-part="trigger"
                data-state={itemState}
                data-disabled={isItemDisabled ? 'true' : 'false'}
                disabled={isItemDisabled}
                tabIndex={isItemDisabled ? -1 : 0}
                onClick={() => handleToggle(item.value)}
                onKeyDown={(e) => handleKeyDown(e, index)}
              >
                <span
                  data-part="indicator"
                  data-state={itemState}
                  aria-hidden="true"
                />
                {item.trigger}
              </button>
              <div
                id={contentId}
                role="region"
                aria-labelledby={triggerId}
                data-part="content"
                data-state={itemState}
                hidden={!isExpanded}
              >
                {item.content}
              </div>
            </div>
          );
        })}
      </div>
    );
  }
);

Accordion.displayName = 'Accordion';
export default Accordion;
