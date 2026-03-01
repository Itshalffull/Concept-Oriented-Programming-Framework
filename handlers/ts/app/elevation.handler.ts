// Elevation Concept Implementation [W]
// Shadow-based elevation levels for depth hierarchy in UI surfaces.
import type { ConceptHandler } from '@clef/runtime';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

export const elevationHandler: ConceptHandler = {
  async define(input, storage) {
    const elevation = input.elevation as string;
    const level = input.level as number;
    const shadow = input.shadow as string;

    if (typeof level !== 'number' || level < 0 || level > 5) {
      return { variant: 'invalid', message: 'Elevation level must be a number between 0 and 5' };
    }

    if (!shadow) {
      return { variant: 'invalid', message: 'Shadow definition is required' };
    }

    const id = elevation || nextId('W');

    await storage.put('elevation', id, {
      level,
      shadow,
      color: '',
    });

    return { variant: 'ok', elevation: id };
  },

  async get(input, storage) {
    const elevation = input.elevation as string;

    const existing = await storage.get('elevation', elevation);
    if (!existing) {
      return { variant: 'notfound', message: `Elevation "${elevation}" not found` };
    }

    return {
      variant: 'ok',
      shadow: existing.shadow as string,
      level: existing.level as number,
    };
  },

  async generateScale(input, storage) {
    const baseColor = input.baseColor as string;

    if (!baseColor) {
      return { variant: 'invalid', message: 'Base color is required for shadow scale generation' };
    }

    // Generate a 6-level elevation scale (0-5) from the base color
    const shadows: string[] = [];
    for (let i = 0; i <= 5; i++) {
      const offsetY = i * 2;
      const blur = i * 4;
      const spread = Math.max(0, i - 1);
      const opacity = (i * 0.05).toFixed(2);
      shadows.push(`0 ${offsetY}px ${blur}px ${spread}px rgba(${baseColor}, ${opacity})`);
    }

    return {
      variant: 'ok',
      shadows: JSON.stringify(shadows),
    };
  },
};
