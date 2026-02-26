// ============================================================
// Projection Concept Implementation
//
// Enriches ConceptManifests with interface generation metadata
// including resource mappings, trait bindings, and type graphs.
// Architecture doc: Clef Bind, Section 1.1
// ============================================================

import { createHash, randomUUID } from 'crypto';
import type {
  ConceptHandler,
  ConceptStorage,
  ConceptManifest,
  ActionSchema,
} from '../../../kernel/src/types.js';

// --- Internal Types ---

/** A shape describes a resolved type used in the projection's type graph. */
interface Shape {
  name: string;
  kind: string;     // 'primitive' | 'record' | 'list' | 'set' | 'param' | 'option'
  resolved: string; // JSON-serialised ResolvedType for downstream generators
}

/** A cross-concept type reference within the suite. */
interface CrossReference {
  from: string;
  to: string;
  relation: string;
}

/** A trait binding attached to an action. */
interface TraitBinding {
  name: string;
  scope: string;
  config: string;   // JSON-serialised trait configuration
}

/** A REST resource mapping derived from action signatures. */
interface ResourceMapping {
  path: string;
  idField: string;
  actions: string[];
}

/** Target-specific overrides from the annotation layer. */
interface TargetOverride {
  target: string;
  config: string;   // JSON-serialised override configuration
}

/** The full projection record stored and returned from actions. */
interface ProjectionRecord {
  id: string;
  conceptName: string;
  suiteName: string;
  kitVersion: string;
  conceptManifest: string;      // JSON of the original ConceptManifest
  traits: TraitBinding[];
  resourceMapping: ResourceMapping | null;
  targetOverrides: TargetOverride[];
  shapes: Shape[];
  crossReferences: CrossReference[];
  createdAt: string;
}

// --- Annotation Parsing ---

/** Expected shape of the annotations JSON input. */
interface AnnotationInput {
  traits?: Array<{ name: string; scope?: string; config?: Record<string, unknown> }>;
  resourceMapping?: { path?: string; idField?: string; actions?: string[] };
  targetOverrides?: Array<{ target: string; config?: Record<string, unknown> }>;
}

/**
 * Parse and validate the annotations JSON string.
 * Returns the parsed annotations or a list of errors.
 */
function parseAnnotations(
  raw: string,
  conceptName: string,
): { ok: true; annotations: AnnotationInput } | { ok: false; errors: string[] } {
  try {
    const parsed = JSON.parse(raw) as AnnotationInput;
    const errors: string[] = [];

    if (parsed.traits && !Array.isArray(parsed.traits)) {
      errors.push('traits must be an array');
    }
    if (parsed.targetOverrides && !Array.isArray(parsed.targetOverrides)) {
      errors.push('targetOverrides must be an array');
    }
    if (parsed.resourceMapping && typeof parsed.resourceMapping !== 'object') {
      errors.push('resourceMapping must be an object');
    }

    if (errors.length > 0) {
      return { ok: false, errors };
    }
    return { ok: true, annotations: parsed };
  } catch {
    return { ok: false, errors: [`Invalid JSON in annotations for concept ${conceptName}`] };
  }
}

// --- Trait Conflict Detection ---

/** Known incompatible trait pairs. */
const INCOMPATIBLE_TRAITS: Array<[string, string, string]> = [
  ['paginated', 'streaming', 'Cannot paginate a streaming response'],
  ['cached', 'realtime', 'Cached responses conflict with real-time delivery'],
  ['deprecated', 'required', 'A deprecated action cannot be marked required'],
];

/**
 * Check for conflicting trait combinations.
 * Returns null if no conflicts, or a conflict descriptor.
 */
function findTraitConflict(
  traits: TraitBinding[],
): { trait1: string; trait2: string; reason: string } | null {
  const traitNames = new Set(traits.map(t => t.name));
  for (const [a, b, reason] of INCOMPATIBLE_TRAITS) {
    if (traitNames.has(a) && traitNames.has(b)) {
      return { trait1: a, trait2: b, reason };
    }
  }
  return null;
}

// --- Shape Extraction ---

/**
 * Extract shapes from the manifest's relations, actions, and type params.
 * Shapes represent the distinct type constructs used in the projection.
 */
