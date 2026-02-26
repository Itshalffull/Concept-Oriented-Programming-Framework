// ============================================================
// Tests for Clef Surface Framework Widgets — Shared Bridge Module
//
// Tests the framework-agnostic bridge that all framework
// widget adapters depend on: signals, machine runner, theme
// resolver, layout engine, viewport, elevation, typography,
// palette, motion, and element mapping.
// ============================================================

import { describe, it, expect, vi } from 'vitest';
import {
  createSignal,
  createComputed,
  createMachine,
  resolveTheme,
  themeToCssVariables,
  layoutToCSS,
  layoutToStyleString,
  getBreakpoint,
  getOrientation,
  createViewportSignal,
  elevationToCSS,
  shadowLayersToCSS,
  generateTypeScale,
  textStyleToCSS,
  generateColorScale,
  contrastRatio,
  motionToCSS,
  reducedMotionCSS,
  mapElementToHTML,
} from '../framework-widgets/shared/surface-bridge.js';

import type {
  DesignTokenValue,
  ThemeConfig,
  LayoutConfig,
  WidgetSpec,
  TextStyle,
  FontStack,
  MotionDuration,
  MotionEasing,
  MotionTransition,
  ShadowLayer,
} from '../framework-widgets/shared/types.js';

// ==============================
// Signal
// ==============================

describe('createSignal', () => {
  it('returns an object with get/set/subscribe/update', () => {
    const s = createSignal(42);
    expect(s.get()).toBe(42);
    expect(typeof s.set).toBe('function');
    expect(typeof s.subscribe).toBe('function');
    expect(typeof s.update).toBe('function');
    expect(typeof s.id).toBe('string');
  });

  it('updates value via set()', () => {
    const s = createSignal('hello');
    s.set('world');
    expect(s.get()).toBe('world');
  });

  it('updates value via update()', () => {
    const s = createSignal(10);
    s.update(prev => prev + 5);
    expect(s.get()).toBe(15);
  });

  it('notifies subscribers on set()', () => {
    const s = createSignal(0);
    const listener = vi.fn();
    s.subscribe(listener);
    s.set(1);
    expect(listener).toHaveBeenCalledWith(1);
    s.set(2);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener).toHaveBeenCalledWith(2);
  });

  it('unsubscribe stops notifications', () => {
    const s = createSignal(0);
    const listener = vi.fn();
    const unsub = s.subscribe(listener);
    s.set(1);
    expect(listener).toHaveBeenCalledTimes(1);
    unsub();
    s.set(2);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('multiple subscribers get independent notifications', () => {
    const s = createSignal(0);
    const a = vi.fn();
    const b = vi.fn();
    s.subscribe(a);
    const unsubB = s.subscribe(b);
    s.set(1);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    unsubB();
    s.set(2);
    expect(a).toHaveBeenCalledTimes(2);
    expect(b).toHaveBeenCalledTimes(1);
  });
});

describe('createComputed', () => {
  it('derives value from dependencies', () => {
    const a = createSignal(2);
    const b = createSignal(3);
    const sum = createComputed([a, b], () => a.get() + b.get());
    expect(sum.get()).toBe(5);
  });

  it('recomputes when dependencies change', () => {
    const a = createSignal(10);
    const doubled = createComputed([a], () => a.get() * 2);
    expect(doubled.get()).toBe(20);
    a.set(5);
    expect(doubled.get()).toBe(10);
  });

  it('notifies its own subscribers', () => {
    const a = createSignal(1);
    const computed = createComputed([a], () => a.get() + 100);
    const listener = vi.fn();
    computed.subscribe(listener);
    a.set(2);
    expect(listener).toHaveBeenCalledWith(102);
  });
});

// ==============================
// Machine Runner
// ==============================

describe('createMachine', () => {
  const dialogSpec: WidgetSpec = {
    name: 'dialog',
    anatomy: { parts: ['root', 'trigger', 'content', 'title'], slots: ['body'] },
    machineSpec: {
      initial: 'closed',
      states: {
        closed: { on: { OPEN: 'open' } },
        open: { on: { CLOSE: 'closed' } },
      },
    },
    a11ySpec: { role: 'dialog', 'aria-modal': 'true' },
  };

  it('creates a machine with initial state', () => {
    const m = createMachine(dialogSpec);
    expect(m.state.get().current).toBe('closed');
  });

  it('transitions on send()', () => {
    const m = createMachine(dialogSpec);
    m.send({ type: 'OPEN' });
    expect(m.state.get().current).toBe('open');
  });

  it('ignores invalid events', () => {
    const m = createMachine(dialogSpec);
    m.send({ type: 'NONSENSE' });
    expect(m.state.get().current).toBe('closed');
  });

  it('transitions back', () => {
    const m = createMachine(dialogSpec);
    m.send({ type: 'OPEN' });
    m.send({ type: 'CLOSE' });
    expect(m.state.get().current).toBe('closed');
  });

  it('connect() returns props for each anatomy part', () => {
    const m = createMachine(dialogSpec);
    const props = m.connect();
    expect(Object.keys(props)).toEqual(expect.arrayContaining(['root', 'trigger', 'content', 'title']));
  });

  it('connect() includes data-state attribute', () => {
    const m = createMachine(dialogSpec);
    const props = m.connect();
    expect(props['root']['data-state']).toBe('closed');
    m.send({ type: 'OPEN' });
    const props2 = m.connect();
    expect(props2['root']['data-state']).toBe('open');
  });

  it('connect() includes a11y attributes', () => {
    const m = createMachine(dialogSpec);
    const props = m.connect();
    expect(props['root']['role']).toBe('dialog');
  });

  it('merges initial context', () => {
    const m = createMachine(dialogSpec, { open: false });
    expect(m.state.get().context).toHaveProperty('open', false);
  });

  it('notifies subscribers on state change', () => {
    const m = createMachine(dialogSpec);
    const listener = vi.fn();
    m.state.subscribe(listener);
    m.send({ type: 'OPEN' });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ current: 'open' }));
  });

  it('destroy cleans up', () => {
    const m = createMachine(dialogSpec);
    m.destroy();
    // No error on calling send after destroy
    m.send({ type: 'OPEN' });
  });
});

