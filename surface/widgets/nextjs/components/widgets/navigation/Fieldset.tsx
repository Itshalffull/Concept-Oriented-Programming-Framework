'use client';

import {
  forwardRef,
  useReducer,
  useCallback,
  useId,
  type ReactNode,
  type HTMLAttributes,
} from 'react';
import { fieldsetDisclosureReducer } from './Fieldset.reducer.js';

// ---------------------------------------------------------------------------
// Fieldset — Form field grouping with accessible legend label.
// Supports optional collapsible sections and description text.
// Derived from fieldset.widget spec.
// ---------------------------------------------------------------------------

export interface FieldsetProps extends Omit<HTMLAttributes<HTMLFieldSetElement>, 'children'> {
  label: string;
  disabled?: boolean;
  collapsible?: boolean;
  defaultOpen?: boolean;
  description?: string;
  children?: ReactNode;
  variant?: string;
  size?: string;
}

export const Fieldset = forwardRef<HTMLFieldSetElement, FieldsetProps>(
  function Fieldset(
    {
      label,
      disabled = false,
      collapsible = false,
      defaultOpen = true,
      description,
      children,
      variant,
      size,
      className,
      ...rest
    },
    ref
  ) {
    const id = useId();
    const legendId = `fieldset-legend-${id}`;
    const descriptionId = `fieldset-desc-${id}`;

    const [disclosureState, dispatch] = useReducer(
      fieldsetDisclosureReducer,
      defaultOpen ? 'expanded' : 'collapsed'
    );

    const isOpen = disclosureState === 'expanded';
    const dataState = collapsible ? (isOpen ? 'open' : 'closed') : 'static';

    const handleToggle = useCallback(() => {
      if (!collapsible) return;
      dispatch({ type: 'TOGGLE' });
    }, [collapsible]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (!collapsible) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleToggle();
        }
      },
      [collapsible, handleToggle]
    );

    return (
      <fieldset
        ref={ref}
        role="group"
        aria-labelledby={legendId}
        aria-describedby={description ? descriptionId : undefined}
        aria-disabled={disabled ? 'true' : 'false'}
        className={className}
        disabled={disabled}
        data-surface-widget=""
        data-widget-name="fieldset"
        data-part="root"
        data-disabled={disabled ? 'true' : 'false'}
        data-collapsible={collapsible ? 'true' : 'false'}
        data-state={dataState}
        data-variant={variant}
        data-size={size}
        {...rest}
      >
        <legend
          id={legendId}
          role={collapsible ? 'button' : undefined}
          aria-expanded={collapsible ? isOpen : undefined}
          tabIndex={collapsible ? 0 : undefined}
          data-part="legend"
          onClick={collapsible ? handleToggle : undefined}
          onKeyDown={collapsible ? handleKeyDown : undefined}
        >
          {label}
        </legend>
        {description && (
          <span
            id={descriptionId}
            data-part="description"
          >
            {description}
          </span>
        )}
        <div
          data-part="content"
          data-state={dataState}
          hidden={collapsible ? !isOpen : false}
        >
          {children}
        </div>
      </fieldset>
    );
  }
);

Fieldset.displayName = 'Fieldset';
export default Fieldset;
