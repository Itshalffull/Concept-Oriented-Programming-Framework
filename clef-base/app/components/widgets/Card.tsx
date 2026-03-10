'use client';

/**
 * Card — Surface container for grouped content
 * Implements repertoire/widgets/data-display/card.widget
 */

import React from 'react';

export interface CardProps {
  variant?: 'elevated' | 'filled' | 'outlined';
  clickable?: boolean;
  href?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  title?: string;
  description?: string;
  children?: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const Card: React.FC<CardProps> = ({
  variant = 'elevated',
  clickable = false,
  padding = 'md',
  title,
  description,
  children,
  header,
  footer,
  onClick,
  className,
  style,
}) => {
  const interactive = clickable || !!onClick;

  return (
    <div
      role={interactive ? 'article' : 'region'}
      aria-labelledby={title ? 'card-title' : undefined}
      data-part="card"
      data-variant={variant}
      data-clickable={interactive ? 'true' : 'false'}
      data-padding={padding}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onClick : undefined}
      className={className}
      style={style}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') onClick?.();
            }
          : undefined
      }
    >
      {(title || header) && (
        <div data-part="header" data-variant={variant}>
          {title && <div data-part="title">{title}</div>}
          {description && <div data-part="description">{description}</div>}
          {header}
        </div>
      )}
      {children && (
        <div data-part="body" data-padding={padding}>
          {children}
        </div>
      )}
      {footer && (
        <div data-part="footer" data-variant={variant}>
          {footer}
        </div>
      )}
    </div>
  );
};

export default Card;
