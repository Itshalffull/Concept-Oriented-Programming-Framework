import React, { useState, useCallback, type ReactNode } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, type ViewStyle } from 'react-native';

export interface PopoverProps {
  open?: boolean;
  closeOnOutsideClick?: boolean;
  onOpenChange?: (open: boolean) => void;
  trigger?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  style?: ViewStyle;
}

export const Popover: React.FC<PopoverProps> = ({
  open: controlledOpen,
  closeOnOutsideClick = true,
  onOpenChange,
  trigger,
  title,
  description,
  children,
  style,
}) => {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = controlledOpen ?? internalOpen;

  const handleToggle = useCallback(() => {
    const next = !isOpen;
    setInternalOpen(next);
    onOpenChange?.(next);
  }, [isOpen, onOpenChange]);

  const handleClose = useCallback(() => {
    setInternalOpen(false);
    onOpenChange?.(false);
  }, [onOpenChange]);

  return (
    <View style={style}>
      <Pressable onPress={handleToggle} accessibilityRole="button">
        {trigger}
      </Pressable>
      <Modal visible={isOpen} transparent animationType="fade" onRequestClose={handleClose}>
        <Pressable
          style={styles.overlay}
          onPress={closeOnOutsideClick ? handleClose : undefined}
        >
          <Pressable style={styles.content} onPress={() => {}}>
            {title && <View style={styles.titleRow}>
              {typeof title === 'string' ? <Text style={styles.title}>{title}</Text> : title}
            </View>}
            {description && <View style={styles.descriptionRow}>
              {typeof description === 'string' ? <Text style={styles.description}>{description}</Text> : description}
            </View>}
            {children}
            <Pressable onPress={handleClose} style={styles.closeButton} accessibilityLabel="Close popover">
              <Text style={styles.closeText}>\u2715</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'center', alignItems: 'center' },
  content: { backgroundColor: '#fff', borderRadius: 8, padding: 16, width: '80%', maxWidth: 360, elevation: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12 },
  titleRow: { marginBottom: 4 },
  title: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  descriptionRow: { marginBottom: 12 },
  description: { fontSize: 13, color: '#475569' },
  closeButton: { position: 'absolute', top: 8, right: 8 },
  closeText: { fontSize: 16, color: '#94a3b8' },
});

Popover.displayName = 'Popover';
export default Popover;
