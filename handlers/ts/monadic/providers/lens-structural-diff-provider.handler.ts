// @clef-handler style=imperative
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, putLens, pure, relation, at,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';

interface StateField {
  name: string;
  type: string;
  cardinality?: string;
}

interface LensOperation {
  op: 'addField' | 'removeField' | 'renameField' | 'changeType' | 'changeCardinality';
  field?: string;
  from?: string;
  to?: string;
  type?: string;
  default?: unknown;
  oldCardinality?: string;
  newCardinality?: string;
}

/** Compute structural diff between two schema versions as lens operations. */
function diffSchemas(oldFields: StateField[], newFields: StateField[]): LensOperation[] {
  const ops: LensOperation[] = [];
  const oldByName = new Map(oldFields.map(f => [f.name, f]));
  const newByName = new Map(newFields.map(f => [f.name, f]));

  const removedFields: StateField[] = [];
  const addedFields: StateField[] = [];

  // Find removed and changed fields
  for (const [name, oldField] of oldByName) {
    const newField = newByName.get(name);
    if (!newField) {
      removedFields.push(oldField);
    } else {
      // Check for type change
      if (oldField.type !== newField.type) {
        ops.push({ op: 'changeType', field: name, from: oldField.type, to: newField.type });
      }
      // Check for cardinality change
      const oldCard = oldField.cardinality || 'one';
      const newCard = newField.cardinality || 'one';
      if (oldCard !== newCard) {
        ops.push({ op: 'changeCardinality', field: name, oldCardinality: oldCard, newCardinality: newCard });
      }
    }
  }

  // Find added fields
  for (const [name, newField] of newByName) {
    if (!oldByName.has(name)) {
      addedFields.push(newField);
    }
  }

  // Detect renames: one removed + one added with the same type
  const usedRemoved = new Set<string>();
  const usedAdded = new Set<string>();
  for (const removed of removedFields) {
    for (const added of addedFields) {
      if (!usedRemoved.has(removed.name) && !usedAdded.has(added.name) && removed.type === added.type) {
        ops.push({ op: 'renameField', from: removed.name, to: added.name });
        usedRemoved.add(removed.name);
        usedAdded.add(added.name);
        break;
      }
    }
  }

  // Remaining removals (not renames)
  for (const removed of removedFields) {
    if (!usedRemoved.has(removed.name)) {
      ops.push({ op: 'removeField', field: removed.name, type: removed.type });
    }
  }

  // Remaining additions (not renames)
  for (const added of addedFields) {
    if (!usedAdded.has(added.name)) {
      ops.push({ op: 'addField', field: added.name, type: added.type, default: null });
    }
  }

  return ops;
}

// Module-scope lens for results relation — dogfooding
const resultsRel = relation('results');

/**
 * LensStructuralDiffProvider — functional handler.
 *
 * Compares two concept state schemas and produces a structural diff
 * expressed as lens operations for the Diff-Patch migration pipeline.
 */
export const lensStructuralDiffProviderHandler: FunctionalConceptHandler = {
  analyze(input: Record<string, unknown>) {
    const oldSchemaStr = input.oldSchema as string;
    const newSchemaStr = input.newSchema as string;

    try {
      const oldFields = JSON.parse(oldSchemaStr) as StateField[];
      const newFields = JSON.parse(newSchemaStr) as StateField[];

      if (!Array.isArray(oldFields) || !Array.isArray(newFields)) {
        const p = pure(createProgram(), {
          variant: 'error',
          message: 'Schemas must be JSON arrays of state field declarations',
        });
        return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
      }

      const operations = diffSchemas(oldFields, newFields);

      if (operations.length === 0) {
        const p = pure(createProgram(), { variant: 'identical' });
        return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
      }

      const resultId = `lsd-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const operationsJson = JSON.stringify(operations);
      const editScript = JSON.stringify(operations.map(op => ({
        ...op,
        lensPath: op.field || op.from || op.to,
      })));

      let p = createProgram();
      p = putLens(p, at(resultsRel, resultId), {
        operations: operationsJson,
        editScript,
      });
      p = pure(p, {
        variant: 'ok',
        result: resultId,
        operations: operationsJson,
        editScript,
      });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    } catch (e) {
      const p = pure(createProgram(), {
        variant: 'error',
        message: `Failed to parse schemas: ${(e as Error).message}`,
      });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }
  },
};
