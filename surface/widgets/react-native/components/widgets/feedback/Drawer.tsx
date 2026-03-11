import React, { useCallback, type ReactNode } from 'react';
import { View, Text, Pressable, Modal, StyleSheet, type ViewStyle, Dimensions } from 'react-native';

export interface DrawerProps {
  open?: boolean;
  placement?: 'left' | 'right' | 'top' | 'bottom';
  title?: string;
  onClose?: () => void;
  children?: ReactNode;
  style?: ViewStyle;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export const Drawer: React.FC<DrawerProps> = ({
  open = false,
  placement = 'right',
  title,
  onClose,
  children,
  style,
}) => {
  const handleClose = useCallback(() => { onClose?.(); }, [onClose]);

  const isHorizontal = placement === 'left' || placement === 'right';
  const drawerStyle: ViewStyle = isHorizontal
    ? { width: SCREEN_WIDTH * 0.8, maxWidth: 360, height: '100%', [placement]: 0, top: 0, position: 'absolute' }
    : { height: SCREEN_HEIGHT * 0.5, width: '100%', [placement]: 0, left: 0, position: 'absolute' };

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.overlay} onPress={handleClose}>
        <Pressable style={[styles.drawer, drawerStyle, style]} onPress={() => {}}>
          <View style={styles.header}>
            {title && <Text style={styles.title}>{title}</Text>}
            <Pressable onPress={handleClose} accessibilityLabel="Close drawer" hitSlop={8}>
              <Text style={styles.closeButton}>\u00D7</Text>
            </Pressable>
          </View>
          <View style={styles.body}>{children}</View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  drawer: { backgroundColor: '#fff', shadowColor: '#000', shadowOffset: { width: -2, height: 0 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 10 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  title: { fontSize: 16, fontWeight: '600', color: '#1e293b' },
  closeButton: { fontSize: 24, color: '#94a3b8' },
  body: { flex: 1, padding: 16 },
});

Drawer.displayName = 'Drawer';
export default Drawer;
