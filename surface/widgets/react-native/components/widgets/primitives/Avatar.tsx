import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, Image, StyleSheet, type ViewStyle } from 'react-native';

// Props from avatar.widget spec
export interface AvatarProps {
  src?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  delayMs?: number;
  style?: ViewStyle;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const sizeMap = { xs: 24, sm: 32, md: 40, lg: 56 };
const fontSizeMap = { xs: 10, sm: 12, md: 16, lg: 22 };

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name = '',
  size = 'md',
  delayMs = 0,
  style,
}) => {
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const prevSrcRef = useRef(src);

  useEffect(() => {
    if (prevSrcRef.current !== src) {
      prevSrcRef.current = src;
      setState('loading');
    }
  }, [src]);

  const handleLoad = useCallback(() => {
    if (delayMs > 0) {
      setTimeout(() => setState('loaded'), delayMs);
    } else {
      setState('loaded');
    }
  }, [delayMs]);

  const handleError = useCallback(() => {
    setState('error');
  }, []);

  const dimension = sizeMap[size];
  const isLoaded = state === 'loaded';

  return (
    <View
      style={[styles.root, { width: dimension, height: dimension, borderRadius: dimension / 2 }, style]}
      accessibilityRole="image"
      accessibilityLabel={name}
    >
      {src && (
        <Image
          source={{ uri: src }}
          style={[
            styles.image,
            { width: dimension, height: dimension, borderRadius: dimension / 2 },
            !isLoaded && styles.hidden,
          ]}
          onLoad={handleLoad}
          onError={handleError}
          accessibilityElementsHidden
        />
      )}
      {!isLoaded && (
        <View style={[styles.fallback, { width: dimension, height: dimension, borderRadius: dimension / 2 }]}>
          <Text style={[styles.fallbackText, { fontSize: fontSizeMap[size] }]}>
            {getInitials(name)}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e2e8f0',
  },
  image: {
    position: 'absolute',
  },
  hidden: {
    opacity: 0,
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#cbd5e1',
  },
  fallbackText: {
    color: '#475569',
    fontWeight: '600',
  },
});

Avatar.displayName = 'Avatar';
export default Avatar;
