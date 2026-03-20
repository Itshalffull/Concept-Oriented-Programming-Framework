// @clef-handler style=functional
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, pure, branch,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

/**
 * ProgramAnalysis — functional handler.
 *
 * Returns StoragePrograms describing provider dispatch operations.
 * The ProgramInterpreter executes these against storage via the
 * BuildAndExecute sync.
 */
export const programAnalysisHandler: FunctionalConceptHandler = {
  registerProvider(input: Record<string, unknown>) {
    const name = input.name as string;
    const kind = input.kind as string;

    // get existing → branch on result → put or return exists
    let p = createProgram();
    p = get(p, 'providers', name, 'existing');
    const thenBranch = pure(createProgram(), { variant: 'exists' });
    const elseBranch = pure(
      put(createProgram(), 'providers', name, { kind, registeredAt: '__NOW__' }),
      { variant: 'ok' },
    );
    p = branch(p, (b) => b.existing != null, thenBranch, elseBranch);
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  run(input: Record<string, unknown>) {
    const program = input.program as string;
    const provider = input.provider as string;
    const analysisId = `analysis-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    let p = createProgram();
    p = get(p, 'providers', provider, 'prov');
    const notFound = pure(createProgram(), { variant: 'providerNotFound' });
    const found = pure(
      put(createProgram(), 'results', analysisId, { program, provider, result: '__PENDING__' }),
      { variant: 'ok', analysis: analysisId, result: '__PENDING__' },
    );
    p = branch(p, (b) => b.prov == null, notFound, found);
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  runAll(input: Record<string, unknown>) {
    const program = input.program as string;

    let p = createProgram();
    p = find(p, 'providers', {}, 'providers');
    p = pure(p, { variant: 'ok', program, results: '__DEFERRED__' });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  listProviders(input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'providers', {}, 'providers');
    p = pure(p, { variant: 'ok', providers: '__BOUND_FROM_PROVIDERS__' });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

// Re-export imperative version for backward compatibility during migration
export { programAnalysisHandler as functionalProgramAnalysisHandler };
