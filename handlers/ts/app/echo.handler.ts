// @migrated dsl-constructs 2026-03-18
// Echo Concept Implementation — Functional (StorageProgram) style
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, put, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

export const echoHandler: FunctionalConceptHandler = {
  send(input: Record<string, unknown>) {
    const id = input.id as string;
    const text = input.text as string;

    let p = createProgram();
    p = put(p, 'echo', id, { text });
    return complete(p, 'ok', { id, echo: text }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
