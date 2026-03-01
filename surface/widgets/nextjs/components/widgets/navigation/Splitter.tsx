'use client';

import {
  forwardRef,
  useReducer,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
  type HTMLAttributes,
} from 'react';
import { splitterReducer } from './Splitter.reducer.js';

// ---------------------------------------------------------------------------
// Splitter — Resizable split panes with draggable divider.
// Tracks panel sizes via mouse/pointer drag events with keyboard support.
// Derived from splitter.widget spec.
// ---------------------------------------------------------------------------

export interface SplitterProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  orientation?: 'horizontal' | 'vertical';
  defaultSize?: number;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  onSizeChange?: (size: number) => void;
  panelBefore?: ReactNode;
  panelAfter?: ReactNode;
  variant?: string;
  size?: string;
}

export const Splitter = forwardRef<HTMLDivElement, SplitterProps>(
  function Splitter(
    {
      orientation = 'horizontal',
      defaultSize = 50,
      min = 10,
      max = 90,
      step = 1,
      disabled = false,
      onSizeChange,
      panelBefore,
      panelAfter,
      variant,
      size: sizeProp,
      className,
      ...rest
    },
    ref
  ) {
    const rootRef = useRef<HTMLDivElement | null>(null);
    const [state, dispatch] = useReducer(splitterReducer, {
      interaction: 'idle',
      panelSize: defaultSize,
    });

    const isDragging = state.interaction === 'dragging';
    const cursor = orientation === 'horizontal' ? 'col-resize' : 'row-resize';

    // Notify on size changes
    const prevSizeRef = useRef(state.panelSize);
    useEffect(() => {
      if (prevSizeRef.current !== state.panelSize) {
        prevSizeRef.current = state.panelSize;
        onSizeChange?.(state.panelSize);
      }
    }, [state.panelSize, onSizeChange]);

    // Global pointer move/up while dragging
    useEffect(() => {
      if (!isDragging || disabled) return;

      const handlePointerMove = (e: PointerEvent) => {
        const root = rootRef.current;
        if (!root) return;
        const rect = root.getBoundingClientRect();

        let ratio: number;
        if (orientation === 'horizontal') {
          ratio = ((e.clientX - rect.left) / rect.width) * 100;
        } else {
          ratio = ((e.clientY - rect.top) / rect.height) * 100;
        }
        const clamped = Math.max(min, Math.min(max, ratio));
        dispatch({ type: 'DRAG_MOVE', panelSize: Math.round(clamped * 100) / 100 });
      };

      const handlePointerUp = () => {
        dispatch({ type: 'DRAG_END' });
      };

      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
      return () => {
        document.removeEventListener('pointermove', handlePointerMove);
        document.removeEventListener('pointerup', handlePointerUp);
      };
    }, [isDragging, disabled, orientation, min, max]);

    const handlePointerDown = useCallback(
      (e: React.PointerEvent) => {
        if (disabled) return;
        e.preventDefault();
        dispatch({ type: 'DRAG_START' });
      },
      [disabled]
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (disabled) return;

        const decrementKeys = orientation === 'horizontal' ? ['ArrowLeft'] : ['ArrowUp'];
        const incrementKeys = orientation === 'horizontal' ? ['ArrowRight'] : ['ArrowDown'];

        if (incrementKeys.includes(e.key)) {
          e.preventDefault();
          dispatch({ type: 'RESIZE_INCREMENT', step, max });
        } else if (decrementKeys.includes(e.key)) {
          e.preventDefault();
          dispatch({ type: 'RESIZE_DECREMENT', step, min });
        } else if (e.key === 'Home') {
          e.preventDefault();
          dispatch({ type: 'RESIZE_MIN', min });
        } else if (e.key === 'End') {
          e.preventDefault();
          dispatch({ type: 'RESIZE_MAX', max });
        }
      },
      [disabled, orientation, step, min, max]
    );

    return (
      <div
        ref={(node) => {
          rootRef.current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        className={className}
        data-surface-widget=""
        data-widget-name="splitter"
        data-part="root"
        data-orientation={orientation}
        data-disabled={disabled ? 'true' : 'false'}
        data-state={state.interaction}
        data-variant={variant}
        data-size={sizeProp}
        style={{
          display: 'flex',
          flexDirection: orientation === 'horizontal' ? 'row' : 'column',
        }}
        {...rest}
      >
        <div
          data-part="panel-before"
          data-orientation={orientation}
          style={{
            flexBasis: `${state.panelSize}%`,
            minWidth: orientation === 'horizontal' ? `${min}%` : undefined,
            minHeight: orientation === 'vertical' ? `${min}%` : undefined,
            overflow: 'auto',
          }}
        >
          {panelBefore}
        </div>
        <div
          role="separator"
          aria-orientation={orientation}
          aria-valuenow={Math.round(state.panelSize)}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-label="Resize"
          tabIndex={disabled ? -1 : 0}
          data-part="handle"
          data-orientation={orientation}
          data-state={state.interaction}
          data-disabled={disabled ? 'true' : 'false'}
          style={{ cursor }}
          onPointerDown={handlePointerDown}
          onKeyDown={handleKeyDown}
          onFocus={() => dispatch({ type: 'FOCUS' })}
          onBlur={() => dispatch({ type: 'BLUR' })}
        />
        <div
          data-part="panel-after"
          data-orientation={orientation}
          style={{
            flexBasis: `${100 - state.panelSize}%`,
            maxWidth: orientation === 'horizontal' ? `${max}%` : undefined,
            maxHeight: orientation === 'vertical' ? `${max}%` : undefined,
            overflow: 'auto',
          }}
        >
          {panelAfter}
        </div>
      </div>
    );
  }
);

Splitter.displayName = 'Splitter';
export default Splitter;
