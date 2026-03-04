import React, { useState, useCallback, type ReactNode } from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';

export interface ToastItem {
  id: string;
  content: ReactNode;
}

export interface ToastManagerProps {
  placement?: string;
  max?: number;
  gap?: number;
  toasts?: ToastItem[];
  onToastDismiss?: (id: string) => void;
  renderToast?: (item: ToastItem, onDismiss: () => void) => ReactNode;
  style?: ViewStyle;
}

export const ToastManager: React.FC<ToastManagerProps> = ({
  placement = 'bottom-right',
  max = 5,
  gap = 8,
  toasts: controlledToasts,
  onToastDismiss,
  renderToast,
  style,
}) => {
  const [internalToasts, setInternalToasts] = useState<ToastItem[]>([]);
  const toasts = controlledToasts ?? internalToasts;
  const visibleToasts = toasts.slice(-max);

  const handleDismiss = useCallback((id: string) => {
    setInternalToasts(prev => prev.filter(t => t.id !== id));
    onToastDismiss?.(id);
  }, [onToastDismiss]);

  const isBottom = placement.includes('bottom');
  const isRight = placement.includes('right');

  return (
    <View
      style={[
        styles.root,
        isBottom ? styles.bottom : styles.top,
        isRight ? styles.right : styles.left,
        { gap },
        style,
      ]}
      accessibilityRole="summary"
      accessibilityLabel="Notifications"
      accessibilityLiveRegion="polite"
    >
      {visibleToasts.map((item) => (
        <View key={item.id}>
          {renderToast
            ? renderToast(item, () => handleDismiss(item.id))
            : item.content}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { position: 'absolute', zIndex: 9999, padding: 16 },
  bottom: { bottom: 0 },
  top: { top: 0 },
  right: { right: 0 },
  left: { left: 0 },
});

ToastManager.displayName = 'ToastManager';
export default ToastManager;
