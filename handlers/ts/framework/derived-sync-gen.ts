// ============================================================
// Clef Kernel - Annotation Sync Generator for Derived Concepts
// Auto-generates on_invoke annotation syncs from .derived surface
// action declarations.
// ============================================================

import type {
  DerivedAST,
  DerivedSurfaceAction,
  CompiledSync,
  FieldPattern,
  WhenPattern,
  ThenAction,
} from '../../../runtime/types.js';

// --- Annotation Sync Types ---

/**
 * An annotation sync is an auto-generated sync that fires on invocation
 * arrival (not completion) and attaches derivedContext tags rather than
 * producing new invocations.
 *
 * annotation: true marks this as an annotation sync (matched on_invoke)
 * derivedContextTag: the tag to attach to the flow
 */
export interface AnnotationSync extends CompiledSync {
  /** Marks this as an annotation sync (evaluated on invocation, not completion). */
  annotation: true;
  /** The derivedContext tag this sync attaches (e.g. "Trash/moveToTrash"). */
  derivedContextTag: string;
  /** If true, matches on derivedContext field instead of invocation input fields. */
  matchesDerivedContext: boolean;
  /** When matchesDerivedContext is true, the tag to match on. */
  derivedContextMatch?: string;
}

/**
 * Build a sync-to-derived-concept index: for each sync name,
 * which derived concepts claim it.
 */
export type SyncToDerivedIndex = Map<string, Set<string>>;

export function buildSyncToDerivedIndex(derivedConcepts: DerivedAST[]): SyncToDerivedIndex {
  const index: SyncToDerivedIndex = new Map();
  for (const dc of derivedConcepts) {
    for (const syncName of dc.syncs.required) {
      let set = index.get(syncName);
      if (!set) {
        set = new Set();
        index.set(syncName, set);
      }
      set.add(dc.name);
    }
  }
  return index;
}

/**
 * Generate annotation syncs from a derived concept's surface action declarations.
 *
 * For each surface action:
 * - If it matches on a Concept/action (type: 'action'), generates an on_invoke
 *   sync that matches invocation input fields and annotates with derivedContext.
 * - If it matches on derivedContext (type: 'derivedContext'), generates an
 *   on_invoke sync that matches the derivedContext tag on the flow.
 */
export function generateAnnotationSyncs(derived: DerivedAST): AnnotationSync[] {
  const syncs: AnnotationSync[] = [];

  for (const action of derived.surface.actions) {
    const tag = `${derived.name}/${action.name}`;
    const syncName = `${derived.name}_${action.name}_context`;

    if (action.matches.type === 'action') {
      const { concept, action: actionName, fields } = action.matches;

      // Build input field patterns from the match fields
      const inputFields: FieldPattern[] = [];
      if (fields) {
        for (const [fieldName, fieldValue] of Object.entries(fields)) {
          inputFields.push({
            name: fieldName,
            match: { type: 'literal', value: fieldValue },
          });
        }
      }

      const whenPattern: WhenPattern = {
        concept: `urn:clef/${concept}`,
        action: actionName,
        inputFields,
        outputFields: [],
      };

      syncs.push({
        name: syncName,
        annotations: ['eager'],
        annotation: true,
        derivedContextTag: tag,
        matchesDerivedContext: false,
        when: [whenPattern],
        where: [],
        then: [], // Annotation syncs don't produce invocations
      });
    } else if (action.matches.type === 'derivedContext') {
      // For derived-of-derived, match on derivedContext tag
      syncs.push({
        name: syncName,
        annotations: ['eager'],
        annotation: true,
        derivedContextTag: tag,
        matchesDerivedContext: true,
        derivedContextMatch: action.matches.tag,
        when: [], // No when pattern — matches on derivedContext
        where: [],
        then: [],
      });
    }
  }

  return syncs;
}

/**
 * Generate all annotation syncs from multiple derived concepts.
 */
export function generateAllAnnotationSyncs(derivedConcepts: DerivedAST[]): AnnotationSync[] {
  const allSyncs: AnnotationSync[] = [];
  for (const dc of derivedConcepts) {
    allSyncs.push(...generateAnnotationSyncs(dc));
  }
  return allSyncs;
}

/**
 * Evaluate annotation syncs against an invocation to determine which
 * derivedContext tags should be applied.
 *
 * Returns the set of derivedContext tags after fixed-point evaluation:
 * 1. Match annotation syncs against invocation input fields
 * 2. Match annotation syncs against newly added derivedContext tags
 * 3. Repeat until no new tags are added (fixed-point)
 */
export function evaluateAnnotationSyncs(
  annotationSyncs: AnnotationSync[],
  concept: string,
  action: string,
  input: Record<string, unknown>,
  existingContext: string[] = [],
): string[] {
  const tags = new Set<string>(existingContext);

  // Round 1: match on invocation input fields
  for (const sync of annotationSyncs) {
    if (sync.matchesDerivedContext) continue; // Skip context matchers in round 1

    // Check if this sync matches the invocation
    for (const pattern of sync.when) {
      if (pattern.concept !== concept || pattern.action !== action) continue;

      // Check all field patterns match
      let allMatch = true;
      for (const field of pattern.inputFields) {
        if (field.match.type === 'literal') {
          if (input[field.name] !== field.match.value) {
            allMatch = false;
            break;
          }
        }
        // Variables and wildcards always match on invocation
      }

      if (allMatch) {
        tags.add(sync.derivedContextTag);
      }
    }
  }

  // Round 2+: match on derivedContext tags until fixed-point
  let changed = true;
  while (changed) {
    changed = false;
    for (const sync of annotationSyncs) {
      if (!sync.matchesDerivedContext || !sync.derivedContextMatch) continue;
      if (tags.has(sync.derivedContextTag)) continue; // Already have this tag

      if (tags.has(sync.derivedContextMatch)) {
        tags.add(sync.derivedContextTag);
        changed = true;
      }
    }
  }

  return [...tags];
}

/**
 * Determine which derivedContext tags should propagate to a child invocation
 * produced by a given sync.
 *
 * Tags only propagate through syncs claimed by a derived concept.
 */
export function propagateDerivedContext(
  parentContext: string[],
  syncName: string,
  syncToDerivedIndex: SyncToDerivedIndex,
): string[] {
  if (parentContext.length === 0) return [];

  const claimingDerived = syncToDerivedIndex.get(syncName);
  if (!claimingDerived || claimingDerived.size === 0) return [];

  // Only propagate tags whose derived concept claims this sync
  return parentContext.filter(tag => {
    const derivedName = tag.split('/')[0];
    return claimingDerived.has(derivedName);
  });
}
