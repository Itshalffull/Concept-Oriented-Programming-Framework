// ============================================================
// Clef Surface NativeScript Widget — Portal
//
// NativeScript portal rendering container. Allows children to
// be logically parented in one location but rendered in another
// (e.g., at the application root for modals and overlays).
// ============================================================

import { StackLayout, View, Frame } from '@nativescript/core';

// --------------- Portal Registry ---------------

const portalTargets = new Map<string, StackLayout>();

export function registerPortalTarget(name: string, target: StackLayout): void {
  portalTargets.set(name, target);
}

export function unregisterPortalTarget(name: string): void {
  portalTargets.delete(name);
}

// --------------- Props ---------------

export interface PortalProps {
  /** Named target to render into. Falls back to app root if not found. */
  target?: string;
  padding?: number;
}

// --------------- Component ---------------

export function createPortal(props: PortalProps = {}): StackLayout {
  const {
    target = 'default',
    padding = 0,
  } = props;

  const container = new StackLayout();
  container.className = 'clef-portal';
  container.padding = padding;

  const teleport = (child: View) => {
    const targetContainer = portalTargets.get(target);
    if (targetContainer) {
      targetContainer.addChild(child);
    } else {
      // Fallback: attempt to add to the current page root
      const page = Frame.topmost()?.currentPage;
      if (page && (page as any).content) {
        const root = (page as any).content as StackLayout;
        if (typeof root.addChild === 'function') {
          root.addChild(child);
        }
      }
    }
  };

  const remove = (child: View) => {
    const parent = child.parent;
    if (parent && typeof (parent as any).removeChild === 'function') {
      (parent as any).removeChild(child);
    }
  };

  (container as any).__clefPortal = { teleport, remove };

  return container;
}

// --------------- Portal Target ---------------

export function createPortalTarget(name: string = 'default'): StackLayout {
  const target = new StackLayout();
  target.className = `clef-portal-target clef-portal-target--${name}`;

  target.on('loaded', () => registerPortalTarget(name, target));
  target.on('unloaded', () => unregisterPortalTarget(name));

  return target;
}

createPortal.displayName = 'Portal';
export default createPortal;