// ==============================
// Theme Resolver
// ==============================

describe('resolveTheme', () => {
  const baseTokens: DesignTokenValue[] = [
    { name: 'color-bg', value: '#ffffff', type: 'color', tier: 'semantic' },
    { name: 'color-text', value: '#000000', type: 'color', tier: 'semantic' },
    { name: 'space-4', value: '16px', type: 'dimension', tier: 'primitive' },
  ];

  it('returns default theme when no themes are active', () => {
    const result = resolveTheme(baseTokens, []);
    expect(result.name).toBe('default');
    expect(result.tokens['color-bg']).toBe('#ffffff');
    expect(result.tokens['color-text']).toBe('#000000');
  });

  it('applies active theme overrides', () => {
    const themes: ThemeConfig[] = [
      { name: 'dark', overrides: { 'color-bg': '#1a1a1a', 'color-text': '#ffffff' }, active: true, priority: 1 },
    ];
    const result = resolveTheme(baseTokens, themes);
    expect(result.name).toBe('dark');
    expect(result.tokens['color-bg']).toBe('#1a1a1a');
    expect(result.tokens['color-text']).toBe('#ffffff');
    expect(result.tokens['space-4']).toBe('16px'); // unchanged
  });

  it('stacks multiple active themes by priority', () => {
    const themes: ThemeConfig[] = [
      { name: 'dark', overrides: { 'color-bg': '#1a1a1a' }, active: true, priority: 1 },
      { name: 'compact', overrides: { 'space-4': '8px' }, active: true, priority: 2 },
    ];
    const result = resolveTheme(baseTokens, themes);
    expect(result.name).toBe('dark+compact');
    expect(result.tokens['color-bg']).toBe('#1a1a1a');
    expect(result.tokens['space-4']).toBe('8px');
  });

  it('ignores inactive themes', () => {
    const themes: ThemeConfig[] = [
      { name: 'dark', overrides: { 'color-bg': '#1a1a1a' }, active: false, priority: 1 },
    ];
    const result = resolveTheme(baseTokens, themes);
    expect(result.tokens['color-bg']).toBe('#ffffff');
  });

  it('higher priority theme overrides lower', () => {
    const themes: ThemeConfig[] = [
      { name: 'a', overrides: { 'color-bg': 'red' }, active: true, priority: 1 },
      { name: 'b', overrides: { 'color-bg': 'blue' }, active: true, priority: 2 },
    ];
    const result = resolveTheme(baseTokens, themes);
    expect(result.tokens['color-bg']).toBe('blue');
  });
});