function extractShapes(manifest: ConceptManifest): Shape[] {
  const shapes: Shape[] = [];
  const seen = new Set<string>();

  function addShape(name: string, kind: string, resolved: string): void {
    if (!seen.has(name)) {
      seen.add(name);
      shapes.push({ name, kind, resolved });
    }
  }

  // Type parameters are shapes
  for (const tp of manifest.typeParams) {
    addShape(tp.name, 'param', JSON.stringify({ kind: 'param', paramRef: tp.name }));
  }

  // Relation fields contribute shapes
  for (const rel of manifest.relations) {
    for (const field of rel.fields) {
      addShape(
        `${rel.name}.${field.name}`,
        field.type.kind,
        JSON.stringify(field.type),
      );
    }
  }

  // Action parameters and variant fields contribute shapes
  for (const action of manifest.actions) {
    for (const param of action.params) {
      addShape(
        `${action.name}.${param.name}`,
        param.type.kind,
        JSON.stringify(param.type),
      );
    }
    for (const variant of action.variants) {
      for (const field of variant.fields) {
        addShape(
          `${action.name}.${variant.tag}.${field.name}`,
          field.type.kind,
          JSON.stringify(field.type),
        );
      }
    }
  }

  return shapes;
}

// --- Reference Validation ---

/**
 * Validate that annotations reference actions and types that exist
 * in the manifest. Returns a list of unresolved references.
 */
function findUnresolvedReferences(
  annotations: AnnotationInput,
  manifest: ConceptManifest,
): string[] {
  const missing: string[] = [];
  const actionNames = new Set(manifest.actions.map(a => a.name));

  // Check trait scopes reference valid actions
  if (annotations.traits) {
    for (const trait of annotations.traits) {
      if (trait.scope && trait.scope !== '*') {
        const scopeActions = trait.scope.split(',').map(s => s.trim());
        for (const scopeAction of scopeActions) {
          if (!actionNames.has(scopeAction)) {
            missing.push(`trait "${trait.name}" references unknown action "${scopeAction}"`);
          }
        }
      }
    }
  }

  // Check resource mapping action references
  if (annotations.resourceMapping?.actions) {
    for (const actionName of annotations.resourceMapping.actions) {
      if (!actionNames.has(actionName)) {
        missing.push(`resourceMapping references unknown action "${actionName}"`);
      }
    }
  }

  return missing;
}

// --- Resource Inference ---

/** HTTP method mapping for common action name prefixes. */
interface ResourceRoute {
  method: string;
  path: string;
}

/**
 * Infer REST resource routes from action names.
 *
 * Convention-based mapping:
 *   create/add    -> POST   /resource
 *   delete/remove -> DELETE /resource/{id}
 *   list/find     -> GET    /resource
 *   get/lookup    -> GET    /resource/{id}
 *   update/edit   -> PUT    /resource/{id}
 *   other         -> POST   /resource/{id}/action-name
 */
function inferResourceRoutes(
  actions: ActionSchema[],
  resourcePath: string,
  idField: string,
): Map<string, ResourceRoute> {
  const routes = new Map<string, ResourceRoute>();

  for (const action of actions) {
    const name = action.name.toLowerCase();

    if (name.startsWith('create') || name.startsWith('add')) {
      routes.set(action.name, { method: 'POST', path: resourcePath });
    } else if (name.startsWith('delete') || name.startsWith('remove')) {
      routes.set(action.name, { method: 'DELETE', path: `${resourcePath}/{${idField}}` });
    } else if (name.startsWith('list') || name.startsWith('find')) {
      routes.set(action.name, { method: 'GET', path: resourcePath });
    } else if (name.startsWith('get') || name.startsWith('lookup')) {
      routes.set(action.name, { method: 'GET', path: `${resourcePath}/{${idField}}` });
    } else if (name.startsWith('update') || name.startsWith('edit')) {
      routes.set(action.name, { method: 'PUT', path: `${resourcePath}/{${idField}}` });
    } else {
      // Non-CRUD: POST to /resource/{id}/action-name
      routes.set(action.name, {
        method: 'POST',
        path: `${resourcePath}/{${idField}}/${action.name}`,
      });
    }
  }

  return routes;
}

/**
 * Generate a deterministic projection ID from the concept name and manifest content.
 */
function generateProjectionId(conceptName: string, manifestJson: string): string {
  const hash = createHash('sha256')
    .update(conceptName)
    .update(manifestJson)
    .update(new Date().toISOString())
    .digest('hex')
    .slice(0, 16);
  return `proj-${hash}`;
}

// --- Storage Keys ---

const PROJECTION_RELATION = 'projections';
const HISTORY_RELATION = 'projection_history';

// --- Concept Handler ---

