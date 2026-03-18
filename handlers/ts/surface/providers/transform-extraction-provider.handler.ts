import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import { wrapFunctional } from '../../../../runtime/functional-compat.ts';
import {
  createProgram, putLens, complete, relation, at,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';

// Lens for storing analysis results — dogfooding the lens DSL
const resultsRel = relation('results');

/**
 * TransformExtractionProvider — functional handler.
 *
 * Extracts the appliedTransforms metadata from a serialized
 * RenderProgram, enabling provenance queries about which
 * transforms produced a given output.
 */
const transformExtractionProviderHandlerFunctional: FunctionalConceptHandler = {
  analyze(input: Record<string, unknown>) {
    const programStr = input.program as string;

    try {
      const parsed = JSON.parse(programStr);
      const appliedTransforms: string[] = Array.isArray(parsed.appliedTransforms)
        ? parsed.appliedTransforms
        : [];
      const transformCount = appliedTransforms.length;

      const resultId = `txp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      let p = createProgram();
      p = putLens(p, at(resultsRel, resultId), {
        appliedTransforms: JSON.stringify(appliedTransforms),
        transformCount,
      });
      p = complete(p, 'ok', {
        result: resultId,
        appliedTransforms: JSON.stringify(appliedTransforms),
        transformCount,
      });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    } catch (e) {
      const p = complete(createProgram(), 'error', {
        message: `Failed to analyze program: ${(e as Error).message}`,
      });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }
  },
};

export const transformExtractionProviderHandler = wrapFunctional(transformExtractionProviderHandlerFunctional);
export { transformExtractionProviderHandlerFunctional };
