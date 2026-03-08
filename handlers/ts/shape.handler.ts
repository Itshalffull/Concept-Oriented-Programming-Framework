// ============================================================
// Shape Handler
//
// Geometric primitives on a canvas. Each shape has a kind
// (rectangle, ellipse, triangle, etc.), fill color, stroke
// color, and optional text label.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `shape-${++idCounter}`;
}

export const shapeHandler: ConceptHandler = {
  async create(input: Record<string, unknown>, storage: ConceptStorage) {
    const kind = input.kind as string;
    const fill = (input.fill as string) ?? null;
    const stroke = (input.stroke as string) ?? null;
    const text = (input.text as string) ?? null;

    const id = nextId();
    await storage.put('shape', id, {
      id,
      kind,
      fill,
      stroke,
      text,
    });

    return { variant: 'ok', shape: id };
  },

  async update(input: Record<string, unknown>, storage: ConceptStorage) {
    const shape = input.shape as string;

    const record = await storage.get('shape', shape);
    if (!record) {
      return { variant: 'notFound', message: `Shape '${shape}' not found` };
    }

    const updated = { ...record };
    if (input.kind !== undefined) updated.kind = input.kind;
    if (input.fill !== undefined) updated.fill = input.fill;
    if (input.stroke !== undefined) updated.stroke = input.stroke;
    if (input.text !== undefined) updated.text = input.text;

    await storage.put('shape', shape, updated);

    return { variant: 'ok' };
  },

  async delete(input: Record<string, unknown>, storage: ConceptStorage) {
    const shape = input.shape as string;

    const record = await storage.get('shape', shape);
    if (!record) {
      return { variant: 'notFound', message: `Shape '${shape}' not found` };
    }

    await storage.del('shape', shape);
    return { variant: 'ok' };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetShapeCounter(): void {
  idCounter = 0;
}

export default shapeHandler;
