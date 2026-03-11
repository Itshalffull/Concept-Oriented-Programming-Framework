'use client';

/**
 * Badge — Status/label indicator
 * Implements repertoire/widgets/primitives/badge.widget
 */

import React from 'react';

export interface BadgeProps {
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
  children: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'secondary', children }) => {
  return (
    <span data-part="badge" data-variant={variant}>
      {children}
    </span>
  );
};

export default Badge;
