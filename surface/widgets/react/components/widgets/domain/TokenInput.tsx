/* ---------------------------------------------------------------------------
 * TokenInput state machine
 * States: static (initial), hovered, focused, selected
 * ------------------------------------------------------------------------- */

export type TokenState = 'static' | 'hovered' | 'focused' | 'selected';
export type TokenEvent =
  | { type: 'HOVER' }
  | { type: 'UNHOVER' }
  | { type: 'FOCUS' }
  | { type: 'BLUR' }
  | { type: 'SELECT' }
  | { type: 'DESELECT' }
  | { type: 'REMOVE' };

export function tokenReducer(state: TokenState, event: TokenEvent): TokenState {
  switch (state) {
    case 'static':
      if (event.type === 'HOVER') return 'hovered';
      if (event.type === 'FOCUS') return 'focused';
      if (event.type === 'SELECT') return 'selected';
      return state;
    case 'hovered':
      if (event.type === 'UNHOVER') return 'static';
      if (event.type === 'FOCUS') return 'focused';
      if (event.type === 'SELECT') return 'selected';
      return state;
    case 'focused':
      if (event.type === 'BLUR') return 'static';
      if (event.type === 'SELECT') return 'selected';
      return state;
    case 'selected':
      if (event.type === 'DESELECT') return 'static';
      if (event.type === 'BLUR') return 'static';
      return state;
    default:
      return state;
  }
}

import {
  forwardRef,
  useCallback,
  useReducer,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from 'react';


/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface TokenInputProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'id' | 'children'> {
  /** Display label. */
  label: string;
  /** Data type of the token. */
  type?: string;
  /** Whether the token can be removed. */
  removable?: boolean;
  /** Whether the token is disabled. */
  disabled?: boolean;
  /** Color for the token pill. */
  color?: string;
  /** Internal value. */
  value?: string;
  /** Unique ID. */
  id?: string;
  /** Called on remove. */
  onRemove?: () => void;
  /** Called on select. */
  onSelect?: () => void;
  /** Type icon slot. */
  typeIcon?: ReactNode;
  /** Remove button icon. */
  removeIcon?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const TokenInput = forwardRef<HTMLSpanElement, TokenInputProps>(function TokenInput(
  {
    label,
    type,
    removable = false,
    disabled = false,
    color,
    value,
    id,
    onRemove,
    onSelect,
    typeIcon,
    removeIcon,
    ...rest
  },
  ref,
) {
  const [state, send] = useReducer(tokenReducer, 'static');

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLSpanElement>) => {
      if (disabled) return;
      if ((e.key === 'Backspace' || e.key === 'Delete') && removable) {
        e.preventDefault();
        onRemove?.();
      }
      if (e.key === 'Enter') { e.preventDefault(); send({ type: 'SELECT' }); onSelect?.(); }
      if (e.key === 'Escape') { e.preventDefault(); send({ type: 'DESELECT' }); }
    },
    [disabled, removable, onRemove, onSelect],
  );

  const ariaLabel = `${label}${type ? ` (${type})` : ''}`;

  return (
    <span
      ref={ref}
      role="option"
      aria-label={ariaLabel}
      aria-roledescription="token"
      aria-selected={state === 'selected' || undefined}
      aria-disabled={disabled || undefined}
      data-surface-widget=""
      data-widget-name="token-input"
      data-part="token"
      data-type={type}
      data-state={state}
      data-removable={removable ? 'true' : 'false'}
      data-disabled={disabled ? 'true' : 'false'}
      data-color={color}
      tabIndex={disabled ? -1 : 0}
      onClick={() => { if (!disabled) { send({ type: 'SELECT' }); onSelect?.(); } }}
      onPointerEnter={() => send({ type: 'HOVER' })}
      onPointerLeave={() => send({ type: 'UNHOVER' })}
      onFocus={() => send({ type: 'FOCUS' })}
      onBlur={() => send({ type: 'BLUR' })}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      {type && (
        <span
          data-part="type-icon"
          data-type={type}
          data-visible="true"
          aria-hidden={!type || undefined}
          aria-label={type ? `Type: ${type}` : ''}
        >
          {typeIcon}
        </span>
      )}

      <span data-part="label">{label}</span>

      {removable && !disabled && (
        <button
          type="button"
          role="button"
          aria-label={`Remove ${label} token`}
          data-part="remove"
          data-visible="true"
          tabIndex={-1}
          onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
        >
          {removeIcon ?? '\u2715'}
        </button>
      )}
    </span>
  );
});

TokenInput.displayName = 'TokenInput';
export { TokenInput };
export default TokenInput;
