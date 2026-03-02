// ============================================================
// Clef Surface NativeScript Widget — ScrollLock
//
// NativeScript scroll lock container that can enable or
// disable scrolling of its content. Useful for preventing
// background scroll when modals or overlays are open.
// ============================================================

import { ScrollView, StackLayout } from '@nativescript/core';

// --------------- Props ---------------

export interface ScrollLockProps {
  locked?: boolean;
  orientation?: 'vertical' | 'horizontal';
  padding?: number;
}

// --------------- Component ---------------

export function createScrollLock(props: ScrollLockProps = {}): ScrollView {
  const {
    locked = false,
    orientation = 'vertical',
    padding = 0,
  } = props;

  const scrollView = new ScrollView();
  scrollView.className = 'clef-scroll-lock';
  scrollView.orientation = orientation;
  scrollView.isScrollEnabled = !locked;

  const content = new StackLayout();
  content.className = 'clef-scroll-lock__content';
  content.padding = padding;

  if (orientation === 'horizontal') {
    content.orientation = 'horizontal';
  }

  scrollView.content = content;

  // Expose lock/unlock helpers
  const lock = () => {
    scrollView.isScrollEnabled = false;
    scrollView.className = 'clef-scroll-lock clef-scroll-lock--locked';
  };

  const unlock = () => {
    scrollView.isScrollEnabled = true;
    scrollView.className = 'clef-scroll-lock';
  };

  const toggle = () => {
    if (scrollView.isScrollEnabled) lock();
    else unlock();
  };

  (scrollView as any).__clefScrollLock = { lock, unlock, toggle, content };

  return scrollView;
}

createScrollLock.displayName = 'ScrollLock';
export default createScrollLock;
