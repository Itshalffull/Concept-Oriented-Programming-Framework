// Typography Concept Implementation [X]
// Typographic scales, font stacks, and text style definitions.
import type { ConceptHandler } from '@clef/runtime';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

const VALID_CATEGORIES = ['serif', 'sans-serif', 'monospace', 'display', 'handwriting'];

export const typographyHandler: ConceptHandler = {
  async defineScale(input, storage) {
    const typography = input.typography as string;
    const baseSize = input.baseSize as number;
    const ratio = input.ratio as number;
    const steps = input.steps as number;

    if (typeof baseSize !== 'number' || baseSize <= 0) {
      return { variant: 'invalid', message: 'Base size must be a positive number' };
    }

    if (typeof ratio !== 'number' || ratio <= 0) {
      return { variant: 'invalid', message: 'Ratio must be a positive number' };
    }

    if (typeof steps !== 'number' || steps < 1 || !Number.isInteger(steps)) {
      return { variant: 'invalid', message: 'Steps must be a positive integer' };
    }

    const id = typography || nextId('X');

    // Generate a modular type scale
    const scale: Record<string, number> = {};
    for (let i = -2; i <= steps; i++) {
      const size = Math.round(baseSize * Math.pow(ratio, i) * 100) / 100;
      const label = i < 0 ? `sm${Math.abs(i)}` : i === 0 ? 'base' : `h${Math.min(i, 6)}`;
      scale[label] = size;
    }

    await storage.put('typography', id, {
      name: `scale-${id}`,
      kind: 'scale',
      value: JSON.stringify({ baseSize, ratio, steps }),
      scale: JSON.stringify(scale),
    });

    return { variant: 'ok', scale: JSON.stringify(scale) };
  },

  async defineFontStack(input, storage) {
    const typography = input.typography as string;
    const name = input.name as string;
    const fonts = input.fonts as string;
    const category = input.category as string;

    if (!VALID_CATEGORIES.includes(category)) {
      return { variant: 'invalid', message: `Invalid category "${category}". Valid categories: ${VALID_CATEGORIES.join(', ')}` };
    }

    const id = typography || nextId('X');

    // Check for duplicate font stack name
    const existing = await storage.get('typography', id);
    if (existing && existing.kind === 'fontStack' && existing.name === name) {
      return { variant: 'duplicate', message: `Font stack "${name}" already exists` };
    }

    let fontList: string[];
    try {
      fontList = JSON.parse(fonts);
    } catch {
      fontList = fonts.split(',').map(f => f.trim());
    }

    // Append generic family fallback
    if (!fontList.includes(category)) {
      fontList.push(category);
    }

    await storage.put('typography', id, {
      name,
      kind: 'fontStack',
      value: fontList.join(', '),
      scale: '',
    });

    return { variant: 'ok', typography: id };
  },

  async defineStyle(input, storage) {
    const typography = input.typography as string;
    const name = input.name as string;
    const config = input.config as string;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(config);
    } catch {
      return { variant: 'invalid', message: 'Style config must be valid JSON with fontSize, fontWeight, lineHeight, letterSpacing fields' };
    }

    if (!parsed.fontSize) {
      return { variant: 'invalid', message: 'Style config must include at least "fontSize"' };
    }

    const id = typography || nextId('X');

    await storage.put('typography', id, {
      name,
      kind: 'style',
      value: JSON.stringify(parsed),
      scale: '',
    });

    return { variant: 'ok', typography: id };
  },
};
