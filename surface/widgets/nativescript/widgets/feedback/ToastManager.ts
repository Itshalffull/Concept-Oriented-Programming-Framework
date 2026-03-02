// ============================================================
// Clef Surface NativeScript Widget — ToastManager
//
// Manages a queue of toast notifications, displaying them one
// at a time in a stacking layout. Handles auto-dismiss timing,
// maximum visible toasts, and provides imperative show/dismiss
// methods. Uses the Toast widget internally to render each
// notification.
// ============================================================

import { StackLayout, GridLayout, Label, Button, Color } from '@nativescript/core';

// --------------- Types ---------------

export type ToastManagerPosition = 'top' | 'bottom';

export type ToastSeverity = 'default' | 'success' | 'error' | 'warning' | 'info';

export interface ToastEntry {
  id: string;
  message: string;
  severity?: ToastSeverity;
  icon?: string;
  actionLabel?: string;
  duration?: number;
  onAction?: () => void;
  onDismiss?: () => void;
}

// --------------- Props ---------------

export interface ToastManagerProps {
  position?: ToastManagerPosition;
  maxVisible?: number;
  defaultDuration?: number;
  spacing?: number;
  onQueueEmpty?: () => void;
}

// --------------- Helpers ---------------

const SEVERITY_STYLES: Record<ToastSeverity, { bg: string; fg: string }> = {
  default: { bg: '#323232', fg: '#FFFFFF' },
  success: { bg: '#2E7D32', fg: '#FFFFFF' },
  error:   { bg: '#C62828', fg: '#FFFFFF' },
  warning: { bg: '#EF6C00', fg: '#FFFFFF' },
  info:    { bg: '#1565C0', fg: '#FFFFFF' },
};

let toastIdCounter = 0;

function generateToastId(): string {
  toastIdCounter++;
  return `clef-toast-${Date.now()}-${toastIdCounter}`;
}

// --------------- Component ---------------

