// ============================================================
// SyncCompiler Concept Implementation
//
// Compiles parsed synchronization ASTs into executable
// registrations (CompiledSync objects) that the kernel's
// sync engine can register and evaluate.
//
// The bootstrap parseSyncFile already produces CompiledSync
// objects directly. The SyncCompiler concept validates and
// normalizes them, resolving where-clause queries into
// query plans per Section 6.5 of the architecture doc.
// ============================================================

import type { ConceptHandler, ConceptStorage, CompiledSync } from '../../../runtime/types.js';
import { generateId } from '../../../runtime/types.js';

export const syncCompilerHandler: ConceptHandler = {
  async compile(input, storage) {
    const syncRef = input.sync as string;
    const ast = input.ast as CompiledSync;

    if (!ast || !ast.name) {
      return { variant: 'error', message: 'Invalid sync AST: missing name' };
    }

    try {
      // Validate the sync structure
      if (!ast.when || ast.when.length === 0) {
        return { variant: 'error', message: `Sync "${ast.name}": when clause is required` };
      }
      if (!ast.then || ast.then.length === 0) {
        return { variant: 'error', message: `Sync "${ast.name}": then clause is required` };
      }

      // Collect all variables used across the sync for consistency checking
      const boundVars = new Set<string>();
      const referencedVars = new Set<string>();

      // Variables bound in when-clause output fields
      for (const pattern of ast.when) {
        for (const field of pattern.inputFields) {
          if (field.match.type === 'variable') boundVars.add(field.match.name);
        }
        for (const field of pattern.outputFields) {
          if (field.match.type === 'variable') boundVars.add(field.match.name);
        }
      }

      // Variables bound in where-clause
      for (const entry of ast.where || []) {
        if (entry.type === 'bind' && entry.as) {
          boundVars.add(entry.as);
        }
        if (entry.type === 'query' && entry.bindings) {
          for (const b of entry.bindings) {
            // Query bindings can both consume and produce variables
            boundVars.add(b.variable);
          }
        }
      }

      // Variables referenced in then-clause
      for (const action of ast.then) {
        for (const field of action.fields) {
          if (field.value.type === 'variable') {
            referencedVars.add(field.value.name);
          }
        }
      }

      // Warn about unbound variables in then-clause
      const unboundInThen: string[] = [];
      for (const v of referencedVars) {
        if (!boundVars.has(v)) {
          unboundInThen.push(v);
        }
      }

      if (unboundInThen.length > 0) {
        return {
          variant: 'error',
          message: `Sync "${ast.name}": then-clause references unbound variables: ${unboundInThen.join(', ')}`,
        };
      }

      // The compiled sync is the AST itself (already in CompiledSync form
      // from the bootstrap parser). In later stages, this step would perform
      // additional transformations like query plan generation.
      const compiled: CompiledSync = {
        name: ast.name,
        annotations: ast.annotations,
        when: ast.when,
        where: ast.where || [],
        then: ast.then,
      };

      // Store the compiled sync
      await storage.put('compiled', syncRef, { syncRef, compiled });

      return { variant: 'ok', compiled };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return { variant: 'error', message };
    }
  },
};
