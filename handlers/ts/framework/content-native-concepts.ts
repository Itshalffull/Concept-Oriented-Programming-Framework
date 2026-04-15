import type { ConceptManifest } from '../../../runtime/types';

/**
 * Content-native concept enumeration helper (CNB-2).
 *
 * Convention: a concept is considered "content-native" when a registered
 * Schema exists whose name equals the concept name (case-sensitive). For
 * example, the `Canvas` concept is content-native when a `Canvas` schema
 * is registered in the project.
 *
 * Bind target generators (REST, GraphQL, CLI, MCP, skills) consult this
 * helper to rewrite the CRUD subset of a content-native concept's actions
 * to ContentNode operations:
 *
 *   create   -> ContentNode/createWithSchema
 *   get      -> ContentNode/get
 *   update   -> ContentNode/update
 *   remove / -> ContentNode/remove
 *   delete
 *   list     -> ContentNode/listBySchema
 *
 * Non-CRUD actions (e.g. `Workflow/addTransition`, `Canvas/connectNodes`)
 * stay as direct concept calls — only the CRUD surface is rewritten.
 */

/**
 * Given a parsed project state, return the set of concept names that are
 * content-native (have a Schema with matching name).
 */
export function listContentNativeConcepts(
  concepts: ConceptManifest[],
  schemas: Array<{ schema: string }>,
): Set<string> {
  const schemaNames = new Set(schemas.map((s) => s.schema));
  const result = new Set<string>();
  for (const c of concepts) {
    if (schemaNames.has(c.name)) result.add(c.name);
  }
  return result;
}

/**
 * Check if a specific concept is content-native.
 */
export function isContentNative(
  conceptName: string,
  schemas: Array<{ schema: string }>,
): boolean {
  for (const s of schemas) {
    if (s.schema === conceptName) return true;
  }
  return false;
}
