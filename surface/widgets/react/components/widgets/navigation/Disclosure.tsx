// ---------------------------------------------------------------------------
// Disclosure reducer — state management for expand/collapse section.
// ---------------------------------------------------------------------------

export type DisclosureState = 'collapsed' | 'expanded';

export type DisclosureAction =
  | { type: 'TOGGLE' }
  | { type: 'EXPAND' }
  | { type: 'COLLAPSE' };

export function disclosureReducer(state: DisclosureState, action: DisclosureAction): DisclosureState {
  switch (state) {
    case 'collapsed':
      if (action.type === 'TOGGLE' || action.type === 'EXPAND') return 'expanded';
      return state;
    case 'expanded':
      if (action.type === 'TOGGLE' || action.type === 'COLLAPSE') return 'collapsed';
      return state;
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

// ---------------------------------------------------------------------------
// Disclosure — Expand/collapse section with trigger button and content panel.
// Derived from disclosure.widget spec.
// ---------------------------------------------------------------------------

export interface DisclosureProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  open?: boolean;
  defaultOpen?: boolean;
  disabled?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
  triggerContent?: ReactNode;
  variant?: string;
  size?: string;
}

export const Disclosure = forwardRef<HTMLDivElement, DisclosureProps>(
  function Disclosure(
    {
      open,
      defaultOpen = false,
      disabled = false,
      onOpenChange,
      children,
      triggerContent,
      variant,
      size,
      className,
      ...rest
    },
    ref
  ) {
    const id = useId();
    const triggerId = `disclosure-trigger-${id}`;
    const contentId = `disclosure-content-${id}`;

    const isControlled = open !== undefined;
    const [internalState, dispatch] = useReducer(
      disclosureReducer,
      defaultOpen ? 'expanded' : 'collapsed'
    );

    const currentState: DisclosureState = isControlled
      ? (open ? 'expanded' : 'collapsed')
      : internalState;

    const isOpen = currentState === 'expanded';
    const dataState = isOpen ? 'open' : 'closed';

    const handleToggle = useCallback(() => {
      if (disabled) return;
      if (!isControlled) {
        dispatch({ type: 'TOGGLE' });
      }
      onOpenChange?.(!isOpen);
    }, [disabled, isControlled, isOpen, onOpenChange]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleToggle();
        }
      },
      [handleToggle]
    );

    return (
      <div
        ref={ref}
        className={className}
        data-surface-widget=""
        data-widget-name="disclosure"
        data-part="root"
        data-state={dataState}
        data-disabled={disabled ? 'true' : 'false'}
        data-variant={variant}
        data-size={size}
        {...rest}
      >
        <button
          id={triggerId}
          type="button"
          role="button"
          aria-expanded={isOpen}
          aria-controls={contentId}
          data-part="trigger"
          data-state={dataState}
          data-disabled={disabled ? 'true' : 'false'}
          disabled={disabled}
          tabIndex={disabled ? -1 : 0}
          onClick={handleToggle}
          onKeyDown={handleKeyDown}
        >
          <span
            data-part="indicator"
            data-state={dataState}
            aria-hidden="true"
          />
          {triggerContent}
        </button>
        <div
          id={contentId}
          role="region"
          aria-labelledby={triggerId}
          data-part="content"
          data-state={dataState}
          hidden={!isOpen}
        >
          {children}
        </div>
      </div>
    );
  }
);

Disclosure.displayName = 'Disclosure';
export default Disclosure;
