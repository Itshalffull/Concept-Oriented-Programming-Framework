// @clef-handler style=functional
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch,
  type StorageProgram,
  complete,
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
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    const name = input.name as string;
    const kind = input.kind as string;

    // get existing → branch on result → put or return exists
    let p = createProgram();
    p = get(p, 'providers', name, 'existing');
    const thenBranch = complete(createProgram(), 'ok', {});
    let elseProg = createProgram();
    elseProg = put(elseProg, 'providers', name, { kind, registeredAt: '__NOW__' });
    const elseBranch = complete(elseProg, 'ok', {});
    p = branch(p, (b) => b.existing != null, thenBranch, elseBranch);
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  run(input: Record<string, unknown>) {
    if (!input.provider || (typeof input.provider === 'string' && (input.provider as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'provider is required' }) as StorageProgram<Result>;
    }
    const program = input.program as string;
    const provider = input.provider as string;
    const analysisId = `analysis-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    let p = createProgram();
    p = get(p, 'providers', provider, 'prov');
    let notFoundProg = createProgram();
    notFoundProg = put(notFoundProg, 'results', analysisId, { program, provider, result: '__PENDING__', providerNotFound: true });
    const notFound = complete(notFoundProg, 'ok', { analysis: analysisId, result: '__PENDING__' });
    let foundProg = createProgram();
    foundProg = put(foundProg, 'results', analysisId, { program, provider, result: '__PENDING__' });
    const found = complete(foundProg, 'ok', { analysis: analysisId, result: '__PENDING__' });
    p = branch(p, (b) => b.prov == null, notFound, found);
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  runAll(input: Record<string, unknown>) {
    if (!input.program || (typeof input.program === 'string' && (input.program as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'program is required' }) as StorageProgram<Result>;
    }
    const program = input.program as string;

    let p = createProgram();
    p = find(p, 'providers', {}, 'providers');
    p = complete(p, 'ok', { program, results: '__DEFERRED__' });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  listProviders(input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'providers', {}, 'providers');
    p = complete(p, 'ok', { providers: '__BOUND_FROM_PROVIDERS__' });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

// Re-export imperative version for backward compatibility during migration
export { programAnalysisHandler as functionalProgramAnalysisHandler };
