// ============================================================
// Clef Surface NativeScript Widget — MotionBox
//
// NativeScript container that applies Clef Surface motion
// tokens as native animations. Maps motion presets (fade,
// slide, scale, expand) to NativeScript animation APIs.
// ============================================================

import { StackLayout, Animation, AnimationDefinition } from '@nativescript/core';

// --------------- Motion Presets ---------------

export type MotionPreset =
  | 'fade' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right'
  | 'scale' | 'expand' | 'none';

export type MotionDuration = 'instant' | 'fast' | 'normal' | 'slow' | 'very-slow';

const DURATION_MS: Record<MotionDuration, number> = {
  instant: 0,
  fast: 150,
  normal: 300,
  slow: 500,
  'very-slow': 1000,
};

// --------------- Props ---------------

export interface MotionBoxProps {
  visible?: boolean;
  preset?: MotionPreset;
  duration?: MotionDuration;
}

// --------------- Component ---------------

export function createMotionBox(props: MotionBoxProps = {}): StackLayout {
  const {
    visible = true,
    preset = 'fade',
    duration = 'normal',
  } = props;

  const container = new StackLayout();
  container.className = `clef-motion clef-motion-${preset}`;

  if (!visible) {
    container.opacity = 0;
    container.visibility = 'collapse';
  }

  const durationMs = DURATION_MS[duration];

  const show = () => {
    container.visibility = 'visible';
    const animDef: AnimationDefinition = { target: container, duration: durationMs };

    switch (preset) {
      case 'fade':
        container.opacity = 0;
        animDef.opacity = 1;
        break;
      case 'scale':
        container.scaleX = 0;
        container.scaleY = 0;
        animDef.scale = { x: 1, y: 1 };
        animDef.opacity = 1;
        break;
      case 'slide-up':
        container.translateY = 100;
        container.opacity = 0;
        animDef.translate = { x: 0, y: 0 };
        animDef.opacity = 1;
        break;
      case 'slide-down':
        container.translateY = -100;
        container.opacity = 0;
        animDef.translate = { x: 0, y: 0 };
        animDef.opacity = 1;
        break;
      case 'slide-left':
        container.translateX = 100;
        container.opacity = 0;
        animDef.translate = { x: 0, y: 0 };
        animDef.opacity = 1;
        break;
      case 'slide-right':
        container.translateX = -100;
        container.opacity = 0;
        animDef.translate = { x: 0, y: 0 };
        animDef.opacity = 1;
        break;
      case 'none':
        container.opacity = 1;
        return;
    }

    const animation = new Animation([animDef]);
    animation.play();
  };

  const hide = () => {
    const animDef: AnimationDefinition = { target: container, duration: durationMs, opacity: 0 };
    const animation = new Animation([animDef]);
    animation.play().then(() => {
      container.visibility = 'collapse';
    });
  };

  (container as any).__clefMotion = { show, hide };
  return container;
}

createMotionBox.displayName = 'MotionBox';
export default createMotionBox;
