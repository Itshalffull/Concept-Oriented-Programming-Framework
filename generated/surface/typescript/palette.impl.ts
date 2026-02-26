// ============================================================
// Palette Concept Implementation
//
// Color system with WCAG enforcement. Generates color scales from
// seed hues, assigns semantic roles, and validates contrast ratios
// against WCAG AA / AAA thresholds.
// Relation: 'palette' keyed by C.
// ============================================================

import type { ConceptHandler } from '../../../kernel/src/types.js';

// --- Color helpers ---

/** Parse a hex color string (#RGB or #RRGGBB) into [r, g, b] in 0-255. */
function parseHex(hex: string): [number, number, number] | null {
  const match = hex.match(/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!match) return null;
  let raw = match[1];
  if (raw.length === 3) {
    raw = raw[0] + raw[0] + raw[1] + raw[1] + raw[2] + raw[2];
  }
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return [r, g, b];
}

/** Convert [r, g, b] to hex string. */
function toHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    '#' +
    clamp(r).toString(16).padStart(2, '0') +
    clamp(g).toString(16).padStart(2, '0') +
    clamp(b).toString(16).padStart(2, '0')
  );
}

/** Convert RGB to HSL. Returns [h (0-360), s (0-1), l (0-1)]. */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [h * 360, s, l];
}

/** Convert HSL to RGB. */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  h /= 360;
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

/**
 * Generate a 50-950 scale from a seed color.
 * We keep the hue fixed and vary lightness from very light (50) to very dark (950).
 */
function generateScale(seedRgb: [number, number, number]): Record<string, string> {
  const [h, s] = rgbToHsl(...seedRgb);
  const steps: Record<string, number> = {
    '50': 0.95,
    '100': 0.9,
    '200': 0.8,
    '300': 0.7,
    '400': 0.6,
    '500': 0.5,
    '600': 0.4,
    '700': 0.3,
    '800': 0.2,
    '900': 0.12,
    '950': 0.06,
  };
  const scale: Record<string, string> = {};
  for (const [step, lightness] of Object.entries(steps)) {
    const rgb = hslToRgb(h, s, lightness);
    scale[step] = toHex(...rgb);
  }
  return scale;
}

/** Relative luminance of a sRGB channel value 0-255. */
function sRGBLuminanceChannel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** Relative luminance per WCAG 2.x. */
function relativeLuminance(r: number, g: number, b: number): number {
  return (
    0.2126 * sRGBLuminanceChannel(r) +
    0.7152 * sRGBLuminanceChannel(g) +
    0.0722 * sRGBLuminanceChannel(b)
  );
}

/** Contrast ratio per WCAG 2.x (always >= 1). */
function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

const VALID_ROLES = new Set([
  'primary',
  'secondary',
  'accent',
  'success',
  'warning',
  'error',
  'neutral',
  'surface',
]);

export const paletteHandler: ConceptHandler = {
  async generate(input, storage) {
    const palette = input.palette as string;
    const name = input.name as string;
    const seed = input.seed as string;

    const rgb = parseHex(seed);
    if (!rgb) {
      return {
        variant: 'invalid',
        message: `Invalid seed color "${seed}". Expected a hex color like #3b82f6`,
      };
    }

    const [h] = rgbToHsl(...rgb);
    const scale = generateScale(rgb);
    const scaleJson = JSON.stringify(scale);

    await storage.put('palette', palette, {
      palette,
      name,
      hue: h,
      scale: scaleJson,
      role: '',
      contrastRatio: 0,
    });

    return { variant: 'ok', palette, scale: scaleJson };
  },

  async assignRole(input, storage) {
    const palette = input.palette as string;
    const role = input.role as string;

    const existing = await storage.get('palette', palette);
    if (!existing) {
      return { variant: 'notfound', message: `Palette "${palette}" not found` };
    }

    if (!VALID_ROLES.has(role)) {
      return {
        variant: 'notfound',
        message: `Invalid role "${role}". Valid roles: ${[...VALID_ROLES].join(', ')}`,
      };
    }

    await storage.put('palette', palette, {
      ...existing,
      role,
    });

    return { variant: 'ok', palette };
  },

  async checkContrast(input, storage) {
    const foreground = input.foreground as string;
    const background = input.background as string;

    const fgRgb = parseHex(foreground);
    if (!fgRgb) {
      return {
        variant: 'notfound',
        message: `Invalid foreground color "${foreground}"`,
      };
    }

    const bgRgb = parseHex(background);
    if (!bgRgb) {
      return {
        variant: 'notfound',
        message: `Invalid background color "${background}"`,
      };
    }

    const fgLum = relativeLuminance(...fgRgb);
    const bgLum = relativeLuminance(...bgRgb);
    const ratio = Math.round(contrastRatio(fgLum, bgLum) * 100) / 100;
    const passesAA = ratio >= 4.5;
    const passesAAA = ratio >= 7;

    return { variant: 'ok', ratio, passesAA, passesAAA };
  },
};
