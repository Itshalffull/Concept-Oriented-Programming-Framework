// ============================================================
// Frame Handler
//
// Rectangular grouping regions on a canvas. Frames have spatial
// bounds (x, y, width, height), contain items, and support
// background customization.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `frame-${++idCounter}`;
}

export const frameHandler: ConceptHandler = {
  async create(input: Record<string, unknown>, storage: ConceptStorage) {
    const x = (input.x as number) ?? 0;
    const y = (input.y as number) ?? 0;
    const width = input.width as number;
    const height = input.height as number;
    const label = (input.label as string) ?? '';

    const id = nextId();
    await storage.put('frame', id, {
      id,
      x,
      y,
      width,
      height,
      label,
      background: null,
    });

    // Initialize empty items list
    await storage.put('frame_items', id, { id, items: [] });

    return { variant: 'ok', frame: id };
  },

  async resize(input: Record<string, unknown>, storage: ConceptStorage) {
    const frame = input.frame as string;
    const width = input.width as number;
    const height = input.height as number;

    const record = await storage.get('frame', frame);
    if (!record) {
      return { variant: 'notFound', message: `Frame '${frame}' not found` };
    }

    await storage.put('frame', frame, {
      ...record,
      width,
      height,
    });

    return { variant: 'ok' };
  },

  async addItem(input: Record<string, unknown>, storage: ConceptStorage) {
    const frame = input.frame as string;
    const item = input.item as string;

    const record = await storage.get('frame', frame);
    if (!record) {
      return { variant: 'notFound', message: `Frame '${frame}' not found` };
    }

    const itemsRecord = await storage.get('frame_items', frame);
    const items = (itemsRecord?.items as string[]) ?? [];

    if (items.includes(item)) {
      return { variant: 'already_present', message: `Item '${item}' is already in frame '${frame}'` };
    }

    await storage.put('frame_items', frame, {
      id: frame,
      items: [...items, item],
    });

    return { variant: 'ok' };
  },

  async removeItem(input: Record<string, unknown>, storage: ConceptStorage) {
    const frame = input.frame as string;
    const item = input.item as string;

    const record = await storage.get('frame', frame);
    if (!record) {
      return { variant: 'notFound', message: `Frame '${frame}' not found` };
    }

    const itemsRecord = await storage.get('frame_items', frame);
    const items = (itemsRecord?.items as string[]) ?? [];

    if (!items.includes(item)) {
      return { variant: 'not_present', message: `Item '${item}' is not in frame '${frame}'` };
    }

    await storage.put('frame_items', frame, {
      id: frame,
      items: items.filter((i: string) => i !== item),
    });

    return { variant: 'ok' };
  },

  async setBackground(input: Record<string, unknown>, storage: ConceptStorage) {
    const frame = input.frame as string;
    const color = input.color as string;

    const record = await storage.get('frame', frame);
    if (!record) {
      return { variant: 'notFound', message: `Frame '${frame}' not found` };
    }

    await storage.put('frame', frame, {
      ...record,
      background: color,
    });

    return { variant: 'ok' };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetFrameCounter(): void {
  idCounter = 0;
}

export default frameHandler;
