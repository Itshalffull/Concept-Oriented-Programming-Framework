'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useReducer,
  useRef,
  type ClipboardEvent,
  type HTMLAttributes,
  type KeyboardEvent,
} from 'react';
import { pinReducer } from './PinInput.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface PinInputProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Number of input cells. */
  length?: number;
  /** Input type: numeric or alphanumeric. */
  type?: 'numeric' | 'alphanumeric';
  /** Mask input like a password field. */
  mask?: boolean;
  /** Disabled state. */
  disabled?: boolean;
  /** Whether the field is required. */
  required?: boolean;
  /** Auto-focus the first cell on mount. */
  autoFocus?: boolean;
  /** Placeholder for empty cells. */
  placeholder?: string;
  /** Form field name. */
  name?: string;
  /** Accessible label. */
  label?: string;
  /** Size variant. */
  size?: 'sm' | 'md' | 'lg';
  /** Called with the current values array on every input. */
  onChange?: (values: string[]) => void;
  /** Called when all cells are filled. */
  onComplete?: (value: string) => void;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const PinInput = forwardRef<HTMLDivElement, PinInputProps>(function PinInput(
  {
    length = 6,
    type = 'numeric',
    mask = false,
    disabled = false,
    required = false,
    autoFocus = false,
    placeholder = '',
    name,
    label = 'Verification code',
    size = 'md',
    onChange,
    onComplete,
    ...rest
  },
  ref,
) {
  const [machine, send] = useReducer(pinReducer, {
    completion: 'empty',
    focus: 'unfocused',
  });

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const valuesRef = useRef<string[]>(Array.from({ length }, () => ''));
  const focusedIndex = useRef(0);

  const pattern = type === 'numeric' ? /^[0-9]$/ : /^[a-zA-Z0-9]$/;

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [autoFocus]);

  const emitChange = useCallback(() => {
    onChange?.(valuesRef.current.slice());
    const filled = valuesRef.current.filter(Boolean).length;
    if (filled === length) {
      send({ type: 'FILL_ALL' });
      onComplete?.(valuesRef.current.join(''));
    } else if (filled === 0) {
      send({ type: 'CLEAR_ALL' });
    }
  }, [onChange, onComplete, length]);

  const focusCell = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(index, length - 1));
    focusedIndex.current = clamped;
    inputRefs.current[clamped]?.focus();
  }, [length]);

  const handleInput = useCallback(
    (index: number, char: string) => {
      if (!pattern.test(char)) return;
      valuesRef.current[index] = char;
      send({ type: 'INPUT' });
      emitChange();
      if (index < length - 1) focusCell(index + 1);
    },
    [pattern, emitChange, length, focusCell],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>, index: number) => {
      switch (e.key) {
        case 'Backspace': {
          e.preventDefault();
          if (valuesRef.current[index]) {
            valuesRef.current[index] = '';
            send({ type: 'DELETE_CHAR' });
            emitChange();
          } else if (index > 0) {
            valuesRef.current[index - 1] = '';
            send({ type: 'DELETE_CHAR' });
            emitChange();
            focusCell(index - 1);
          }
          break;
        }
        case 'Delete': {
          e.preventDefault();
          valuesRef.current[index] = '';
          send({ type: 'DELETE_CHAR' });
          emitChange();
          break;
        }
        case 'ArrowLeft':
          e.preventDefault();
          focusCell(index - 1);
          break;
        case 'ArrowRight':
          e.preventDefault();
          focusCell(index + 1);
          break;
        case 'Home':
          e.preventDefault();
          focusCell(0);
          break;
        case 'End':
          e.preventDefault();
          focusCell(length - 1);
          break;
      }
    },
    [emitChange, focusCell, length],
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pasted = e.clipboardData.getData('text').split('');
      let idx = focusedIndex.current;
      for (const char of pasted) {
        if (idx >= length) break;
        if (pattern.test(char)) {
          valuesRef.current[idx] = char;
          idx++;
        }
      }
      send({ type: 'PASTE' });
      emitChange();
      focusCell(Math.min(idx, length - 1));
    },
    [pattern, length, emitChange, focusCell],
  );

  const cells = Array.from({ length }, (_, i) => i);

  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      aria-roledescription="PIN input"
      data-part="root"
      data-state={machine.completion}
      data-disabled={disabled ? 'true' : 'false'}
      data-size={size}
      data-surface-widget=""
      data-widget-name="pin-input"
      {...rest}
    >
      <label data-part="label" data-disabled={disabled ? 'true' : 'false'}>
        {label}
      </label>
      {cells.map((index) => (
        <input
          key={index}
          ref={(el) => { inputRefs.current[index] = el; }}
          role="textbox"
          aria-label={`Digit ${index + 1} of ${length}`}
          aria-required={required ? 'true' : 'false'}
          aria-disabled={disabled ? 'true' : 'false'}
          inputMode={type === 'numeric' ? 'numeric' : 'text'}
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          type={mask ? 'password' : 'text'}
          maxLength={1}
          pattern={type === 'numeric' ? '[0-9]' : '[a-zA-Z0-9]'}
          placeholder={machine.focus === 'focused' && focusedIndex.current === index ? '' : placeholder}
          disabled={disabled}
          value={valuesRef.current[index]}
          data-part="input"
          data-state={valuesRef.current[index] ? 'filled' : 'empty'}
          data-focused={focusedIndex.current === index && machine.focus === 'focused' ? 'true' : 'false'}
          data-index={index}
          tabIndex={focusedIndex.current === index ? 0 : -1}
          onInput={(e) => {
            const target = e.target as HTMLInputElement;
            const char = target.value.slice(-1);
            target.value = '';
            handleInput(index, char);
          }}
          onFocus={() => {
            focusedIndex.current = index;
            send({ type: 'FOCUS' });
          }}
          onBlur={() => send({ type: 'BLUR' })}
          onPaste={handlePaste}
          onKeyDown={(e) => handleKeyDown(e, index)}
        />
      ))}
      {name && <input type="hidden" name={name} value={valuesRef.current.join('')} />}
    </div>
  );
});

PinInput.displayName = 'PinInput';
export { PinInput };
export default PinInput;
