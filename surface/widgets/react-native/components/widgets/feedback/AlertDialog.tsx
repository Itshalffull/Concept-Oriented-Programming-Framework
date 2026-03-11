import React, { useCallback, type ReactNode } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, type ViewStyle } from 'react-native';

export interface AlertDialogProps {
  open?: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm?: () => void;
  onCancel?: () => void;
  children?: ReactNode;
  style?: ViewStyle;
}

export const AlertDialog: React.FC<AlertDialogProps> = ({
  open = false,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
  children,
  style,
}) => {
  const handleConfirm = useCallback(() => { onConfirm?.(); }, [onConfirm]);
  const handleCancel = useCallback(() => { onCancel?.(); }, [onCancel]);

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={handleCancel}>
      <View style={styles.overlay}>
        <View style={[styles.content, style]} accessibilityRole="alert">
          {title && <Text style={styles.title}>{title}</Text>}
          {description && <Text style={styles.description}>{description}</Text>}
          {children}
          <View style={styles.actions}>
            <Pressable onPress={handleCancel} style={styles.cancelButton} accessibilityRole="button">
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              style={[styles.confirmButton, destructive && styles.destructiveButton]}
              accessibilityRole="button"
            >
              <Text style={[styles.confirmText, destructive && styles.destructiveText]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  content: { backgroundColor: '#fff', borderRadius: 12, padding: 24, width: '85%', maxWidth: 400 },
  title: { fontSize: 18, fontWeight: '600', color: '#1e293b', marginBottom: 8 },
  description: { fontSize: 14, color: '#475569', marginBottom: 20 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  cancelButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1' },
  cancelText: { fontSize: 14, color: '#475569' },
  confirmButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6, backgroundColor: '#3b82f6' },
  confirmText: { fontSize: 14, color: '#fff', fontWeight: '500' },
  destructiveButton: { backgroundColor: '#ef4444' },
  destructiveText: { color: '#fff' },
});

AlertDialog.displayName = 'AlertDialog';
export default AlertDialog;
