// Projection Concept Implementation (Clef Bind)
import type { ConceptHandler } from '@clef/runtime';

export const interfaceProjectionHandler: ConceptHandler = {
  async project(input, storage) {
    const manifest = input.manifest as string;
    const annotations = input.annotations as string;

    // Parse the concept manifest
    let manifestData: Record<string, unknown>;
    try {
      manifestData = JSON.parse(manifest);
    } catch {
      manifestData = { name: manifest };
    }

    // Parse the annotations
    let annotationData: Record<string, unknown>;
    try {
      annotationData = JSON.parse(annotations);
    } catch {
      return {
        variant: 'annotationError',
        concept: (manifestData.name as string) ?? 'unknown',
        errors: JSON.stringify(['Invalid annotation JSON']),
      };
    }

    const conceptName = (manifestData.name as string) ?? (manifestData.concept as string) ?? 'unknown';
    const suiteName = (manifestData.kit as string) ?? 'default';
    const kitVersion = (manifestData.version as string) ?? '1.0.0';

    // Extract traits from annotations
    const traits = (annotationData.traits as Array<{ name: string; scope: string; config: string }>) ?? [];

    // Extract resource mapping
    const resourceMapping = annotationData.resourceMapping as { path: string; idField: string; actions: string[] } | null ?? null;

    // Extract target overrides
    const targetOverrides = (annotationData.targetOverrides as Array<{ target: string; config: string }>) ?? [];

    // Compute shapes from manifest state definitions
    const shapes = (manifestData.shapes as Array<{ name: string; kind: string; resolved: string }>) ?? [];

    // Compute actions from manifest action definitions
    const actions = (manifestData.actions as string[]) ?? [];

    // Check for unresolved references
    if (annotationData.references) {
      const refs = annotationData.references as string[];
      const unresolvedRefs = refs.filter((r) => !actions.includes(r) && !shapes.some((s: { name: string }) => s.name === r));
      if (unresolvedRefs.length > 0) {
        return {
          variant: 'unresolvedReference',
          concept: conceptName,
          missing: JSON.stringify(unresolvedRefs),
        };
      }
    }

    // Check for trait conflicts
    const traitNames = traits.map((t) => t.name);
    if (traitNames.includes('paginated') && traitNames.includes('streaming')) {
      return {
        variant: 'traitConflict',
        concept: conceptName,
        trait1: 'paginated',
        trait2: 'streaming',
        reason: 'Cannot apply both @paginated and @streaming to the same action',
      };
    }

    // Compute cross-references
    const crossReferences = (manifestData.crossReferences as Array<{ from: string; to: string; relation: string }>) ?? [];

    const projectionId = `proj-${conceptName}-${Date.now()}`;

    await storage.put('projection', projectionId, {
      projectionId,
      concept: conceptName,
      suiteName,
      kitVersion,
      conceptManifest: manifest,
      traits: JSON.stringify(traits),
      resourceMapping: resourceMapping ? JSON.stringify(resourceMapping) : '',
      targetOverrides: JSON.stringify(targetOverrides),
      shapes: JSON.stringify(shapes),
      crossReferences: JSON.stringify(crossReferences),
      actionCount: actions.length,
      traitCount: traits.length,
      shapeCount: shapes.length,
    });

    return {
      variant: 'ok',
      projection: projectionId,
      shapes: shapes.length,
      actions: actions.length,
      traits: traits.length,
    };
  },

  async validate(input, storage) {
    const projection = input.projection as string;

    const existing = await storage.get('projection', projection);
    if (!existing) {
      return {
        variant: 'incompleteAnnotation',
        projection,
        missing: JSON.stringify(['Projection not found']),
      };
    }

    const warnings: string[] = [];

    // Check resource mapping completeness
    const resourceMapping = existing.resourceMapping as string;
    if (!resourceMapping || resourceMapping === '') {
      warnings.push('No resource mapping defined; REST target may need manual path configuration');
    }

    // Check for traits
    const traits = JSON.parse(existing.traits as string) as unknown[];
    if (traits.length === 0) {
      warnings.push('No traits bound; middleware will not be applied');
    }

    // Check for breaking changes against previous projection
    const concept = existing.concept as string;
    const allProjections = await storage.find('projection');
    const previousProjections = allProjections.filter(
      (p) => p.concept === concept && p.projectionId !== projection,
    );

    if (previousProjections.length > 0) {
      const prev = previousProjections[previousProjections.length - 1];
      const prevActions = prev.actionCount as number;
      const currentActions = existing.actionCount as number;

      if (currentActions < prevActions) {
        return {
          variant: 'breakingChange',
          projection,
          changes: JSON.stringify([`Action count decreased from ${prevActions} to ${currentActions}`]),
        };
      }
    }

    return {
      variant: 'ok',
      projection,
      warnings: JSON.stringify(warnings),
    };
  },

  async diff(input, storage) {
    const projection = input.projection as string;
    const previous = input.previous as string;

    const current = await storage.get('projection', projection);
    const prev = await storage.get('projection', previous);

    if (!current || !prev) {
      return { variant: 'incompatible', reason: 'One or both projections not found' };
    }

    if (current.concept !== prev.concept) {
      return {
        variant: 'incompatible',
        reason: `Projections are from different concepts: "${current.concept}" vs "${prev.concept}"`,
      };
    }

    // Compare shapes
    const currentShapes = JSON.parse(current.shapes as string) as Array<{ name: string }>;
    const prevShapes = JSON.parse(prev.shapes as string) as Array<{ name: string }>;

    const currentShapeNames = new Set(currentShapes.map((s) => s.name));
    const prevShapeNames = new Set(prevShapes.map((s) => s.name));

    const added = [...currentShapeNames].filter((n) => !prevShapeNames.has(n));
    const removed = [...prevShapeNames].filter((n) => !currentShapeNames.has(n));

    // Compare traits
    const currentTraits = JSON.parse(current.traits as string) as Array<{ name: string }>;
    const prevTraits = JSON.parse(prev.traits as string) as Array<{ name: string }>;
    const currentTraitNames = new Set(currentTraits.map((t) => t.name));
    const prevTraitNames = new Set(prevTraits.map((t) => t.name));

    const addedTraits = [...currentTraitNames].filter((n) => !prevTraitNames.has(n));
    const removedTraits = [...prevTraitNames].filter((n) => !currentTraitNames.has(n));

    const changed: string[] = [];
    if (addedTraits.length > 0) changed.push(`Traits added: ${addedTraits.join(', ')}`);
    if (removedTraits.length > 0) changed.push(`Traits removed: ${removedTraits.join(', ')}`);

    return {
      variant: 'ok',
      added: JSON.stringify(added),
      removed: JSON.stringify(removed),
      changed: JSON.stringify(changed),
    };
  },

  async inferResources(input, storage) {
    const projection = input.projection as string;

    const existing = await storage.get('projection', projection);
    if (!existing) {
      return {
        variant: 'ok',
        projection,
        resources: JSON.stringify([]),
      };
    }

    const concept = existing.concept as string;
    const manifestData = JSON.parse(existing.conceptManifest as string);
    const actions = (manifestData.actions as string[]) ?? [];

    // Derive REST resource path from concept name
    const resourcePath = `/${concept.toLowerCase()}s`;
    const resources: Array<{ method: string; path: string; action: string }> = [];

    for (const action of actions) {
      const name = action.toLowerCase();

      if (['create', 'add', 'insert', 'register', 'new'].some((v) => name.startsWith(v))) {
        resources.push({ method: 'POST', path: resourcePath, action });
      } else if (['delete', 'remove', 'drop'].some((v) => name.startsWith(v))) {
        resources.push({ method: 'DELETE', path: `${resourcePath}/:id`, action });
      } else if (['list', 'find', 'search', 'query'].some((v) => name.startsWith(v))) {
        resources.push({ method: 'GET', path: resourcePath, action });
      } else if (['get', 'read', 'fetch'].some((v) => name.startsWith(v))) {
        resources.push({ method: 'GET', path: `${resourcePath}/:id`, action });
      } else if (['update', 'edit', 'modify', 'patch'].some((v) => name.startsWith(v))) {
        resources.push({ method: 'PUT', path: `${resourcePath}/:id`, action });
      } else {
        // Non-CRUD action: POST to /resource/{id}/action-name
        resources.push({ method: 'POST', path: `${resourcePath}/:id/${action}`, action });
      }
    }

    // Update projection with inferred resource mapping
    await storage.put('projection', projection, {
      ...existing,
      resourceMapping: JSON.stringify({
        path: resourcePath,
        idField: 'id',
        actions: actions,
      }),
    });

    return {
      variant: 'ok',
      projection,
      resources: JSON.stringify(resources),
    };
  },
};
