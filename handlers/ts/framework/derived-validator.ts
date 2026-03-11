// ============================================================
// Clef Kernel - Derived Concept Validator
// Validates .derived files for correctness: DAG property,
// surface pattern matching, sync references, type param unification.
// ============================================================

import type {
  DerivedAST,
  ConceptAST,
} from '../../../runtime/types.js';

// --- Validation Types ---

export interface ValidationMessage {
  severity: 'error' | 'warning' | 'info';
  message: string;
  derivedConcept: string;
}

export interface DerivedValidationResult {
  valid: boolean;
  messages: ValidationMessage[];
}

// --- Concept Lookup ---

/**
 * Resolver function that returns a ConceptAST by name,
 * or undefined if not found.
 */
export type ConceptResolver = (name: string) => ConceptAST | undefined;

/**
 * Resolver function that returns a DerivedAST by name,
 * or undefined if not found.
 */
export type DerivedResolver = (name: string) => DerivedAST | undefined;

/**
 * Resolver function that checks if a sync file exists by name.
 */
export type SyncResolver = (name: string) => boolean;

// --- DAG Validation ---

/**
 * Check that the composition graph is a DAG (no cycles in derived-of-derived).
 * Returns an error message if a cycle is detected, or null if valid.
 */
export function validateCompositionDAG(
  derivedConcepts: DerivedAST[],
): ValidationMessage[] {
  const messages: ValidationMessage[] = [];
  const byName = new Map<string, DerivedAST>();
  for (const dc of derivedConcepts) {
    byName.set(dc.name, dc);
  }

  // DFS cycle detection
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(name: string, path: string[]): boolean {
    if (inStack.has(name)) {
      const cycle = [...path.slice(path.indexOf(name)), name];
      messages.push({
        severity: 'error',
        message: `Cycle detected in derived concept composition: ${cycle.join(' → ')}`,
        derivedConcept: name,
      });
      return true;
    }
    if (visited.has(name)) return false;

    visited.add(name);
    inStack.add(name);

    const dc = byName.get(name);
    if (dc) {
      for (const composed of dc.composes) {
        if (composed.isDerived) {
          if (dfs(composed.name, [...path, name])) return true;
        }
      }
    }

    inStack.delete(name);
    return false;
  }

  for (const dc of derivedConcepts) {
    if (!visited.has(dc.name)) {
      dfs(dc.name, []);
    }
  }

  return messages;
}

/**
 * Validate a single derived concept.
 */