describe('themeToCssVariables', () => {
  it('generates CSS custom properties', () => {
    const css = themeToCssVariables({ name: 'test', tokens: { 'color-bg': '#fff', 'space-4': '16px' } });
    expect(css).toContain(':root {');
    expect(css).toContain('--color-bg: #fff;');
    expect(css).toContain('--space-4: 16px;');
    expect(css).toContain('}');
  });
});

// ==============================
// Layout Engine
// ==============================

describe('layoutToCSS', () => {
  it('generates stack layout', () => {
    const config: LayoutConfig = { name: 'main', kind: 'stack', gap: 'space-4' };
    const css = layoutToCSS(config);
    expect(css.display).toBe('flex');
    expect(css['flex-direction']).toBe('column');
    expect(css.gap).toBe('var(--space-4)');
  });

  it('generates grid layout', () => {
    const config: LayoutConfig = { name: 'grid', kind: 'grid', columns: '1fr 1fr 1fr', gap: 'space-2' };
    const css = layoutToCSS(config);
    expect(css.display).toBe('grid');
    expect(css['grid-template-columns']).toBe('1fr 1fr 1fr');
  });

  it('generates sidebar layout', () => {
    const config: LayoutConfig = { name: 'sidebar', kind: 'sidebar', direction: 'row' };
    const css = layoutToCSS(config);
    expect(css.display).toBe('grid');
    expect(css['grid-template-columns']).toBe('250px 1fr');
  });

  it('generates center layout', () => {
    const config: LayoutConfig = { name: 'center', kind: 'center' };
    const css = layoutToCSS(config);
    expect(css.display).toBe('flex');
    expect(css['justify-content']).toBe('center');
    expect(css['align-items']).toBe('center');
  });

  it('generates flow layout', () => {
    const config: LayoutConfig = { name: 'flow', kind: 'flow' };
    const css = layoutToCSS(config);
    expect(css.display).toBe('flex');
    expect(css['flex-wrap']).toBe('wrap');
  });

  it('generates overlay layout', () => {
    const config: LayoutConfig = { name: 'overlay', kind: 'overlay' };
    const css = layoutToCSS(config);
    expect(css.position).toBe('relative');
  });

  it('generates split layout', () => {
    const config: LayoutConfig = { name: 'split', kind: 'split' };
    const css = layoutToCSS(config);
    expect(css.display).toBe('grid');
    expect(css['grid-template-columns']).toBe('1fr 1fr');
  });
});

describe('layoutToStyleString', () => {
  it('generates style string', () => {
    const config: LayoutConfig = { name: 'main', kind: 'center' };
    const style = layoutToStyleString(config);
    expect(style).toContain('display: flex');
    expect(style).toContain('justify-content: center');
  });
});

// ==============================
// Viewport
// ==============================

describe('getBreakpoint', () => {
  it('returns xs for small widths', () => {
    expect(getBreakpoint(300)).toBe('xs');
  });

  it('returns sm for 480-767', () => {
    expect(getBreakpoint(500)).toBe('sm');
  });

  it('returns md for 768-1023', () => {
    expect(getBreakpoint(800)).toBe('md');
  });

  it('returns lg for 1024-1279', () => {
    expect(getBreakpoint(1024)).toBe('lg');
  });

  it('returns xl for 1280+', () => {
    expect(getBreakpoint(1400)).toBe('xl');
  });

  it('handles custom breakpoints', () => {
    const custom = { mobile: 0, tablet: 600, desktop: 1200 };
    expect(getBreakpoint(400, custom)).toBe('mobile');
    expect(getBreakpoint(800, custom)).toBe('tablet');
    expect(getBreakpoint(1300, custom)).toBe('desktop');
  });
});

