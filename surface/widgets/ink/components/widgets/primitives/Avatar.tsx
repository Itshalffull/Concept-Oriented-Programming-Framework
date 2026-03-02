// ============================================================
// Clef Surface Ink Widget — Avatar
//
// Displays a user or entity identity in the terminal as initials
// inside a bordered box. When no name is provided, falls back to
// a placeholder glyph. Size affects the box width and padding.
//
// Adapts the avatar.widget spec: anatomy (root, image, fallback),
// states (loading, loaded, error), and connect attributes
// (data-part, data-size, data-state) to terminal rendering.
// ============================================================

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

// --------------- Props ---------------

export interface AvatarProps {
  /** Display name used to derive initials for the fallback. */
  name?: string;
  /** Image source — used only to trigger loaded/error states (not rendered in terminal). */
  src?: string;
  /** Size of the avatar box. */
  size?: 'sm' | 'md' | 'lg';
  /** Custom fallback text when no name is available. */
  fallback?: string;
  /** Force the fallback to display regardless of src. */
  showFallback?: boolean;
  /** data-part attribute on the root element. */
  dataPart?: string;
  /** data-state attribute override. */
  dataState?: string;
  /** data-variant attribute. */
  dataVariant?: string;
}

// --------------- Helpers ---------------

const SIZE_CONFIG: Record<string, { width: number; paddingX: number }> = {
  sm: { width: 5, paddingX: 0 },
  md: { width: 7, paddingX: 1 },
  lg: { width: 11, paddingX: 2 },
};

function getInitials(name: string): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// --------------- Component ---------------

export const Avatar: React.FC<AvatarProps> = ({
  name = '',
  src,
  size = 'md',
  fallback,
  showFallback = false,
  dataPart,
  dataState,
  dataVariant,
}) => {
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>(
    src && !showFallback ? 'loading' : 'error',
  );

  useEffect(() => {
    if (!src || showFallback) {
      setState('error');
      return;
    }
    // In a terminal environment images cannot load, so we transition
    // directly to the fallback (error) state after a brief tick to
    // mirror the spec's loading -> error path.
    setState('loading');
    const timer = setTimeout(() => setState('error'), 0);
    return () => clearTimeout(timer);
  }, [src, showFallback]);

  const config = SIZE_CONFIG[size] ?? SIZE_CONFIG.md;
  const displayText = fallback ?? getInitials(name);
  const showImage = state === 'loaded';

  const resolvedState = dataState ?? state;

  return (
    <Box
      borderStyle="round"
      width={config.width}
      paddingX={config.paddingX}
      justifyContent="center"
      alignItems="center"
    >
      {showImage ? (
        <Text>{name ? name[0].toUpperCase() : '?'}</Text>
      ) : (
        <Text bold>{displayText}</Text>
      )}
    </Box>
  );
};

Avatar.displayName = 'Avatar';
export default Avatar;
