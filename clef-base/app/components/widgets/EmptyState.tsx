'use client';

/**
 * EmptyState — Placeholder when data view contains no items
 * Implements repertoire/widgets/feedback/empty-state.widget
 */

import React from 'react';

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ title, description, icon, action }) => {
  return (
    <div data-part="empty-state" role="status">
      {icon && <div data-part="icon">{icon}</div>}
      <div data-part="title">{title}</div>
      {description && <div data-part="description">{description}</div>}
      {action && <div data-part="action">{action}</div>}
    </div>
  );
};

export default EmptyState;
