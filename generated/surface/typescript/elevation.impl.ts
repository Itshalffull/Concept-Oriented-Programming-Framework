// ============================================================
// Elevation Concept Implementation
//
// Shadow and depth system. Defines discrete elevation levels (0-5)
// with associated box-shadow values, and can auto-generate a full
// six-level scale from a base shadow color.
// Relation: 'elevation' keyed by W.
// ============================================================

import type { ConceptHandler } from '../../../kernel/src/types.js';

const MIN_LEVEL = 0;
const MAX_LEVEL = 5;

export const elevationHandler: ConceptHandler = {
  async define(input, storage) {
    const elevation = input.elevation as string;
    const level = input.level as number;
    const shadow = input.shadow as string;

    if (level < MIN_LEVEL || level > MAX_LEVEL) {
      return {
        variant: 'invalid',
        message: `Level must be between ${MIN_LEVEL} and ${MAX_LEVEL}, got ${level}`,
      };
    }

    await storage.put('elevation', elevation, {
      elevation,
      level,
      shadow,
      color: '',
    });

    return { variant: 'ok', elevation };
  },

  async get(input, storage) {
    const elevation = input.elevation as string;

    const record = await storage.get('elevation', elevation);
    if (!record) {
      return { variant: 'notfound', message: `Elevation "${elevation}" not found` };
    }

    return {
      variant: 'ok',
      elevation,
      shadow: record.shadow as string,
    };
  },

  async generateScale(input, storage) {
    const baseColor = input.baseColor as string;

    // Validate the base color looks like rgba(...) or a hex color
    const isRgba = /^rgba?\(/.test(baseColor);
    const isHex = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(baseColor);
    if (!isRgba && !isHex) {
      return {
        variant: 'invalid',
        message: `Invalid base color "${baseColor}". Expected hex (#rrggbb) or rgba() format`,
      };
    }

    // Generate six levels (0-5) with progressively larger/stronger shadows
    const shadows: Record<number, Array<{ x: number; y: number; blur: number; spread: number; color: string }>> = {};

    // Level 0: no shadow
    shadows[0] = [];

    // Levels 1-5: increasing y-offset, blur, and opacity
    const opacities = [0.05, 0.08, 0.12, 0.16, 0.22];
    const yOffsets = [1, 2, 4, 8, 16];
    const blurValues = [2, 4, 8, 16, 24];
    const spreadValues = [0, 0, 0, 2, 4];

    for (let i = 1; i <= 5; i++) {
      const idx = i - 1;
      let color: string;
      if (isHex) {
        // Convert hex to rgba with appropriate opacity
        const hex = baseColor.replace('#', '');
        const fullHex = hex.length === 3
          ? hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
          : hex.slice(0, 6);
        const r = parseInt(fullHex.slice(0, 2), 16);
        const g = parseInt(fullHex.slice(2, 4), 16);
        const b = parseInt(fullHex.slice(4, 6), 16);
        color = `rgba(${r},${g},${b},${opacities[idx]})`;
      } else {
        // For rgba input, adjust opacity
        color = baseColor.replace(
          /[\d.]+\)$/,
          `${opacities[idx]})`,
        );
      }

      shadows[i] = [
        {
          x: 0,
          y: yOffsets[idx],
          blur: blurValues[idx],
          spread: spreadValues[idx],
          color,
        },
      ];
    }

    const result = JSON.stringify(shadows);
    return { variant: 'ok', shadows: result };
  },
};
