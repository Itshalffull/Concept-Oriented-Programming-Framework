'use client';
import { forwardRef, useReducer, useId, useCallback, type ReactNode, type KeyboardEvent, type MouseEvent } from 'react';
import { cardReducer, cardInitialState } from './Card.reducer.js';

// Props from card.widget spec
export interface CardProps {
  variant?: 'elevated' | 'filled' | 'outlined';
  clickable?: boolean;
  href?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  size?: 'sm' | 'md' | 'lg';
  header?: ReactNode;
  media?: ReactNode;
  footer?: ReactNode;
  actions?: ReactNode;
  title?: string;
  description?: string;
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  function Card(
    {
      variant = 'elevated',
      clickable = false,
      href,
      padding = 'md',
      size = 'md',
      header,
      media,
      footer,
      actions,
      title,
      description,
      onClick,
      className,
      children,
    },
    ref
  ) {
    const [state, dispatch] = useReducer(cardReducer, cardInitialState);
    const titleId = useId();
    const descriptionId = useId();

    const handleActivate = useCallback(() => {
      dispatch({ type: 'ACTIVATE' });
      if (href) {
        window.location.href = href;
      }
      onClick?.();
    }, [href, onClick]);

    const handleKeyDown = useCallback(
      (e: KeyboardEvent<HTMLDivElement>) => {
        if (!clickable) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleActivate();
        }
      },
      [clickable, handleActivate]
    );

    return (
      <div
        ref={ref}
        className={className}
        role={clickable ? 'article' : 'region'}
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={clickable ? 0 : undefined}
        onClick={clickable ? handleActivate : undefined}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => dispatch({ type: 'HOVER' })}
        onMouseLeave={() => dispatch({ type: 'UNHOVER' })}
        onFocus={() => dispatch({ type: 'FOCUS' })}
        onBlur={() => dispatch({ type: 'BLUR' })}
        onPointerDown={() => dispatch({ type: 'PRESS' })}
        onPointerUp={() => dispatch({ type: 'RELEASE' })}
        data-surface-widget=""
        data-widget-name="card"
        data-part="root"
        data-variant={variant}
        data-clickable={clickable ? 'true' : 'false'}
        data-state={state.current}
        data-padding={padding}
        data-size={size}
      >
        {header && (
          <div data-part="header" data-variant={variant}>
            {title && (
              <span id={titleId} data-part="title">
                {title}
              </span>
            )}
            {header}
          </div>
        )}
        {!header && title && (
          <div data-part="header" data-variant={variant}>
            <span id={titleId} data-part="title">
              {title}
            </span>
            {description && (
              <span id={descriptionId} data-part="description">
                {description}
              </span>
            )}
          </div>
        )}
        {media && (
          <div data-part="media" aria-hidden="true">
            {media}
          </div>
        )}
        <div data-part="body" data-padding={padding}>
          {children}
        </div>
        {(footer || actions) && (
          <div data-part="footer" data-variant={variant}>
            {footer}
            {actions && (
              <div data-part="actions" role="group" aria-label="Card actions">
                {actions}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
);

Card.displayName = 'Card';
export default Card;
