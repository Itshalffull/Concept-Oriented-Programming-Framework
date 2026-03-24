// @clef-handler style=functional
// ============================================================
// AutomationTarget Handler
//
// Generate automation-manifest.json from concept Projections.
// The manifest enumerates every concept action with input/output
// JSON schemas, enabling ManifestAutomationProvider to validate
// and dispatch actions at runtime without dynamic discovery.
// See Architecture doc Sections 16.11, 16.12.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `at-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  generate(input: Record<string, unknown>) {
    const projection = (input.projection as string) || '';
    const config = (input.config as string) || '{}';

    if (!projection || projection.trim() === '') {
      return complete(createProgram(), 'error', {
        projection,
        message: 'projection is required',
      }) as StorageProgram<Result>;
    }

    let parsedConfig: Record<string, unknown>;
    try {
      parsedConfig = JSON.parse(config);
    } catch {
      return complete(createProgram(), 'error', {
        projection,
        message: 'config must be valid JSON',
      }) as StorageProgram<Result>;
    }

    const id = nextId();
    const now = new Date().toISOString();
    const outputPath = (parsedConfig.output_path as string) || 'automation-manifest.json';

    // Simulate generating entries from the projection.
    const simulatedEntries: Array<{ concept_action: string; input_schema: string; output_schema: string; category: string }> = [
      {
        concept_action: `${projection}/action`,
        input_schema: '{"type":"object"}',
        output_schema: '{"type":"object"}',
        category: 'automation',
      },
    ];

    let p = createProgram();
    p = put(p, 'automation-manifest', id, {
      id,
      config,
      entries: simulatedEntries,
      generated_at: now,
      version: '1.0.0',
      projection,
      output_path: outputPath,
    });

    return complete(p, 'ok', {
      manifest: id,
      entry_count: simulatedEntries.length,
      output_path: outputPath,
    }) as StorageProgram<Result>;
  },

  validate(input: Record<string, unknown>) {
    const manifest = (input.manifest as string) || '';

    if (!manifest || manifest.trim() === '') {
      return complete(createProgram(), 'error', { message: 'manifest is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'automation-manifest', manifest, 'existing');

    return branch(p, 'existing',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.existing as Record<string, unknown>;
        const entries = (rec.entries as Array<{ concept_action: string; input_schema: string }>) || [];

        for (const entry of entries) {
          if (!entry.concept_action || !entry.input_schema) {
            return { _variant: 'invalid_entry', entry: entry.concept_action || '(unknown)', message: 'Entry missing concept_action or input_schema' };
          }
          try {
            JSON.parse(entry.input_schema);
          } catch {
            return { _variant: 'invalid_entry', entry: entry.concept_action, message: 'input_schema is not valid JSON' };
          }
        }

        return { manifest };
      }) as StorageProgram<Result>,
      (b) => complete(b, 'notfound', { manifest }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  list_entries(input: Record<string, unknown>) {
    const manifest = (input.manifest as string) || '';

    if (!manifest || manifest.trim() === '') {
      return complete(createProgram(), 'error', { message: 'manifest is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'automation-manifest', manifest, 'existing');

    return branch(p, 'existing',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.existing as Record<string, unknown>;
        const entries = (rec.entries as Array<{ concept_action: string; category: string }>) || [];
        return { entries: entries.map(e => ({ concept_action: e.concept_action, category: e.category })) };
      }) as StorageProgram<Result>,
      (b) => complete(b, 'notfound', { manifest }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },
};

export const automationTargetHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetAutomationTarget(): void {
  idCounter = 0;
}