describe('getOrientation', () => {
  it('returns landscape for wide viewports', () => {
    expect(getOrientation(1024, 768)).toBe('landscape');
  });

  it('returns portrait for tall viewports', () => {
    expect(getOrientation(768, 1024)).toBe('portrait');
  });

  it('returns landscape for square viewports', () => {
    expect(getOrientation(500, 500)).toBe('landscape');
  });
});

describe('createViewportSignal', () => {
  it('creates signal with default dimensions', () => {
    const s = createViewportSignal();
    expect(s.get().width).toBe(1024);
    expect(s.get().height).toBe(768);
    expect(s.get().breakpoint).toBe('lg');
    expect(s.get().orientation).toBe('landscape');
  });

  it('accepts custom initial dimensions', () => {
    const s = createViewportSignal(375, 812);
    expect(s.get().width).toBe(375);
    expect(s.get().breakpoint).toBe('xs');
    expect(s.get().orientation).toBe('portrait');
  });
});

// ==============================
// Elevation
// ==============================

describe('elevationToCSS', () => {
  it('returns none for level 0', () => {
    expect(elevationToCSS(0)).toBe('none');
  });

  it('returns shadow string for levels 1-5', () => {
    for (let i = 1; i <= 5; i++) {
      const result = elevationToCSS(i as any);
      expect(result).toBeTruthy();
      expect(result).not.toBe('none');
      expect(result).toContain('rgba');
    }
  });

  it('increases shadow intensity with level', () => {
    const l1 = elevationToCSS(1);
    const l5 = elevationToCSS(5);
    // Level 5 has larger offset values
    expect(l5.length).toBeGreaterThan(l1.length);
  });
});

describe('shadowLayersToCSS', () => {
  it('converts a single layer', () => {
    const layers: ShadowLayer[] = [
      { y: 4, blur: 8, color: 'rgba(0,0,0,0.12)' },
    ];
    const result = shadowLayersToCSS(layers);
    expect(result).toBe('0px 4px 8px 0px rgba(0,0,0,0.12)');
  });

  it('converts multiple layers', () => {
    const layers: ShadowLayer[] = [
      { y: 2, blur: 4, color: 'rgba(0,0,0,0.1)' },
      { x: 1, y: 3, blur: 6, spread: 2, color: 'rgba(0,0,0,0.2)' },
    ];
    const result = shadowLayersToCSS(layers);
    expect(result).toContain(',');
    expect(result).toContain('1px 3px 6px 2px rgba(0,0,0,0.2)');
  });
});

// ==============================
// Typography
// ==============================

describe('generateTypeScale', () => {
  it('generates a scale with base size', () => {
    const scale = generateTypeScale(16, 1.25, 6);
    expect(scale.base).toBe(16);
  });

  it('sm is smaller than base', () => {
    const scale = generateTypeScale(16, 1.25, 6);
    expect(scale.sm).toBeLessThan(scale.base);
  });

  it('lg is larger than base', () => {
    const scale = generateTypeScale(16, 1.25, 6);
    expect(scale.lg).toBeGreaterThan(scale.base);
  });

  it('respects the ratio', () => {
    const scale = generateTypeScale(16, 1.25, 6);
    const ratio = (scale as any)['md'] / scale.base;
    expect(ratio).toBeCloseTo(1.25, 1);
  });
});

describe('textStyleToCSS', () => {
  it('generates CSS properties', () => {
    const scale = generateTypeScale(16, 1.25, 6);
    const stacks: FontStack[] = [
      { name: 'heading', fonts: ['Inter', 'sans-serif'], category: 'sans-serif' },
    ];
    const style: TextStyle = {
      name: 'heading-1',
      scale: 'xl',
      fontStack: 'heading',
      weight: 700,
      lineHeight: 1.2,
      letterSpacing: '-0.02em',
    };
    const css = textStyleToCSS(style, scale, stacks);
    expect(css['font-weight']).toBe('700');
    expect(css['line-height']).toBe('1.2');
    expect(css['letter-spacing']).toBe('-0.02em');
    expect(css['font-family']).toBe('Inter, sans-serif');
    expect(css['font-size']).toBeTruthy();
  });
});

