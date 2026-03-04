import React, { useState, useEffect, useCallback, type ReactNode } from 'react';
import { Animated, StyleSheet, type ViewStyle } from 'react-native';

// Props from presence.widget spec
export interface PresenceProps {
  present?: boolean;
  animateOnMount?: boolean;
  forceMount?: boolean;
  children?: ReactNode;
  style?: ViewStyle;
}

export const Presence: React.FC<PresenceProps> = ({
  present = false,
  animateOnMount = false,
  forceMount = false,
  children,
  style,
}) => {
  const [mounted, setMounted] = useState(present || forceMount);
  const opacity = React.useRef(new Animated.Value(present ? 1 : 0)).current;

  useEffect(() => {
    if (present) {
      setMounted(true);
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else if (!forceMount) {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [present, forceMount, opacity]);

  if (!mounted && !forceMount) return null;

  return (
    <Animated.View style={[styles.root, { opacity }, style]}>
      {children}
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: {},
});

Presence.displayName = 'Presence';
export default Presence;
