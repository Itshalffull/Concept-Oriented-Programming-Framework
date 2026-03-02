// ============================================================
// Clef Surface NativeScript Widget — ElevationBox
//
// NativeScript container that applies Clef Surface elevation
// tokens as native shadow effects. Maps elevation levels
// (0-5) to platform shadow properties.
// ============================================================

import { StackLayout } from '@nativescript/core';

// --------------- Elevation Scale ---------------

const ELEVATION_SCALE: Record<number, { shadowRadius: number; shadowOpacity: number }> = {
  0: { shadowRadius: 0, shadowOpacity: 0 },
  1: { shadowRadius: 2, shadowOpacity: 0.1 },
  2: { shadowRadius: 4, shadowOpacity: 0.15 },
  3: { shadowRadius: 8, shadowOpacity: 0.2 },
  4: { shadowRadius: 12, shadowOpacity: 0.25 },
  5: { shadowRadius: 16, shadowOpacity: 0.3 },
};

// --------------- Props ---------------

export interface ElevationBoxProps {
  level?: number;
  borderRadius?: number;
  backgroundColor?: string;
  padding?: number;
}

// --------------- Component ---------------

export function createElevationBox(props: ElevationBoxProps = {}): StackLayout {
  const {
    level = 1,
    borderRadius = 8,
    backgroundColor = '#FFFFFF',
    padding = 0,
  } = props;

  const container = new StackLayout();
  container.className = `clef-elevation clef-elevation-${level}`;
  container.borderRadius = borderRadius;
  container.backgroundColor = backgroundColor as any;
  container.padding = padding;

  const clampedLevel = Math.max(0, Math.min(5, level));
  const shadow = ELEVATION_SCALE[clampedLevel];

  // NativeScript iOS shadow properties
  container.iosOverflowSafeArea = false;
  if (shadow.shadowRadius > 0) {
    container.setShadow({
      offset: { width: 0, height: shadow.shadowRadius / 2 },
      radius: shadow.shadowRadius,
      opacity: shadow.shadowOpacity,
      color: '#000000' as any,
    } as any);
  }

  // NativeScript Android elevation
  container.androidElevation = clampedLevel * 2;

  return container;
}

createElevationBox.displayName = 'ElevationBox';
export default createElevationBox;
