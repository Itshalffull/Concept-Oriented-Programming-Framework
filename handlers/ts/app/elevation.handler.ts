// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Elevation Concept Implementation [W]
// Shadow-based elevation levels for depth hierarchy in UI surfaces.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

const _elevationHandler: FunctionalConceptHandler = {
  define(input: Record<string, unknown>) {
    if (!input.shadow || (typeof input.shadow === 'string' && (input.shadow as string).trim() === '')) {
      return complete(createProgram(), 'invalid', { message: 'shadow is required' }) as StorageProgram<Result>;
    }
    const elevation = input.elevation as string;
    const level = typeof input.level === 'number' ? input.level : parseInt(input.level as string, 10);
    const shadow = input.shadow as string;

    if (isNaN(level) || level < 0 || level > 5) {
      const p = createProgram();
      return complete(p, 'invalid', { message: 'Elevation level must be a number between 0 and 5' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    if (!shadow) {
      const p = createProgram();
      return complete(p, 'invalid', { message: 'Shadow definition is required' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const id = elevation || nextId('W');

    let p = createProgram();
    p = put(p, 'elevation', id, {
      level,
      shadow,
      color: '',
    });

    return complete(p, 'ok', { elevation: id }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  get(input: Record<string, unknown>) {
    const elevation = input.elevation as string;

    let p = createProgram();
    p = spGet(p, 'elevation', elevation, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { shadow: '', level: 0 }),
      (b) => complete(b, 'notfound', { message: `Elevation "${elevation}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  generateScale(input: Record<string, unknown>) {
    const baseColor = input.baseColor as string;

    if (!baseColor) {
      const p = createProgram();
      return complete(p, 'invalid', { message: 'Base color is required for shadow scale generation' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
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

    const p = createProgram();
    return complete(p, 'ok', {
      shadows: JSON.stringify(shadows),
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const elevationHandler = autoInterpret(_elevationHandler);