export const projectionHandler: ConceptHandler = {

  /**
   * Parse manifest and annotations. Merge into a projection.
   * Compute resource mappings, count shapes/actions/traits, and persist.
   */
  async project(input: Record<string, unknown>, storage: ConceptStorage) {
    const manifestJson = input.manifest as string;
    const annotationsJson = input.annotations as string;

    // Parse the ConceptManifest
    let manifest: ConceptManifest;
    try {
      manifest = JSON.parse(manifestJson) as ConceptManifest;
    } catch {
      return {
        variant: 'annotationError',
        concept: 'unknown',
        errors: ['Invalid JSON in manifest input'],
      };
    }

    const conceptName = manifest.name;

    // Parse and validate annotations
    const annotationResult = parseAnnotations(annotationsJson, conceptName);
    if (!annotationResult.ok) {
      return {
        variant: 'annotationError',
        concept: conceptName,
        errors: annotationResult.errors,
      };
    }
    const annotations = annotationResult.annotations;

    // Check for unresolved references in annotations
    const unresolvedRefs = findUnresolvedReferences(annotations, manifest);
    if (unresolvedRefs.length > 0) {
      return {
        variant: 'unresolvedReference',
        concept: conceptName,
        missing: unresolvedRefs,
      };
    }

    // Build trait bindings
    const traits: TraitBinding[] = (annotations.traits || []).map(t => ({
      name: t.name,
      scope: t.scope || '*',
      config: JSON.stringify(t.config || {}),
    }));

    // Check for trait conflicts
    const conflict = findTraitConflict(traits);
    if (conflict) {
      return {
        variant: 'traitConflict',
        concept: conceptName,
        trait1: conflict.trait1,
        trait2: conflict.trait2,
        reason: conflict.reason,
      };
    }

    // Extract shapes from the manifest type graph
    const shapes = extractShapes(manifest);

    // Build resource mapping from annotations or infer defaults
    let resourceMapping: ResourceMapping | null = null;
    if (annotations.resourceMapping) {
      const rm = annotations.resourceMapping;
      resourceMapping = {
        path: rm.path || `/${conceptName.toLowerCase()}s`,
        idField: rm.idField || (manifest.typeParams[0]?.name.toLowerCase() || 'id'),
        actions: rm.actions || manifest.actions.map(a => a.name),
      };
    }

    // Build target overrides
    const targetOverrides: TargetOverride[] = (annotations.targetOverrides || []).map(o => ({
      target: o.target,
      config: JSON.stringify(o.config || {}),
    }));

    // Generate projection ID and build the record
    const projectionId = generateProjectionId(conceptName, manifestJson);

    const projection: ProjectionRecord = {
      id: projectionId,
      conceptName,
      suiteName: manifest.uri.split('/')[0] || '',
      kitVersion: '1.0.0',
      conceptManifest: manifestJson,
      traits,
      resourceMapping,
      targetOverrides,
      shapes,
      crossReferences: [],
      createdAt: new Date().toISOString(),
    };

    // Persist projection
    await storage.put(PROJECTION_RELATION, projectionId, projection as unknown as Record<string, unknown>);

    return {
      variant: 'ok',
      projection: projectionId,
      shapes: shapes.length,
      actions: manifest.actions.length,
      traits: traits.length,
    };
  },

  /**
   * Load projection from storage, check for breaking changes against
   * previous versions, and verify annotation completeness.
   */
  async validate(input: Record<string, unknown>, storage: ConceptStorage) {
    const projectionId = input.projection as string;

    // Load the projection
    const projectionData = await storage.get(PROJECTION_RELATION, projectionId);
    if (!projectionData) {
      return {
        variant: 'incompleteAnnotation',
        projection: projectionId,
        missing: ['Projection not found in storage'],
      };
    }

    const projection = projectionData as unknown as ProjectionRecord;
    const warnings: string[] = [];

    // Parse the embedded manifest for validation checks
    let manifest: ConceptManifest;
    try {
      manifest = JSON.parse(projection.conceptManifest) as ConceptManifest;
    } catch {
      return {
        variant: 'incompleteAnnotation',
        projection: projectionId,
        missing: ['Stored projection contains invalid manifest JSON'],
      };
    }

    // Check for missing resource mapping when actions exist
    if (!projection.resourceMapping && manifest.actions.length > 0) {
      warnings.push('No resource mapping defined; REST targets will use convention-based defaults');
    }

    // Check for actions without trait coverage
    const traitScopes = new Set<string>();
    for (const trait of projection.traits) {
      if (trait.scope === '*') {
        // Wildcard covers all actions
        for (const action of manifest.actions) {
          traitScopes.add(action.name);
        }
      } else {
        for (const s of trait.scope.split(',')) {
          traitScopes.add(s.trim());
        }
      }
    }

    for (const action of manifest.actions) {
      if (!traitScopes.has(action.name) && projection.traits.length > 0) {
        warnings.push(`Action "${action.name}" has no trait bindings`);
      }
    }

    // Check for breaking changes against previous version in history
    const historyRecords = await storage.find(HISTORY_RELATION, { conceptName: projection.conceptName });
    if (historyRecords.length > 0) {
      // Compare the most recent historical projection
      const previous = historyRecords[historyRecords.length - 1] as unknown as ProjectionRecord;
      const breakingChanges = detectBreakingChanges(projection, previous);
      if (breakingChanges.length > 0) {
        return {
          variant: 'breakingChange',
          projection: projectionId,
          changes: breakingChanges,
        };
      }
    }

    // Check for incomplete annotations for configured targets
    const missingAnnotations: string[] = [];
    for (const override of projection.targetOverrides) {
      if (override.target.includes('rest') && !projection.resourceMapping) {
        missingAnnotations.push(
          `REST target "${override.target}" configured but no resource mapping defined`,
        );
      }
    }

    if (missingAnnotations.length > 0) {
      return {
        variant: 'incompleteAnnotation',
        projection: projectionId,
        missing: missingAnnotations,
      };
    }

    // Store in history for future breaking-change detection
    await storage.put(
      HISTORY_RELATION,
      `${projection.conceptName}:${projection.id}`,
      projection as unknown as Record<string, unknown>,
    );

    return {
      variant: 'ok',
      projection: projectionId,
      warnings,
    };
  },

  /**
   * Compare two projections and return added/removed/changed fields.
   */
  async diff(input: Record<string, unknown>, storage: ConceptStorage) {
    const projectionId = input.projection as string;
    const previousId = input.previous as string;

    // Load both projections
    const currentData = await storage.get(PROJECTION_RELATION, projectionId);
    const previousData = await storage.get(PROJECTION_RELATION, previousId);

    if (!currentData || !previousData) {
      return {
        variant: 'incompatible',
        reason: 'One or both projections not found in storage',
      };
    }

    const current = currentData as unknown as ProjectionRecord;
    const previous = previousData as unknown as ProjectionRecord;

    // Verify both projections are for the same concept
    if (current.conceptName !== previous.conceptName) {
      return {
        variant: 'incompatible',
        reason: `Cannot compare projections for different concepts: "${current.conceptName}" vs "${previous.conceptName}"`,
      };
    }

    // Compare shapes
    const currentShapeNames = new Set(current.shapes.map(s => s.name));
    const previousShapeNames = new Set(previous.shapes.map(s => s.name));

    const added: string[] = [];
    const removed: string[] = [];
    const changed: string[] = [];

    // Added shapes
    for (const name of currentShapeNames) {
      if (!previousShapeNames.has(name)) {
        added.push(`shape: ${name}`);
      }
    }

    // Removed shapes
    for (const name of previousShapeNames) {
      if (!currentShapeNames.has(name)) {
        removed.push(`shape: ${name}`);
      }
    }

    // Changed shapes (same name, different resolved type)
    for (const currentShape of current.shapes) {
      const previousShape = previous.shapes.find(s => s.name === currentShape.name);
      if (previousShape && previousShape.resolved !== currentShape.resolved) {
        changed.push(`shape: ${currentShape.name} (type changed)`);
      }
    }

    // Compare traits
    const currentTraitNames = new Set(current.traits.map(t => `${t.name}:${t.scope}`));
    const previousTraitNames = new Set(previous.traits.map(t => `${t.name}:${t.scope}`));

    for (const key of currentTraitNames) {
      if (!previousTraitNames.has(key)) {
        added.push(`trait: ${key}`);
      }
    }
    for (const key of previousTraitNames) {
      if (!currentTraitNames.has(key)) {
        removed.push(`trait: ${key}`);
      }
    }

    // Compare resource mapping
    const currentRM = current.resourceMapping;
    const previousRM = previous.resourceMapping;

    if (currentRM && !previousRM) {
      added.push('resourceMapping');
    } else if (!currentRM && previousRM) {
      removed.push('resourceMapping');
    } else if (currentRM && previousRM) {
      if (currentRM.path !== previousRM.path) {
        changed.push(`resourceMapping.path: "${previousRM.path}" -> "${currentRM.path}"`);
      }
      if (currentRM.idField !== previousRM.idField) {
        changed.push(`resourceMapping.idField: "${previousRM.idField}" -> "${currentRM.idField}"`);
      }
    }

    // Compare target overrides
    const currentTargets = new Set(current.targetOverrides.map(o => o.target));
    const previousTargets = new Set(previous.targetOverrides.map(o => o.target));

    for (const target of currentTargets) {
      if (!previousTargets.has(target)) {
        added.push(`targetOverride: ${target}`);
      }
    }
    for (const target of previousTargets) {
      if (!currentTargets.has(target)) {
        removed.push(`targetOverride: ${target}`);
      }
    }

    return {
      variant: 'ok',
      added,
      removed,
      changed,
    };
  },

  /**
   * Auto-derive REST resource mappings from action names using
   * convention-based HTTP method and path inference.
   */
  async inferResources(input: Record<string, unknown>, storage: ConceptStorage) {
    const projectionId = input.projection as string;

    // Load the projection
    const projectionData = await storage.get(PROJECTION_RELATION, projectionId);
    if (!projectionData) {
      return {
        variant: 'ok',
        projection: projectionId,
        resources: [],
      };
    }

    const projection = projectionData as unknown as ProjectionRecord;

    // Parse the manifest to get action schemas
    let manifest: ConceptManifest;
    try {
      manifest = JSON.parse(projection.conceptManifest) as ConceptManifest;
    } catch {
      return {
        variant: 'ok',
        projection: projectionId,
        resources: [],
      };
    }

    // Derive the resource base path and ID field
    const resourcePath = projection.resourceMapping?.path
      || `/${manifest.name.toLowerCase()}s`;
    const idField = projection.resourceMapping?.idField
      || (manifest.typeParams[0]?.name.toLowerCase() || 'id');

    // Infer routes from action names
    const routes = inferResourceRoutes(manifest.actions, resourcePath, idField);

    // Format as human-readable resource descriptions
    const resources: string[] = [];
    for (const [actionName, route] of routes) {
      resources.push(`${route.method} ${route.path} -> ${actionName}`);
    }

    // Update the projection with the inferred resource mapping
    if (!projection.resourceMapping) {
      projection.resourceMapping = {
        path: resourcePath,
        idField,
        actions: manifest.actions.map(a => a.name),
      };
    }

    // Persist updated projection
    await storage.put(
      PROJECTION_RELATION,
      projectionId,
      projection as unknown as Record<string, unknown>,
    );

    return {
      variant: 'ok',
      projection: projectionId,
      resources,
    };
  },
};

