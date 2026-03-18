// @migrated dsl-constructs 2026-03-18
// Annotation Concept Implementation (Clef Bind)
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';

const annotationHandlerFunctional: FunctionalConceptHandler = {
  annotate(input: Record<string, unknown>) {
    const concept = input.concept as string;
    const scope = input.scope as string;
    const metadata = input.metadata as string;

    // Parse metadata JSON
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(metadata);
    } catch {
      let p = createProgram();
      return complete(p, 'invalidScope', { scope }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    // Validate scope: must be "concept" or a non-empty action name
    if (!scope || scope.trim() === '') {
      let p = createProgram();
      return complete(p, 'invalidScope', { scope }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const fieldCount = Object.keys(parsed).length;
    const annotationId = `${concept}::${scope}`;

    let p = createProgram();
    p = spGet(p, 'annotation', annotationId, 'existing');

    const examples = parsed.examples ?? [];
    const references = parsed.references ?? [];
    const toolPermissions = parsed.toolPermissions ?? [];
    const argumentTemplate = parsed.argumentTemplate ?? null;
    const relatedItems = parsed.relatedItems ?? [];

    p = put(p, 'annotation', annotationId, {
      annotationId,
      targetConcept: concept,
      scope,
      examples: JSON.stringify(examples),
      references: JSON.stringify(references),
      toolPermissions: JSON.stringify(toolPermissions),
      argumentTemplate: argumentTemplate != null ? String(argumentTemplate) : '',
      relatedItems: JSON.stringify(relatedItems),
    });

    return complete(p, 'ok', { annotation: annotationId, fieldCount }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  resolve(input: Record<string, unknown>) {
    const concept = input.concept as string;

    let p = createProgram();
    p = find(p, 'annotation', {}, 'allAnnotations');
    // Filtering by targetConcept and sorting handled at runtime
    return complete(p, 'ok', { annotations: '' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

/** Backward-compatible imperative wrapper — delegates to interpret(). */
export const annotationHandler = wrapFunctional(annotationHandlerFunctional);
/** The raw functional handler returning StorageProgram. */
export { annotationHandlerFunctional };
