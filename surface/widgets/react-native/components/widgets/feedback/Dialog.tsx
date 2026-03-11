import React, { useCallback, type ReactNode } from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet, type ViewStyle } from 'react-native';

export interface DialogProps {
  open?: boolean;
  title?: string;
  description?: string;
  closeOnOutsideClick?: boolean;
  onClose?: () => void;
  children?: ReactNode;
  footer?: ReactNode;
  style?: ViewStyle;
}

export const Dialog: React.FC<DialogProps> = ({
  open = false,
  title,
  description,
  closeOnOutsideClick = true,
  onClose,
  children,
  footer,
  style,
}) => {
  const handleClose = useCallback(() => { onClose?.(); }, [onClose]);

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable
        style={styles.overlay}
        onPress={closeOnOutsideClick ? handleClose : undefined}
      >
        <Pressable style={[styles.content, style]} onPress={() => {}}>
          <View style={styles.header} accessibilityRole="header">
            {title && <Text style={styles.title}>{title}</Text>}
            <Pressable onPress={handleClose} accessibilityLabel="Close dialog" hitSlop={8}>
              <Text style={styles.closeButton}>\u00D7</Text>
            </Pressable>
          </View>
          {description && <Text style={styles.description}>{description}</Text>}
          <ScrollView style={styles.body}>{children}</ScrollView>
          {footer && <View style={styles.footer}>{footer}</View>}
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  content: { backgroundColor: '#fff', borderRadius: 12, width: '90%', maxWidth: 480, maxHeight: '80%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  title: { fontSize: 18, fontWeight: '600', color: '#1e293b', flex: 1 },
  closeButton: { fontSize: 24, color: '#94a3b8' },
  description: { fontSize: 14, color: '#475569', paddingHorizontal: 16, paddingTop: 8 },
  body: { padding: 16 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: '#e2e8f0' },
});

Dialog.displayName = 'Dialog';
export default Dialog;