export function createToastManager(props: ToastManagerProps = {}): StackLayout {
  const {
    position = 'bottom',
    maxVisible = 3,
    defaultDuration = 3000,
    spacing = 6,
    onQueueEmpty,
  } = props;

  const queue: ToastEntry[] = [];
  const activeTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const activeViews = new Map<string, GridLayout>();

  const container = new StackLayout();
  container.className = `clef-toast-manager clef-toast-manager-${position}`;
  container.verticalAlignment = position === 'top' ? 'top' : 'bottom';
  container.horizontalAlignment = 'center';
  container.padding = '8 16';

  // --- Build a single toast bar ---
  function buildToastView(entry: ToastEntry): GridLayout {
    const severity = entry.severity ?? 'default';
    const style = SEVERITY_STYLES[severity];

    const hasIcon = !!entry.icon;
    const hasAction = !!entry.actionLabel;
    const cols = [
      hasIcon ? 'auto' : '',
      '*',
      hasAction ? 'auto' : '',
      'auto',
    ].filter(Boolean).join(', ');

    const bar = new GridLayout();
    bar.className = `clef-toast-manager-toast clef-toast-${severity}`;
    bar.columns = cols;
    bar.backgroundColor = style.bg as any;
    bar.borderRadius = 8;
    bar.padding = '10 14';
    bar.marginBottom = spacing;
    bar.androidElevation = 6;

    let colIdx = 0;

    if (entry.icon) {
      const iconLabel = new Label();
      iconLabel.text = entry.icon;
      iconLabel.className = 'clef-toast-manager-icon';
      iconLabel.fontSize = 16;
      iconLabel.color = new Color(style.fg);
      iconLabel.verticalAlignment = 'middle';
      iconLabel.marginRight = 8;
      GridLayout.setColumn(iconLabel, colIdx);
      bar.addChild(iconLabel);
      colIdx++;
    }

    const msgLabel = new Label();
    msgLabel.text = entry.message;
    msgLabel.className = 'clef-toast-manager-message';
    msgLabel.fontSize = 14;
    msgLabel.color = new Color(style.fg);
    msgLabel.textWrap = true;
    msgLabel.verticalAlignment = 'middle';
    GridLayout.setColumn(msgLabel, colIdx);
    bar.addChild(msgLabel);
    colIdx++;

    if (entry.actionLabel) {
      const actionBtn = new Button();
      actionBtn.text = entry.actionLabel;
      actionBtn.className = 'clef-toast-manager-action';
      actionBtn.fontSize = 13;
      actionBtn.fontWeight = 'bold';
      actionBtn.color = new Color('#BBDEFB');
      actionBtn.backgroundColor = 'transparent' as any;
      actionBtn.borderWidth = 0;
      actionBtn.verticalAlignment = 'middle';
      actionBtn.marginLeft = 10;
      actionBtn.padding = '2 6';
      if (entry.onAction) {
        const handler = entry.onAction;
        actionBtn.on('tap', () => {
          handler();
          dismissToast(entry.id);
        });
      }
      GridLayout.setColumn(actionBtn, colIdx);
      bar.addChild(actionBtn);
      colIdx++;
    }

    // --- Close button ---
    const closeBtn = new Button();
    closeBtn.text = '\u2715';
    closeBtn.className = 'clef-toast-manager-close';
    closeBtn.fontSize = 12;
    closeBtn.color = new Color(style.fg);
    closeBtn.backgroundColor = 'transparent' as any;
    closeBtn.borderWidth = 0;
    closeBtn.verticalAlignment = 'middle';
    closeBtn.marginLeft = 8;
    closeBtn.opacity = 0.7;
    closeBtn.padding = '0 2';
    closeBtn.on('tap', () => dismissToast(entry.id));
    GridLayout.setColumn(closeBtn, colIdx);
    bar.addChild(closeBtn);

    return bar;
  }

  // --- Process the queue ---
  function processQueue(): void {
    while (activeViews.size < maxVisible && queue.length > 0) {
      const entry = queue.shift()!;
      const view = buildToastView(entry);
      activeViews.set(entry.id, view);

      if (position === 'top') {
        // Newest at the top: insert at beginning
        container.insertChild(view, 0);
      } else {
        container.addChild(view);
      }

      // Start auto-dismiss timer
      const dur = entry.duration ?? defaultDuration;
      if (dur > 0) {
        const timer = setTimeout(() => dismissToast(entry.id), dur);
        activeTimers.set(entry.id, timer);
      }
    }
  }

  // --- Dismiss a toast by id ---
  function dismissToast(id: string): void {
    const timer = activeTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      activeTimers.delete(id);
    }

    const view = activeViews.get(id);
    if (view) {
      container.removeChild(view);
      activeViews.delete(id);
    }

    // Find and remove from pending queue
    const queueIdx = queue.findIndex((e) => e.id === id);
    if (queueIdx >= 0) {
      const removed = queue.splice(queueIdx, 1)[0];
      if (removed.onDismiss) removed.onDismiss();
    }

    processQueue();

    if (activeViews.size === 0 && queue.length === 0 && onQueueEmpty) {
      onQueueEmpty();
    }
  }

  // --- Dismiss all ---
  function dismissAll(): void {
    for (const id of [...activeViews.keys()]) {
      dismissToast(id);
    }
    queue.length = 0;
  }

  // --- Public API attached to the container ---
  (container as any).show = (
    message: string,
    opts: Partial<Omit<ToastEntry, 'id' | 'message'>> = {},
  ): string => {
    const id = generateToastId();
    const entry: ToastEntry = { id, message, ...opts };
    queue.push(entry);
    processQueue();
    return id;
  };

  (container as any).dismiss = dismissToast;
  (container as any).dismissAll = dismissAll;
  (container as any).getQueueSize = (): number => queue.length + activeViews.size;

  return container;
}

createToastManager.displayName = 'ToastManager';
export default createToastManager;