export function validateDerivedConcept(
  derived: DerivedAST,
  conceptResolver: ConceptResolver,
  derivedResolver: DerivedResolver,
  syncResolver: SyncResolver,
): ValidationMessage[] {
  const messages: ValidationMessage[] = [];
  const name = derived.name;

  // 1. Validate composes references exist
  for (const composed of derived.composes) {
    if (composed.isDerived) {
      const dc = derivedResolver(composed.name);
      if (!dc) {
        messages.push({
          severity: 'error',
          message: `Composed derived concept '${composed.name}' not found`,
          derivedConcept: name,
        });
      } else {
        // Check type param arity matches
        if (composed.typeParams.length !== dc.typeParams.length) {
          messages.push({
            severity: 'error',
            message: `Type parameter count mismatch for '${composed.name}': expected ${dc.typeParams.length}, got ${composed.typeParams.length}`,
            derivedConcept: name,
          });
        }
      }
    } else {
      const concept = conceptResolver(composed.name);
      if (!concept) {
        messages.push({
          severity: 'warning',
          message: `Composed concept '${composed.name}' not found (may be defined externally)`,
          derivedConcept: name,
        });
      } else {
        // Check type param arity matches
        if (composed.typeParams.length !== concept.typeParams.length) {
          messages.push({
            severity: 'error',
            message: `Type parameter count mismatch for '${composed.name}': expected ${concept.typeParams.length}, got ${composed.typeParams.length}`,
            derivedConcept: name,
          });
        }
      }
    }
  }

  // 2. Validate syncs exist (required + recommended)
  for (const syncName of derived.syncs.required) {
    if (!syncResolver(syncName)) {
      messages.push({
        severity: 'warning',
        message: `Required sync '${syncName}' not found (may be defined externally)`,
        derivedConcept: name,
      });
    }
  }
  for (const syncName of derived.syncs.recommended || []) {
    if (!syncResolver(syncName)) {
      messages.push({
        severity: 'info',
        message: `Recommended sync '${syncName}' not found (may be defined externally)`,
        derivedConcept: name,
      });
    }
  }

  // 3. Validate surface action matches
  const composedNames = new Set(derived.composes.map(c => c.name));

  for (const action of derived.surface.actions) {
    if (action.matches.type === 'action') {
      const matchConcept = action.matches.concept;
      const matchAction = action.matches.action;

      // Check that the concept is in the composes list
      if (!composedNames.has(matchConcept)) {
        // Check if it's a concept composed by a composed derived concept
        let found = false;
        for (const composed of derived.composes) {
          if (composed.isDerived) {
            const dc = derivedResolver(composed.name);
            if (dc && dc.composes.some(c => c.name === matchConcept)) {
              found = true;
              break;
            }
          }
        }
        if (!found) {
          messages.push({
            severity: 'warning',
            message: `Surface action '${action.name}' matches concept '${matchConcept}' which is not directly in the composes list`,
            derivedConcept: name,
          });
        }
      }

      // Check that the concept has the referenced action
      const concept = conceptResolver(matchConcept);
      if (concept) {
        const conceptAction = concept.actions.find(a => a.name === matchAction);
        if (!conceptAction) {
          messages.push({
            severity: 'error',
            message: `Surface action '${action.name}' matches '${matchConcept}/${matchAction}' but action not found on concept`,
            derivedConcept: name,
          });
        }
      }
    } else if (action.matches.type === 'entry') {
      // Entry format: matches Concept/action with triggers
      const matchConcept = action.matches.concept;
      const matchAction = action.matches.action;

      if (!composedNames.has(matchConcept)) {
        messages.push({
          severity: 'warning',
          message: `Surface action '${action.name}' entry matches concept '${matchConcept}' which is not in the composes list`,
          derivedConcept: name,
        });
      }

      const concept = conceptResolver(matchConcept);
      if (concept) {
        const conceptAction = concept.actions.find(a => a.name === matchAction);
        if (!conceptAction) {
          messages.push({
            severity: 'error',
            message: `Surface action '${action.name}' entry matches '${matchConcept}/${matchAction}' but action not found on concept`,
            derivedConcept: name,
          });
        }
      }

      // Validate triggers reference composed concepts/actions
      if (action.triggers) {
        for (const trigger of action.triggers) {
          if (!composedNames.has(trigger.concept)) {
            messages.push({
              severity: 'warning',
              message: `Surface action '${action.name}' trigger references concept '${trigger.concept}' not in composes list`,
              derivedConcept: name,
            });
          }
        }
      }
    } else if (action.matches.type === 'derivedContext') {
      // Validate the derivedContext tag references a real derived concept surface action
      const tag = action.matches.tag;
      const parts = tag.split('/');
      if (parts.length !== 2) {
        messages.push({
          severity: 'error',
          message: `Surface action '${action.name}' has invalid derivedContext tag format: '${tag}' (expected 'DerivedName/actionName')`,
          derivedConcept: name,
        });
      } else {
        const [dcName, dcAction] = parts;
        // Check if the referenced derived concept is in the composes list
        const composedDerived = derived.composes.find(c => c.isDerived && c.name === dcName);
        if (!composedDerived) {
          messages.push({
            severity: 'error',
            message: `Surface action '${action.name}' references derivedContext '${dcName}' which is not in the composes list as a derived concept`,
            derivedConcept: name,
          });
        } else {
          // Check if the derived concept has that surface action
          const dc = derivedResolver(dcName);
          if (dc && !dc.surface.actions.some(a => a.name === dcAction)) {
            messages.push({
              severity: 'error',
              message: `Surface action '${action.name}' references '${tag}' but '${dcName}' has no surface action '${dcAction}'`,
              derivedConcept: name,
            });
          }
        }
      }
    }
  }

  // 4. Validate surface queries reference composed concepts
  for (const query of derived.surface.queries) {
    if (!composedNames.has(query.target.concept)) {
      messages.push({
        severity: 'warning',
        message: `Surface query '${query.name}' targets concept '${query.target.concept}' which is not in the composes list`,
        derivedConcept: name,
      });
    }
  }

  // 5. Validate type parameters are used consistently
  const declaredParams = new Set(derived.typeParams);
  for (const composed of derived.composes) {
    for (const tp of composed.typeParams) {
      if (!declaredParams.has(tp)) {
        messages.push({
          severity: 'error',
          message: `Type parameter '${tp}' used in composes entry '${composed.name}' but not declared on derived concept`,
          derivedConcept: name,
        });
      }
    }
  }

  return messages;
}

/**
 * Validate all derived concepts: individual validation + DAG check.
 */
export function validateAllDerivedConcepts(
  derivedConcepts: DerivedAST[],
  conceptResolver: ConceptResolver,
  syncResolver: SyncResolver,
): DerivedValidationResult {
  const messages: ValidationMessage[] = [];

  // Build derived resolver from the list
  const derivedMap = new Map<string, DerivedAST>();
  for (const dc of derivedConcepts) {
    derivedMap.set(dc.name, dc);
  }
  const derivedResolver: DerivedResolver = (n) => derivedMap.get(n);

  // DAG validation
  messages.push(...validateCompositionDAG(derivedConcepts));

  // Individual validation
  for (const dc of derivedConcepts) {
    messages.push(...validateDerivedConcept(dc, conceptResolver, derivedResolver, syncResolver));
  }

  return {
    valid: messages.every(m => m.severity !== 'error'),
    messages,
  };
}
