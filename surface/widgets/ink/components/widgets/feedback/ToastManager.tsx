// ============================================================
// Clef Surface Ink Widget — ToastManager
//
// Container that manages a stack of toast notifications.
// Controls ordering, maximum visible count, and lifecycle of
// individual toasts. Renders toasts stacked vertically at a
// specified position (communicated textually in the terminal).
// Auto-dismisses toasts after their configured duration.
//
// Terminal adaptation: stack of toast items rendered as a
// vertical list. Position is indicated via a label since
// terminals cannot anchor to viewport corners.
// See widget spec: repertoire/widgets/feedback/toast-manager.widget
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text } from 'ink';

// --------------- Types ---------------

const VARIANT_ICONS: Record<string, string> = {
  info: '\u2139',     // ℹ
  success: '\u2714',  // ✔
  warning: '\u26A0',  // ⚠
  error: '\u2716',    // ✖
};

const VARIANT_COLORS: Record<string, string> = {
  info: 'blue',
  success: 'green',
  warning: 'yellow',
  error: 'red',
};

export interface ToastItem {
  /** Unique identifier for the toast. */
  id: string;
  /** Visual variant. */
  variant?: 'info' | 'success' | 'warning' | 'error';
  /** Primary notification message. */
  title: string;
  /** Optional secondary detail text. */
  description?: string;
  /** Auto-dismiss duration in milliseconds. */
  duration?: number;
}

// --------------- Props ---------------

export interface ToastManagerProps {
  /** Array of toast items to display. */
  toasts: ToastItem[];
  /** Placement label (e.g., "top-right", "bottom-right"). */
  position?: string;
  /** Maximum number of visible toasts. */
  maxVisible?: number;
  /** Callback fired when a toast should be dismissed, with the toast id. */
  onDismiss?: (id: string) => void;
}

// --------------- Component ---------------

export const ToastManager: React.FC<ToastManagerProps> = ({
  toasts,
  position = 'bottom-right',
  maxVisible = 5,
  onDismiss,
}) => {
  // Track active dismiss timers
  const [activeTimers, setActiveTimers] = useState<Set<string>>(new Set());

  const visibleToasts = toasts.slice(0, maxVisible);

  // Set up auto-dismiss timers for each toast
  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    for (const toast of visibleToasts) {
      const duration = toast.duration ?? 5000;
      if (duration <= 0) continue;
      if (activeTimers.has(toast.id)) continue;

      const timer = setTimeout(() => {
        onDismiss?.(toast.id);
        setActiveTimers((prev) => {
          const next = new Set(prev);
          next.delete(toast.id);
          return next;
        });
      }, duration);

      timers.push(timer);
      setActiveTimers((prev) => new Set(prev).add(toast.id));
    }

    return () => {
      for (const timer of timers) {
        clearTimeout(timer);
      }
    };
  }, [visibleToasts.map((t) => t.id).join(',')]);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <Box flexDirection="column">
      {/* Position indicator */}
      <Text dimColor>{'\u250C'} Notifications ({position})</Text>

      {/* Toast stack */}
      {visibleToasts.map((toast) => {
        const variant = toast.variant ?? 'info';
        const icon = VARIANT_ICONS[variant] ?? VARIANT_ICONS.info;
        const color = VARIANT_COLORS[variant] ?? VARIANT_COLORS.info;

        return (
          <Box
            key={toast.id}
            flexDirection="column"
            borderStyle="round"
            borderColor={color}
            paddingX={1}
            paddingY={0}
            marginBottom={0}
          >
            <Box>
              <Text color={color}>{icon} </Text>
              <Text bold>{toast.title}</Text>
            </Box>
            {toast.description && (
              <Box marginLeft={2}>
                <Text>{toast.description}</Text>
              </Box>
            )}
          </Box>
        );
      })}

      {/* Overflow indicator */}
      {toasts.length > maxVisible && (
        <Text dimColor>  +{toasts.length - maxVisible} more notification(s)</Text>
      )}
    </Box>
  );
};

ToastManager.displayName = 'ToastManager';
export default ToastManager;