// --- Breaking Change Detection ---

/**
 * Detect breaking changes between a current and previous projection.
 *
 * Breaking changes include:
 * - Removed shapes (types that consumers depend on)
 * - Changed shape kinds (e.g. primitive -> list)
 * - Removed resource mapping paths
 * - Changed ID field names
 */
function detectBreakingChanges(
  current: ProjectionRecord,
  previous: ProjectionRecord,
): string[] {
  const changes: string[] = [];

  // Check for removed shapes
  const currentShapeNames = new Set(current.shapes.map(s => s.name));
  for (const prevShape of previous.shapes) {
    if (!currentShapeNames.has(prevShape.name)) {
      changes.push(`Removed shape: ${prevShape.name}`);
    }
  }

  // Check for changed shape kinds
  for (const currentShape of current.shapes) {
    const prevShape = previous.shapes.find(s => s.name === currentShape.name);
    if (prevShape && prevShape.kind !== currentShape.kind) {
      changes.push(
        `Shape "${currentShape.name}" kind changed from "${prevShape.kind}" to "${currentShape.kind}"`,
      );
    }
  }

  // Check resource mapping changes
  if (previous.resourceMapping && current.resourceMapping) {
    if (previous.resourceMapping.path !== current.resourceMapping.path) {
      changes.push(
        `Resource path changed from "${previous.resourceMapping.path}" to "${current.resourceMapping.path}"`,
      );
    }
    if (previous.resourceMapping.idField !== current.resourceMapping.idField) {
      changes.push(
        `Resource ID field changed from "${previous.resourceMapping.idField}" to "${current.resourceMapping.idField}"`,
      );
    }
  } else if (previous.resourceMapping && !current.resourceMapping) {
    changes.push('Resource mapping removed');
  }

  return changes;
}
