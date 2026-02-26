// ============================================================
// Typography Concept Implementation
//
// Type scale and text styles. Generates modular type scales from
// a base size and ratio, registers named font stacks, and defines
// reusable text styles referencing scale steps.
// Relation: 'typography' keyed by X (kind discriminates entries).
// ============================================================

import type { ConceptHandler } from '../../../kernel/src/types.js';

/**
 * Scale step names, ordered from smallest to largest.
 * The number of names generated equals `steps * 2 + 1` (steps below base,
 * the base itself, and steps above base). We pre-define a generous list.
 */
const SCALE_NAMES = [
  'xs',
  'sm',
  'base',
  'lg',
  'xl',
  '2xl',
  '3xl',
  '4xl',
  '5xl',
  '6xl',
  '7xl',
  '8xl',
  '9xl',
];

export const typographyHandler: ConceptHandler = {
  async defineScale(input, storage) {
    const typography = input.typography as string;
    const baseSize = input.baseSize as number;
    const ratio = input.ratio as number;
    const steps = input.steps as number;

    if (baseSize <= 0) {
      return { variant: 'invalid', message: 'baseSize must be greater than 0' };
    }
    if (ratio <= 0) {
      return { variant: 'invalid', message: 'ratio must be greater than 0' };
    }
    if (steps < 1) {
      return { variant: 'invalid', message: 'steps must be at least 1' };
    }

    // Build scale: base is at index 2 ("base"), steps go upward
    // We generate: xs (base / ratio^2), sm (base / ratio), base, lg, xl, 2xl ...
    const scale: Record<string, number> = {};
    // Below base: xs = base / ratio^2, sm = base / ratio
    scale['xs'] = Math.round((baseSize / Math.pow(ratio, 2)) * 100) / 100;
    scale['sm'] = Math.round((baseSize / ratio) * 100) / 100;
    scale['base'] = baseSize;

    // Above base: each step multiplies by ratio
    const aboveNames = SCALE_NAMES.slice(3); // lg, xl, 2xl, 3xl, ...
    for (let i = 0; i < steps && i < aboveNames.length; i++) {
      scale[aboveNames[i]] = Math.round(baseSize * Math.pow(ratio, i + 1) * 100) / 100;
    }

    const scaleJson = JSON.stringify(scale);

    await storage.put('typography', typography, {
      typography,
      name: 'scale',
      kind: 'scale',
      value: scaleJson,
      scale: scaleJson,
    });

    return { variant: 'ok', typography, scale: scaleJson };
  },

  async defineFontStack(input, storage) {
    const typography = input.typography as string;
    const name = input.name as string;
    const fonts = input.fonts as string;
    const category = input.category as string;

    // Check for duplicate font stack name
    const existing = await storage.find('typography', { kind: 'fontstack', name });
    if (existing.length > 0) {
      return {
        variant: 'duplicate',
        message: `Font stack with name "${name}" already exists`,
      };
    }

    await storage.put('typography', typography, {
      typography,
      name,
      kind: 'fontstack',
      value: JSON.stringify({ fonts, category }),
      scale: '',
    });

    return { variant: 'ok', typography };
  },

  async defineStyle(input, storage) {
    const typography = input.typography as string;
    const name = input.name as string;
    const config = input.config as string;

    // Validate that config is parseable JSON
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(config);
    } catch {
      return { variant: 'invalid', message: `Invalid config JSON: ${config}` };
    }

    // If the config references a scale step, verify a scale exists
    if (parsed.scale) {
      const scales = await storage.find('typography', { kind: 'scale' });
      if (scales.length === 0) {
        return {
          variant: 'invalid',
          message: 'No type scale defined. Call defineScale first.',
        };
      }
    }

    await storage.put('typography', typography, {
      typography,
      name,
      kind: 'style',
      value: config,
      scale: '',
    });

    return { variant: 'ok', typography };
  },
};