// ==============================
// Palette
// ==============================

describe('generateColorScale', () => {
  it('generates all scale stops', () => {
    const scale = generateColorScale('#3b82f6');
    expect(scale[50]).toBeTruthy();
    expect(scale[100]).toBeTruthy();
    expect(scale[500]).toBe('#3b82f6');
    expect(scale[900]).toBeTruthy();
    expect(scale[950]).toBeTruthy();
  });

  it('all values are hex strings', () => {
    const scale = generateColorScale('#3b82f6');
    for (const value of Object.values(scale)) {
      expect(value).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe('contrastRatio', () => {
  it('returns 21:1 for black on white', () => {
    const ratio = contrastRatio('#000000', '#ffffff');
    expect(ratio).toBeCloseTo(21, 0);
  });

  it('returns 1:1 for same color', () => {
    const ratio = contrastRatio('#ff0000', '#ff0000');
    expect(ratio).toBeCloseTo(1, 0);
  });

  it('returns value between 1 and 21', () => {
    const ratio = contrastRatio('#3b82f6', '#ffffff');
    expect(ratio).toBeGreaterThan(1);
    expect(ratio).toBeLessThan(21);
  });
});

// ==============================
// Motion
// ==============================

describe('motionToCSS', () => {
  it('generates CSS transition string', () => {
    const durations: MotionDuration[] = [
      { name: 'normal', ms: 200 },
    ];
    const easings: MotionEasing[] = [
      { name: 'ease-out', value: 'cubic-bezier(0, 0, 0.2, 1)' },
    ];
    const transition: MotionTransition = {
      name: 'fade',
      property: 'opacity',
      duration: 'normal',
      easing: 'ease-out',
    };
    const result = motionToCSS(transition, durations, easings);
    expect(result).toBe('opacity 200ms cubic-bezier(0, 0, 0.2, 1)');
  });

  it('uses defaults for missing duration/easing', () => {
    const result = motionToCSS(
      { name: 'x', property: 'transform', duration: 'unknown', easing: 'unknown' },
      [],
      [],
    );
    expect(result).toBe('transform 200ms ease');
  });
});

describe('reducedMotionCSS', () => {
  it('generates prefers-reduced-motion media query', () => {
    const css = reducedMotionCSS();
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('animation-duration: 0.01ms');
    expect(css).toContain('transition-duration: 0.01ms');
  });
});

// ==============================
// Element Mapper
// ==============================

describe('mapElementToHTML', () => {
  it('maps input-text to input element', () => {
    const hint = mapElementToHTML('input-text');
    expect(hint.tag).toBe('input');
    expect(hint.inputType).toBe('text');
    expect(hint.role).toBe('textbox');
  });

  it('maps input-number to number input', () => {
    const hint = mapElementToHTML('input-number');
    expect(hint.tag).toBe('input');
    expect(hint.inputType).toBe('number');
  });

  it('maps selection-single to select', () => {
    const hint = mapElementToHTML('selection-single');
    expect(hint.tag).toBe('select');
    expect(hint.role).toBe('listbox');
  });

  it('maps selection-multi to select with multiple', () => {
    const hint = mapElementToHTML('selection-multi');
    expect(hint.tag).toBe('select');
    expect(hint.attributes.multiple).toBe('true');
  });

  it('maps trigger to button', () => {
    const hint = mapElementToHTML('trigger');
    expect(hint.tag).toBe('button');
    expect(hint.role).toBe('button');
  });

  it('maps container to div', () => {
    const hint = mapElementToHTML('container');
    expect(hint.tag).toBe('div');
  });

  it('maps rich-text to contenteditable div', () => {
    const hint = mapElementToHTML('rich-text');
    expect(hint.tag).toBe('div');
    expect(hint.role).toBe('textbox');
    expect(hint.attributes.contenteditable).toBe('true');
  });

  it('maps file-upload to file input', () => {
    const hint = mapElementToHTML('file-upload');
    expect(hint.tag).toBe('input');
    expect(hint.inputType).toBe('file');
  });

  it('falls back to div for unknown kinds', () => {
    const hint = mapElementToHTML('unknown-kind');
    expect(hint.tag).toBe('div');
  });
});
