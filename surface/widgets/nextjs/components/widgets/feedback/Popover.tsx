'use client';

import {
  forwardRef,
  useCallback,
  useId,
  useReducer,
  useRef,
  useEffect,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { useFloatingPosition, type Placement } from '../shared/useFloatingPosition.js';
import { useOutsideClick } from '../shared/useOutsideClick.js';
import { popoverReducer } from './Popover.reducer.js';

/* ---------------------------------------------------------------------------
 * Props
 * ------------------------------------------------------------------------- */

export interface PopoverProps extends Omit<HTMLAttributes<HTMLDivElement>, 'content' | 'title'> {
  /** Controlled open state. */
  open?: boolean;
  /** Preferred placement relative to the trigger. */
  placement?: Placement;
  /** Whether clicking outside closes the popover. */
  closeOnOutsideClick?: boolean;
  /** Whether pressing Escape closes the popover. */
  closeOnEscape?: boolean;
  /** Callback when the popover requests to close. */
  onOpenChange?: (open: boolean) => void;
  /** Trigger element. */
  trigger?: ReactNode;
  /** Optional popover title. */
  title?: ReactNode;
  /** Optional popover description. */
  description?: ReactNode;
  /** Content inside the popover. */
  children?: ReactNode;
}

/* ---------------------------------------------------------------------------
 * Component
 * ------------------------------------------------------------------------- */

const Popover = forwardRef<HTMLDivElement, PopoverProps>(function Popover(
  {
    open: controlledOpen,
    placement = 'bottom',
    closeOnOutsideClick = true,
    closeOnEscape = true,
    onOpenChange,
    trigger,
    title,
    description,
    children,
    ...rest
  },
  ref,
) {
  const [internalState, send] = useReducer(popoverReducer, 'closed');
  const isOpen = controlledOpen ?? internalState === 'open';

  const contentId = useId();
  const titleId = useId();
  const descriptionId = useId();

  const triggerRef = useRef<HTMLButtonElement>(null);
  const positionerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const position = useFloatingPosition(triggerRef, positionerRef, {
    placement,
    enabled: isOpen,
  });

  const handleToggle = useCallback(() => {
    const next = !isOpen;
    send({ type: 'TRIGGER_CLICK' });
    onOpenChange?.(next);
  }, [isOpen, onOpenChange]);

  const handleClose = useCallback(() => {
    send({ type: 'CLOSE' });
    onOpenChange?.(false);
  }, [onOpenChange]);

  // Outside click
  useOutsideClick(contentRef, () => {
    if (closeOnOutsideClick) {
      send({ type: 'OUTSIDE_CLICK' });
      onOpenChange?.(false);
    }
  }, isOpen);

  // Escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        send({ type: 'ESCAPE' });
        onOpenChange?.(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, closeOnEscape, onOpenChange]);

  return (
    <div
      ref={ref}
      data-part="root"
      data-state={isOpen ? 'open' : 'closed'}
      data-surface-widget=""
      data-widget-name="popover"
      {...rest}
    >
      <button
        ref={triggerRef}
        type="button"
        data-part="trigger"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? contentId : undefined}
        onClick={handleToggle}
      >
        {trigger}
      </button>

      {isOpen && (
        <div
          ref={positionerRef}
          data-part="positioner"
          data-state="open"
          data-placement={position.placement}
          style={{
            position: 'fixed',
            left: position.x,
            top: position.y,
          }}
        >
          <div
            ref={contentRef}
            data-part="content"
            role="dialog"
            aria-modal={false}
            aria-labelledby={title ? titleId : undefined}
            aria-describedby={description ? descriptionId : undefined}
            id={contentId}
            data-state="open"
            data-placement={position.placement}
          >
            {title && (
              <div data-part="title" id={titleId}>
                {title}
              </div>
            )}
            {description && (
              <div data-part="description" id={descriptionId}>
                {description}
              </div>
            )}
            {children}
            <button
              type="button"
              data-part="close-trigger"
              aria-label="Close popover"
              onClick={handleClose}
            >
              &#x2715;
            </button>
          </div>
          <div data-part="arrow" data-placement={position.placement} />
        </div>
      )}
    </div>
  );
});

Popover.displayName = 'Popover';
export { Popover };
export default Popover;
