// State machine from chip.widget spec
export type ChipState = 'idle' | 'selected' | 'hovered' | 'focused' | 'removed';
export type ChipEvent =
  | { type: 'SELECT' }
  | { type: 'DESELECT' }
  | { type: 'HOVER' }
  | { type: 'UNHOVER' }
  | { type: 'FOCUS' }
  | { type: 'BLUR' }
  | { type: 'DELETE' };

export function chipReducer(state: ChipState, event: ChipEvent): ChipState {
  switch (state) {
    case 'idle':
      if (event.type === 'SELECT') return 'selected';
      if (event.type === 'HOVER') return 'hovered';
      if (event.type === 'FOCUS') return 'focused';
      return state;
    case 'selected':
      if (event.type === 'DESELECT') return 'idle';
      return state;
    case 'hovered':
      if (event.type === 'UNHOVER') return 'idle';
      if (event.type === 'SELECT') return 'selected';
      return state;
    case 'focused':
      if (event.type === 'BLUR') return 'idle';
      if (event.type === 'SELECT') return 'selected';
      if (event.type === 'DELETE') return 'removed';
      return state;
    case 'removed':
      return state;
    default:
      return state;
  }
}

import { forwardRef, useReducer, useCallback, type ReactNode } from 'react';
import { chipReducer, type ChipState, type ChipEvent } from './Chip.reducer.js';

// Props from chip.widget spec
export interface ChipProps {
  label?: string;
  selected?: boolean;
  deletable?: boolean;
  disabled?: boolean;
  color?: string;
  value?: string;
  onSelect?: () => void;
  onDeselect?: () => void;
  onDelete?: () => void;
  icon?: ReactNode;
  className?: string;
}

export const Chip = forwardRef<HTMLDivElement, ChipProps>(
  function Chip(
    {
      label = '',
      selected = false,
      deletable = false,
      disabled = false,
      color,
      value,
      onSelect,
      onDeselect,
      onDelete,
      icon,
      className,
    },
    ref
  ) {
    const [state, send] = useReducer(chipReducer, selected ? 'selected' : 'idle');

    const isSelected = selected || state === 'selected';

    const handleClick = useCallback(() => {
      if (disabled) return;
      if (isSelected) {
        send({ type: 'DESELECT' });
        onDeselect?.();
      } else {
        send({ type: 'SELECT' });
        onSelect?.();
      }
    }, [disabled, isSelected, onSelect, onDeselect]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (disabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
        if ((e.key === 'Backspace' || e.key === 'Delete') && deletable) {
          e.preventDefault();
          send({ type: 'DELETE' });
          onDelete?.();
        }
      },
      [disabled, handleClick, deletable, onDelete]
    );

    const handleDeleteClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (disabled) return;
        send({ type: 'DELETE' });
        onDelete?.();
      },
      [disabled, onDelete]
    );

    if (state === 'removed') return null;

    return (
      <div
        ref={ref}
        role="option"
        aria-selected={isSelected ? 'true' : 'false'}
        aria-disabled={disabled ? 'true' : 'false'}
        tabIndex={disabled ? -1 : 0}
        className={className}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => send({ type: 'HOVER' })}
        onMouseLeave={() => send({ type: 'UNHOVER' })}
        onFocus={() => send({ type: 'FOCUS' })}
        onBlur={() => send({ type: 'BLUR' })}
        data-surface-widget=""
        data-widget-name="chip"
        data-part="root"
        data-state={isSelected ? 'selected' : 'idle'}
        data-disabled={disabled ? 'true' : 'false'}
        data-color={color}
      >
        {icon && (
          <span data-part="icon" aria-hidden="true">
            {icon}
          </span>
        )}
        <span data-part="label">{label}</span>
        {deletable && (
          <button
            type="button"
            data-part="delete-button"
            role="button"
            aria-label="Remove"
            tabIndex={-1}
            data-visible={deletable ? 'true' : 'false'}
            onClick={handleDeleteClick}
          >
            {/* delete icon rendered via CSS */}
          </button>
        )}
      </div>
    );
  }
);

Chip.displayName = 'Chip';
export default Chip;
