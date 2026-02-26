// ============================================================
// SurfaceRoot — Root mounting component that manages the Clef Surface
// surface lifecycle: create, attach, resize, destroy.
//
// Wraps children in a container element that is the mount point
// for the Clef Surface rendering surface.  Observes resize events via
// ResizeObserver and reports them to the Clef Surface viewport system.
// ============================================================

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
  type CSSProperties,
} from 'react';

import type {
  SurfaceKind,
  WritableSignal,
  ViewportState,
} from '../../shared/types.js';
import {
  createSignal,
  createViewportSignal,
  getBreakpoint,
  getOrientation,
} from '../../shared/surface-bridge.js';

// --------------- Types ---------------

export type SurfaceStatus = 'idle' | 'created' | 'attached' | 'destroyed';

export interface SurfaceState {
  kind: SurfaceKind;
  status: SurfaceStatus;
  capabilities: Set<string>;
  mountPoint: string | null;
  width: number;
  height: number;
}

// --------------- Props ---------------

export interface SurfaceRootProps {
  /**
   * The surface kind.
   * @default "browser-dom"
   */
  kind?: SurfaceKind;
  /**
   * Optional mount point selector or ID.  When omitted, the
   * component generates a unique ID for the wrapper div.
   */
  mountPoint?: string;
  /**
   * Callback fired when the surface is created (on mount).
   */
  onCreated?: (state: SurfaceState) => void;
  /**
   * Callback fired when the surface is attached (rendered).
   */
  onAttached?: (state: SurfaceState) => void;
  /**
   * Callback fired when the surface is resized.
   */
  onResize?: (width: number, height: number) => void;
  /**
   * Callback fired when the surface is destroyed (unmount).
   */
  onDestroyed?: () => void;
  /**
   * External viewport signal to push resize events into.
   * When provided, SurfaceRoot will update this signal on
   * every resize of its container.
   */
  viewportSignal?: WritableSignal<ViewportState>;
  /** Additional class name. */
  className?: string;
  /** Additional inline styles. */
  style?: CSSProperties;
  children?: ReactNode;
}

// --------------- Helpers ---------------

let surfaceIdCounter = 0;

function detectCapabilities(kind: SurfaceKind): Set<string> {
  const caps = new Set<string>();

  switch (kind) {
    case 'browser-dom':
      caps.add('dom');
      caps.add('css');
      caps.add('events');
      caps.add('resize-observer');
      caps.add('intersection-observer');
      caps.add('animation');
      if (typeof window !== 'undefined') {
        caps.add('javascript');
        if ('ontouchstart' in window) caps.add('touch');
        if (window.matchMedia?.('(pointer: fine)').matches) caps.add('pointer-fine');
      }
      break;
    case 'ssr':
      caps.add('dom');
      caps.add('css');
      break;
    case 'static-html':
      caps.add('dom');
      caps.add('css');
      break;
    case 'terminal':
      caps.add('text');
      caps.add('ansi-color');
      break;
    case 'react-native':
      caps.add('native-views');
      caps.add('events');
      caps.add('animation');
      caps.add('touch');
      break;
    case 'webview':
      caps.add('dom');
      caps.add('css');
      caps.add('events');
      caps.add('javascript');
      break;
  }

  return caps;
}

// --------------- Component ---------------

export const SurfaceRoot: React.FC<SurfaceRootProps> = ({
  kind = 'browser-dom',
  mountPoint,
  onCreated,
  onAttached,
  onResize,
  onDestroyed,
  viewportSignal,
  className,
  style,
  children,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<SurfaceStatus>('idle');
  const surfaceIdRef = useRef<string>(
    mountPoint ?? `surface-surface-${++surfaceIdCounter}`
  );

  const [surfaceState, setSurfaceState] = useState<SurfaceState>(() => ({
    kind,
    status: 'idle',
    capabilities: detectCapabilities(kind),
    mountPoint: surfaceIdRef.current,
    width: 0,
    height: 0,
  }));

  // --- Create phase (on mount) ---
  useEffect(() => {
    const capabilities = detectCapabilities(kind);
    const state: SurfaceState = {
      kind,
      status: 'created',
      capabilities,
      mountPoint: surfaceIdRef.current,
      width: containerRef.current?.offsetWidth ?? 0,
      height: containerRef.current?.offsetHeight ?? 0,
    };

    statusRef.current = 'created';
    setSurfaceState(state);
    onCreated?.(state);

    // --- Attach phase (first render is committed) ---
    // Use a microtask so that the DOM is painted.
    const raf = requestAnimationFrame(() => {
      if (statusRef.current === 'created') {
        const attachedState: SurfaceState = {
          ...state,
          status: 'attached',
          width: containerRef.current?.offsetWidth ?? 0,
          height: containerRef.current?.offsetHeight ?? 0,
        };
        statusRef.current = 'attached';
        setSurfaceState(attachedState);
        onAttached?.(attachedState);
      }
    });

    return () => {
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  // --- Resize observation ---
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const w = Math.round(width);
        const h = Math.round(height);

        setSurfaceState((prev) => ({
          ...prev,
          width: w,
          height: h,
        }));

        onResize?.(w, h);

        // Push to viewport signal if provided
        if (viewportSignal) {
          viewportSignal.set({
            width: w,
            height: h,
            breakpoint: getBreakpoint(w),
            orientation: getOrientation(w, h),
          });
        }
      }
    });

    observer.observe(el);
    return () => observer.disconnect();
  }, [onResize, viewportSignal]);

  // --- Destroy phase (unmount) ---
  useEffect(() => {
    return () => {
      statusRef.current = 'destroyed';
      onDestroyed?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mergedStyle = useMemo<CSSProperties>(
    () => ({
      // Default to filling the parent so resize observation
      // captures meaningful dimensions.
      position: 'relative' as const,
      width: '100%',
      height: '100%',
      ...style,
    }),
    [style]
  );

  return (
    <div
      ref={containerRef}
      id={surfaceIdRef.current}
      className={className}
      style={mergedStyle}
      data-surface-surface=""
      data-surface-kind={kind}
      data-surface-status={surfaceState.status}
    >
      {children}
    </div>
  );
};

SurfaceRoot.displayName = 'SurfaceRoot';
export default SurfaceRoot;
