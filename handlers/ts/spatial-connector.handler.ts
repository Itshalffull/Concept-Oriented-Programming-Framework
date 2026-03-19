// @migrated dsl-constructs 2026-03-18
// ============================================================
// SpatialConnector Handler
//
// Visual and semantic connectors between canvas elements.
// Connectors start as visual (purely presentational) and can be
// promoted to semantic (carrying meaning in the model). Existing
// references can be surfaced as connectors, and connectors can
// be hidden (deleted).
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `connector-${++idCounter}`;
}

export const spatialConnectorHandler: ConceptHandler = {
  async draw(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const canvas = (input.canvas as string) ?? 'canvas';
    const source = (input.source as string) ?? (input.from as string);
    const target = (input.target as string) ?? (input.to as string);
    const type = (input.type as string) ?? 'visual';
    const label = (input.label as string | undefined) ?? undefined;

    const id = nextId();
    const record = {
      id, connector: id,
      connector_canvas: canvas, connector_source: source,
      connector_target: target, connector_type: type,
      connector_label: label ?? null,
      from: source, to: target, type,
    };

    await storage.put('spatial-connector', id, record);
    await storage.put('connector', id, record);
    return { variant: 'ok', connector: id };
  },

  async promote(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const connector = input.connector as string;
    const record = await storage.get('spatial-connector', connector);
    if (!record) return { variant: 'notFound', message: `Connector '${connector}' not found` };

    if (record.connector_type === 'semantic' || record.type === 'semantic') {
      return { variant: 'already_semantic', message: `Connector '${connector}' is already semantic` };
    }

    const updated = { ...record, type: 'semantic', connector_type: 'semantic' };
    await storage.put('spatial-connector', connector, updated);
    await storage.put('connector', connector, updated);
    return { variant: 'ok' };
  },

  async demote(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const connector = input.connector as string;
    const record = await storage.get('spatial-connector', connector);
    if (!record) return { variant: 'notFound', message: `Connector '${connector}' not found` };

    if (record.connector_type === 'visual' || record.type === 'visual') {
      return { variant: 'not_semantic', message: `Connector '${connector}' is not semantic` };
    }

    const updated = { ...record, type: 'visual', connector_type: 'visual' };
    await storage.put('spatial-connector', connector, updated);
    await storage.put('connector', connector, updated);
    return { variant: 'ok' };
  },

  async surface(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const canvas = (input.canvas as string) ?? 'canvas';
    const source = (input.source as string) ?? (input.from as string);
    const target = (input.target as string) ?? (input.to as string);
    const ref = (input.ref as string | undefined) ?? undefined;

    const id = nextId();
    const record = {
      id, connector: id,
      connector_canvas: canvas, connector_source: source,
      connector_target: target, connector_type: 'surfaced',
      connector_label: ref ?? null,
      from: source, to: target, ref, type: 'semantic',
    };

    await storage.put('spatial-connector', id, record);
    await storage.put('connector', id, record);
    return { variant: 'ok', connector: id };
  },

  async hide(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const connector = input.connector as string;
    const record = await storage.get('spatial-connector', connector);
    if (!record) return { variant: 'notFound', message: `Connector '${connector}' not found` };

    await storage.del('spatial-connector', connector);
    await storage.del('connector', connector);
    return { variant: 'ok' };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetSpatialConnectorCounter(): void {
  idCounter = 0;
}

export default spatialConnectorHandler;
