// @clef-handler style=functional
// ContributionPoint Concept Implementation
// Extension points that a host exposes for extensions to contribute to:
// toolbar buttons, sidebar panels, commands, widgets, navigation destinations.
// See Architecture doc for concept spec details.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `cp-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'ContributionPoint' }) as StorageProgram<Result>;
  },

  definePoint(input: Record<string, unknown>) {
    const name = input.name as string;
    const pointType = input.pointType as string;
    const schema = (input.schema as string | undefined) ?? '{}';

    if (!name || name.trim() === '') {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    if (!pointType || pointType.trim() === '') {
      return complete(createProgram(), 'error', { message: 'pointType is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'contributionPoint', { pointName: name }, 'existing');
    p = mapBindings(p, (b) => ((b.existing as unknown[]) || []).length > 0 ? (b.existing as unknown[])[0] : null, '_found');
    return branch(p, '_found',
      (b) => complete(b, 'ok', { message: 'A point with the same name already exists.' }),
      (b) => {
        const id = nextId();
        let b2 = put(b, 'contributionPoint', id, {
          id, pointName: name, pointType, schema,
          contributions: '[]',
        });
        return complete(b2, 'ok', { point: id });
      },
    ) as StorageProgram<Result>;
  },

  contribute(input: Record<string, unknown>) {
    const point = input.point as string;
    const extensionId = input.extensionId as string;
    const data = (input.data as string | undefined) ?? '{}';

    if (!extensionId || extensionId.trim() === '') {
      return complete(createProgram(), 'error', { message: 'extensionId is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'contributionPoint', point, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'contributionPoint', point, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          let contributions: Array<{ extensionId: string; data: string }> = [];
          try { contributions = JSON.parse(record.contributions as string || '[]'); } catch { contributions = []; }
          contributions.push({ extensionId, data });
          return { ...record, contributions: JSON.stringify(contributions) };
        });
        return complete(b2, 'ok', { point });
      },
      (b) => complete(b, 'notfound', { message: 'No contribution point with the given identifier.' }),
    ) as StorageProgram<Result>;
  },

  retract(input: Record<string, unknown>) {
    const point = input.point as string;
    const extensionId = input.extensionId as string;

    let p = createProgram();
    p = get(p, 'contributionPoint', point, 'record');
    return branch(p, 'record',
      (b) => {
        let b2 = putFrom(b, 'contributionPoint', point, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          let contributions: Array<{ extensionId: string; data: string }> = [];
          try { contributions = JSON.parse(record.contributions as string || '[]'); } catch { contributions = []; }
          contributions = contributions.filter((c) => c.extensionId !== extensionId);
          return { ...record, contributions: JSON.stringify(contributions) };
        });
        return complete(b2, 'ok', { point });
      },
      (b) => complete(b, 'notfound', { message: 'No contribution point or extension contribution found.' }),
    ) as StorageProgram<Result>;
  },

  listContributions(input: Record<string, unknown>) {
    const point = input.point as string;

    let p = createProgram();
    p = get(p, 'contributionPoint', point, 'record');
    return branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        return { contributions: record.contributions as string };
      }),
      (b) => complete(b, 'notfound', { message: 'No contribution point with the given identifier.' }),
    ) as StorageProgram<Result>;
  },

  listPoints(input: Record<string, unknown>) {
    const pointType = input.pointType as string | undefined;

    let p = createProgram();
    const criteria: Record<string, unknown> = pointType ? { pointType } : {};
    p = find(p, 'contributionPoint', criteria, 'all');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.all as unknown[]) || [];
      return { points: JSON.stringify(all) };
    }) as StorageProgram<Result>;
  },
};

export const contributionPointHandler = autoInterpret(_handler);
