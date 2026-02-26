'use client';

// ============================================================
// SurfaceRoot — Next.js App Router root mounting component.
//
// Manages the Clef Surface lifecycle: create, attach, resize,
// destroy. Functional component only — no classes. Uses
// ResizeObserver for viewport tracking. SSR-safe with typeof
// window checks. Integrates with Next.js streaming and Suspense.
// ============================================================

import {
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

export type SurfaceStatus = 'idle' | 'created' | 'attached' | 'destroyed';

export interface SurfaceState {
  readonly kind: SurfaceKind;
  readonly status: SurfaceStatus;
  readonly capabilities: ReadonlySet<string>;
  readonly mountPoint: string | null;
  readonly width: number;
  readonly height: number;
}

export interface SurfaceRootProps {
  readonly kind?: SurfaceKind;
  readonly mountPoint?: string;
  readonly onCreated?: (state: SurfaceState) => void;
  readonly onAttached?: (state: SurfaceState) => void;
  readonly onResize?: (width: number, height: number) => void;
  readonly onDestroyed?: () => void;
  readonly viewportSignal?: WritableSignal<ViewportState>;
  readonly className?: string;
  readonly style?: CSSProperties;
  readonly children?: ReactNode;
}

let surfaceIdCounter = 0;

const detectCapabilities = (kind: SurfaceKind): ReadonlySet<string> => {
  const caps = new Set<string>();

  switch (kind) {
    case 'browser-dom':
      caps.add('dom');
      caps.add('css');
      caps.add('events');
      caps.add('resize-observer');
      caps.add('intersection-observer');
      caps.add('animation');
      caps.add('nextjs-app-router');
      caps.add('server-components');
      caps.add('server-actions');
      if (typeof window !== 'undefined') {
        caps.add('javascript');
        if ('ontouchstart' in window) caps.add('touch');
        if (window.matchMedia?.('(pointer: fine)').matches) caps.add('pointer-fine');
      }
      break;
    case 'ssr':
      caps.add('dom');
      caps.add('css');
      caps.add('nextjs-app-router');
      caps.add('server-components');
      break;
    case 'static-html':
      caps.add('dom');
      caps.add('css');
      break;
  }

  return caps;
};

export const SurfaceRoot = ({
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
}: SurfaceRootProps): ReactNode => {
  const containerRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<SurfaceStatus>('idle');
  const surfaceIdRef = useRef<string>(
    mountPoint ?? `surface-nextjs-${++surfaceIdCounter}`
  );

  const [surfaceState, setSurfaceState] = useState<SurfaceState>(() => ({
    kind,
    status: 'idle',
    capabilities: detectCapabilities(kind),
    mountPoint: surfaceIdRef.current,
    width: 0,
    height: 0,
  }));

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
  }, [kind, onCreated, onAttached]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        const w = Math.round(width);
        const h = Math.round(height);

        setSurfaceState((prev) => ({ ...prev, width: w, height: h }));
        onResize?.(w, h);

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

  useEffect(() => {
    return () => {
      statusRef.current = 'destroyed';
      onDestroyed?.();
    };
  }, [onDestroyed]);

  const mergedStyle = useMemo<CSSProperties>(
    () => ({
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
      data-surface-adapter="nextjs"
    >
      {children}
    </div>
  );
};

SurfaceRoot.displayName = 'SurfaceRoot';
export default SurfaceRoot;
