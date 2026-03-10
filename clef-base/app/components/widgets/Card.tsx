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
}) => {
  return (
    <div
      role={clickable ? 'article' : 'region'}
      aria-labelledby={title ? 'card-title' : undefined}
      data-part="card"
      data-variant={variant}
      data-clickable={clickable ? 'true' : 'false'}
      data-padding={padding}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? onClick : undefined}
      onKeyDown={
        clickable
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
