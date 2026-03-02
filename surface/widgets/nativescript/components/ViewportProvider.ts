// ============================================================
// Clef Surface NativeScript Widget — ViewportProvider
//
// Reads device screen dimensions and provides Clef Surface
// Breakpoint values via a global context. Observes orientation
// changes to keep viewport state current.
// ============================================================

import { Screen, Application, StackLayout, Label } from '@nativescript/core';

import type { Breakpoint, Orientation, ViewportState } from '../../shared/types.js';

// --------------- Breakpoints ---------------

const BREAKPOINT_THRESHOLDS: Record<Breakpoint, number> = {
  xs: 0,
  sm: 360,
  md: 600,
  lg: 840,
  xl: 1200,
};

const BP_ORDER: Breakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl'];

function getBreakpointForWidth(widthDip: number): Breakpoint {
  if (widthDip >= BREAKPOINT_THRESHOLDS.xl) return 'xl';
  if (widthDip >= BREAKPOINT_THRESHOLDS.lg) return 'lg';
  if (widthDip >= BREAKPOINT_THRESHOLDS.md) return 'md';
  if (widthDip >= BREAKPOINT_THRESHOLDS.sm) return 'sm';
  return 'xs';
}

function getOrientation(width: number, height: number): Orientation {
  return width >= height ? 'landscape' : 'portrait';
}

// --------------- Context ---------------

export interface ViewportContextValue {
  viewport: ViewportState;
  breakpoint: Breakpoint;
  orientation: Orientation;
  width: number;
  height: number;
  isAtLeast(bp: Breakpoint): boolean;
  isAtMost(bp: Breakpoint): boolean;
}

let _viewportContext: ViewportContextValue | null = null;

export function getViewport(): ViewportContextValue {
  if (!_viewportContext) {
    throw new Error('getViewport must be called within a ViewportProvider scope.');
  }
  return _viewportContext;
}

export function getBreakpoint(): Breakpoint {
  return getViewport().breakpoint;
}

// --------------- Props ---------------

export interface ViewportProviderProps {
  showInfo?: boolean;
  infoPosition?: 'top' | 'bottom';
}

// --------------- Component ---------------

export function createViewportProvider(props: ViewportProviderProps = {}): StackLayout {
  const { showInfo = false, infoPosition = 'bottom' } = props;

  const container = new StackLayout();
  container.className = 'clef-viewport-provider';

  const widthDip = Screen.mainScreen.widthDIPs;
  const heightDip = Screen.mainScreen.heightDIPs;
  const breakpoint = getBreakpointForWidth(widthDip);
  const orientation = getOrientation(widthDip, heightDip);

  _viewportContext = {
    viewport: { width: widthDip, height: heightDip, breakpoint, orientation },
    breakpoint,
    orientation,
    width: widthDip,
    height: heightDip,
    isAtLeast: (bp) => BP_ORDER.indexOf(breakpoint) >= BP_ORDER.indexOf(bp),
    isAtMost: (bp) => BP_ORDER.indexOf(breakpoint) <= BP_ORDER.indexOf(bp),
  };

  if (showInfo) {
    const infoLabel = new Label();
    infoLabel.text = `[viewport: ${widthDip}x${heightDip} bp:${breakpoint} ${orientation}]`;
    infoLabel.opacity = 0.6;
    infoLabel.fontSize = 11;

    if (infoPosition === 'top') {
      container.insertChild(infoLabel, 0);
    } else {
      container.addChild(infoLabel);
    }
  }

  return container;
}

createViewportProvider.displayName = 'ViewportProvider';
export default createViewportProvider;
