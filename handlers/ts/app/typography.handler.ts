// @migrated dsl-constructs 2026-03-18
// Typography Concept Implementation [X]
// Typographic scales, font stacks, and text style definitions.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }
const VALID_CATEGORIES = ['serif', 'sans-serif', 'monospace', 'display', 'handwriting'];

const _typographyHandler: FunctionalConceptHandler = {
  defineScale(input: Record<string, unknown>) {
    const typography = input.typography as string;
    const baseSize = input.baseSize as number;
    const ratio = input.ratio as number;
    const steps = input.steps as number;
    if (typeof baseSize !== 'number' || baseSize <= 0) { let p = createProgram(); return complete(p, 'invalid', { message: 'Base size must be a positive number' }) as StorageProgram<{ variant: string; [key: string]: unknown }>; }
    if (typeof ratio !== 'number' || ratio <= 0) { let p = createProgram(); return complete(p, 'invalid', { message: 'Ratio must be a positive number' }) as StorageProgram<{ variant: string; [key: string]: unknown }>; }
    if (typeof steps !== 'number' || steps < 1 || !Number.isInteger(steps)) { let p = createProgram(); return complete(p, 'invalid', { message: 'Steps must be a positive integer' }) as StorageProgram<{ variant: string; [key: string]: unknown }>; }
    const id = typography || nextId('X');
    const scale: Record<string, number> = {};
    for (let i = -2; i <= steps; i++) {
      const size = Math.round(baseSize * Math.pow(ratio, i) * 100) / 100;
      const label = i < 0 ? `sm${Math.abs(i)}` : i === 0 ? 'base' : `h${Math.min(i, 6)}`;
      scale[label] = size;
    }
    let p = createProgram();
    p = put(p, 'typography', id, { name: `scale-${id}`, kind: 'scale', value: JSON.stringify({ baseSize, ratio, steps }), scale: JSON.stringify(scale) });
    return complete(p, 'ok', { scale: JSON.stringify(scale) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  defineFontStack(input: Record<string, unknown>) {
    const typography = input.typography as string;
    const name = input.name as string;
    const fonts = input.fonts as string;
    const category = input.category as string;
    if (!VALID_CATEGORIES.includes(category)) { let p = createProgram(); return complete(p, 'invalid', { message: `Invalid category "${category}". Valid categories: ${VALID_CATEGORIES.join(', ')}` }) as StorageProgram<{ variant: string; [key: string]: unknown }>; }
    const id = typography || nextId('X');
    let fontList: string[];
    try { fontList = JSON.parse(fonts); } catch { fontList = fonts.split(',').map(f => f.trim()); }
    if (!fontList.includes(category)) fontList.push(category);
    let p = createProgram();
    p = spGet(p, 'typography', id, 'existing');
    p = branch(p, 'existing',
      (b) => {
        // Check for duplicate font stack name
        return complete(b, 'duplicate', { message: `Font stack "${name}" already exists` });
      },
      (b) => {
        let b2 = put(b, 'typography', id, { name, kind: 'fontStack', value: fontList.join(', '), scale: '' });
        return complete(b2, 'ok', { typography: id });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  defineStyle(input: Record<string, unknown>) {
    const typography = input.typography as string;
    const name = input.name as string;
    const config = input.config as string;
    let parsed: Record<string, unknown>;
    try { parsed = JSON.parse(config); } catch { let p = createProgram(); return complete(p, 'invalid', { message: 'Style config must be valid JSON with fontSize, fontWeight, lineHeight, letterSpacing fields' }) as StorageProgram<{ variant: string; [key: string]: unknown }>; }
    if (!parsed.fontSize) { let p = createProgram(); return complete(p, 'invalid', { message: 'Style config must include at least "fontSize"' }) as StorageProgram<{ variant: string; [key: string]: unknown }>; }
    const id = typography || nextId('X');
    let p = createProgram();
    p = put(p, 'typography', id, { name, kind: 'style', value: JSON.stringify(parsed), scale: '' });
    return complete(p, 'ok', { typography: id }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const typographyHandler = autoInterpret(_typographyHandler);

