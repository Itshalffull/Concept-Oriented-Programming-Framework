// ============================================================
// Clef Surface NativeScript Widget — ToastManager
//
// Container that manages multiple toast notifications.
// ============================================================

import { StackLayout } from '@nativescript/core';

export interface ToastItem {
  id: string;
  title?: string;
  description?: string;
  variant?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
}

export interface ToastManagerProps {
  toasts?: ToastItem[];
  placement?: 'top-start' | 'top-center' | 'top-end' | 'bottom-start' | 'bottom-center' | 'bottom-end';
  maxVisible?: number;
  onDismiss?: (id: string) => void;
}

export function createToastManager(props: ToastManagerProps): StackLayout {
  const { toasts = [], placement = 'bottom-end', maxVisible = 5, onDismiss } = props;
  const container = new StackLayout();
  container.className = `clef-widget-toast-manager clef-placement-${placement}`;
  container.accessibilityRole = 'log';
  container.accessibilityLabel = 'Notifications';
  return container;
}

export default createToastManager;
