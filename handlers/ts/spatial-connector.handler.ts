// ============================================================
// SpatialConnector Handler
//
// Visual and semantic connectors between canvas elements.
// Connectors start as visual (purely presentational) and can be
// promoted to semantic (carrying meaning in the model). Existing
// references can be surfaced as connectors, and connectors can
// be hidden (deleted).
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `connector-${++idCounter}`;
}

export const spatialConnectorHandler: ConceptHandler = {
  async draw(input: Record<string, unknown>, storage: ConceptStorage) {
    const from = input.from as string;
    const to = input.to as string;
    const type = (input.type as string) ?? 'visual';

    const id = nextId();
    await storage.put('connector', id, {
      id,
      from,
      to,
      type,
    });

    return { variant: 'ok', connector: id };
  },

  async promote(input: Record<string, unknown>, storage: ConceptStorage) {
    const connector = input.connector as string;

    const record = await storage.get('connector', connector);
    if (!record) {
      return { variant: 'notFound', message: `Connector '${connector}' not found` };
    }

    if (record.type === 'semantic') {
      return { variant: 'already_semantic', message: `Connector '${connector}' is already semantic` };
    }

    await storage.put('connector', connector, {
      ...record,
      type: 'semantic',
    });

    return { variant: 'ok' };
  },

  async demote(input: Record<string, unknown>, storage: ConceptStorage) {
    const connector = input.connector as string;

    const record = await storage.get('connector', connector);
    if (!record) {
      return { variant: 'notFound', message: `Connector '${connector}' not found` };
    }

    if (record.type === 'visual') {
      return { variant: 'already_visual', message: `Connector '${connector}' is already visual` };
    }

    await storage.put('connector', connector, {
      ...record,
      type: 'visual',
    });

    return { variant: 'ok' };
  },

  async surface(input: Record<string, unknown>, storage: ConceptStorage) {
    const ref = input.ref as string;
    const from = input.from as string;
    const to = input.to as string;

    const id = nextId();
    await storage.put('connector', id, {
      id,
      from,
      to,
      type: 'semantic',
      ref,
    });

    return { variant: 'ok', connector: id };
  },

  async hide(input: Record<string, unknown>, storage: ConceptStorage) {
    const connector = input.connector as string;

    const record = await storage.get('connector', connector);
    if (!record) {
      return { variant: 'notFound', message: `Connector '${connector}' not found` };
    }

    await storage.del('connector', connector);
    return { variant: 'ok' };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetSpatialConnectorCounter(): void {
  idCounter = 0;
}

export default spatialConnectorHandler;
