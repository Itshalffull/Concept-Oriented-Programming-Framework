'use client';

import {
  forwardRef,
  useCallback,
  type ReactNode,
  type HTMLAttributes,
} from 'react';
import { useRovingFocus } from '../shared/useRovingFocus.js';

// ---------------------------------------------------------------------------
// Toolbar — Horizontal or vertical row of action controls.
// Single tab stop with roving tabindex navigation.
// Derived from toolbar.widget spec.
// ---------------------------------------------------------------------------

export interface ToolbarProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  label: string;
  orientation?: 'horizontal' | 'vertical';
  loop?: boolean;
  children?: ReactNode;
  variant?: string;
  size?: string;
}

export interface ToolbarGroupProps extends HTMLAttributes<HTMLDivElement> {
  children?: ReactNode;
  orientation?: 'horizontal' | 'vertical';
}

export interface ToolbarSeparatorProps extends HTMLAttributes<HTMLDivElement> {
  orientation?: 'horizontal' | 'vertical';
}

export const ToolbarGroup = forwardRef<HTMLDivElement, ToolbarGroupProps>(
  function ToolbarGroup({ children, orientation, className, ...rest }, ref) {
    return (
      <div
        ref={ref}
        role="group"
        className={className}
        data-part="group"
        data-orientation={orientation}
        {...rest}
      >
        {children}
      </div>
    );
  }
);
ToolbarGroup.displayName = 'ToolbarGroup';

export const ToolbarSeparator = forwardRef<HTMLDivElement, ToolbarSeparatorProps>(
  function ToolbarSeparator({ orientation = 'horizontal', className, ...rest }, ref) {
    const separatorOrientation = orientation === 'horizontal' ? 'vertical' : 'horizontal';
    return (
      <div
        ref={ref}
        role="separator"
        aria-orientation={separatorOrientation}
        aria-hidden="true"
        className={className}
        data-part="separator"
        data-orientation={orientation}
        {...rest}
      />
    );
  }
);
ToolbarSeparator.displayName = 'ToolbarSeparator';

export const Toolbar = forwardRef<HTMLDivElement, ToolbarProps>(
  function Toolbar(
    {
      label,
      orientation = 'horizontal',
      loop = true,
      children,
      variant,
      size,
      className,
      ...rest
    },
    ref
  ) {
    const rovingOrientation = orientation === 'horizontal' ? 'horizontal' : 'vertical';
    const { getItemProps } = useRovingFocus({
      orientation: rovingOrientation,
      loop,
    });

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        // Roving focus is handled by individual items via getItemProps.
        // This handler is available for additional toolbar-level key handling.
        void e;
      },
      []
    );

    return (
      <div
        ref={ref}
        role="toolbar"
        aria-label={label}
        aria-orientation={orientation}
        className={className}
        data-surface-widget=""
        data-widget-name="toolbar"
        data-part="root"
        data-orientation={orientation}
        data-variant={variant}
        data-size={size}
        onKeyDown={handleKeyDown}
        {...rest}
      >
        {children}
      </div>
    );
  }
);

Toolbar.displayName = 'Toolbar';
export default Toolbar;
