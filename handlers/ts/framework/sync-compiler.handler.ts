// @clef-handler style=imperative
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

/**
 * Normalize a serialized AST record (type:"record", fields:[...]) into a plain object.
 * If the value is already a plain object, return it as-is.
 */
function normalizeAst(ast: unknown): Record<string, unknown> {
  if (!ast || typeof ast !== 'object') return {};
  const obj = ast as Record<string, unknown>;

  // Already a plain CompiledSync-like object (has name as string)
  if (typeof obj.name === 'string') return obj;

  // Serialized record: { type: 'record', fields: [{name, value}, ...] }
  if (obj.type === 'record' && Array.isArray(obj.fields)) {
    const result: Record<string, unknown> = {};
    for (const field of obj.fields as Array<{ name: string; value: unknown }>) {
      result[field.name] = normalizeValue(field.value);
    }
    return result;
  }

  return obj;
}

function normalizeValue(val: unknown): unknown {
  if (!val || typeof val !== 'object') return val;
  const v = val as Record<string, unknown>;
  if (v.type === 'literal') return v.value;
  if (v.type === 'list' && Array.isArray(v.items)) {
    return (v.items as unknown[]).map(normalizeValue);
  }
  if (v.type === 'record' && Array.isArray(v.fields)) {
    const result: Record<string, unknown> = {};
    for (const field of v.fields as Array<{ name: string; value: unknown }>) {
      result[field.name] = normalizeValue(field.value);
    }
    return result;
  }
  return val;
}

export const syncCompilerHandler: ConceptHandler = {
  async compile(input, storage) {
    const syncRef = input.sync as string;
    const rawAst = input.ast;
    const ast = normalizeAst(rawAst) as unknown as CompiledSync;

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

      // Variables bound in when-clause (concept/action wildcards + field patterns)
      for (const pattern of ast.when) {
        // Dynamic concept/action refs like ?concept/?action bind variables
        if (pattern.concept.startsWith('?')) boundVars.add(pattern.concept.slice(1));
        if (pattern.action.startsWith('?')) boundVars.add(pattern.action.slice(1));
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
        // filter entries (guard/any) reference variables but don't bind new ones
        if (entry.type === 'filter' && entry.expr) {
          const varRefs = entry.expr.match(/\?(\w+)/g);
          if (varRefs) {
            for (const ref of varRefs) {
              referencedVars.add(ref.slice(1)); // strip leading ?
            }
          }
        }
      }

      // Variables referenced in then-clause
      for (const action of ast.then) {
        // Dynamic concept refs like ?provider
        if (action.concept.startsWith('?')) {
          referencedVars.add(action.concept.slice(1));
        }
        // Dynamic action refs like ?action
        if (action.action.startsWith('?')) {
          referencedVars.add(action.action.slice(1));
        }
        for (const field of action.fields) {
          if (field.value.type === 'variable') {
            // For dot-access like meta.outputKind, the root variable is 'meta'
            const rootVar = field.value.name.split('.')[0];
            referencedVars.add(rootVar);
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
      const stack = err instanceof Error ? err.stack : undefined;
      return { variant: 'error', message, ...(stack ? { stack } : {}) };
    }
  },
};
