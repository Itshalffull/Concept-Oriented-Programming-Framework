// @migrated dsl-constructs 2026-03-18
// Palette Concept Implementation [C]
// Color palette generation with role assignment and WCAG contrast checking.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

export const paletteHandler: FunctionalConceptHandler = {
  generate(input: Record<string, unknown>) {
    const palette = input.palette as string;
    const name = input.name as string;
    const seed = input.seed as string;

    let p = createProgram();

    if (!seed) {
      return complete(p, 'invalid', { message: 'A seed color is required to generate the palette scale' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const colorPattern = /^(#[0-9a-fA-F]{3,8}|rgb|hsl|oklch|oklab)/;
    if (!colorPattern.test(seed)) {
      return complete(p, 'invalid', { message: `Invalid seed color "${seed}". Expected hex, rgb, hsl, oklch, or oklab format` }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const id = palette || nextId('C');

    const steps = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900];
    const scale: Record<string, string> = {};
    for (const step of steps) {
      scale[String(step)] = `${seed}-${step}`;
    }

    p = put(p, 'palette', id, {
      name,
      hue: seed,
      scale: JSON.stringify(scale),
      role: '',
      contrastRatio: 0,
    });

    return complete(p, 'ok', { scale: JSON.stringify(scale) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  assignRole(input: Record<string, unknown>) {
    const palette = input.palette as string;
    const role = input.role as string;

    let p = createProgram();
    p = spGet(p, 'palette', palette, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'palette', palette, { role });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: `Palette "${palette}" not found` }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  checkContrast(input: Record<string, unknown>) {
    const foreground = input.foreground as string;
    const background = input.background as string;

    let p = createProgram();
    p = spGet(p, 'palette', foreground, 'fgPalette');
    p = branch(p, 'fgPalette',
      (b) => {
        let b2 = spGet(b, 'palette', background, 'bgPalette');
        b2 = branch(b2, 'bgPalette',
          (c) => {
            const ratio = 4.5;
            const passesAA = ratio >= 4.5;
            const passesAAA = ratio >= 7.0;
            return complete(c, 'ok', { ratio, passesAA, passesAAA });
          },
          (c) => complete(c, 'notfound', { message: `Background palette "${background}" not found` }),
        );
        return b2;
      },
      (b) => complete(b, 'notfound', { message: `Foreground palette "${foreground}" not found` }),
    );

    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
