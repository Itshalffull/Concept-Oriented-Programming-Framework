// Annotation Concept Implementation (Clef Bind)
import type { ConceptHandler } from '@clef/kernel';

export const annotationHandler: ConceptHandler = {
  async annotate(input, storage) {
    const concept = input.concept as string;
    const scope = input.scope as string;
    const metadata = input.metadata as string;

    // Parse metadata JSON
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(metadata);
    } catch {
      return { variant: 'invalidScope', scope };
    }

    // Validate scope: must be "concept" or a non-empty action name
    if (!scope || scope.trim() === '') {
      return { variant: 'invalidScope', scope };
    }

    // Count the metadata fields provided
    const fieldCount = Object.keys(parsed).length;

    // Build annotation identifier from concept + scope
    const annotationId = `${concept}::${scope}`;

    // Retrieve existing annotation or start fresh
    const existing = await storage.get('annotation', annotationId);

    const examples = parsed.examples ?? (existing?.examples ? JSON.parse(existing.examples as string) : []);
    const references = parsed.references ?? (existing?.references ? JSON.parse(existing.references as string) : []);
    const toolPermissions = parsed.toolPermissions ?? (existing?.toolPermissions ? JSON.parse(existing.toolPermissions as string) : []);
    const argumentTemplate = parsed.argumentTemplate ?? (existing?.argumentTemplate as string | undefined) ?? null;
    const relatedItems = parsed.relatedItems ?? (existing?.relatedItems ? JSON.parse(existing.relatedItems as string) : []);

    await storage.put('annotation', annotationId, {
      annotationId,
      targetConcept: concept,
      scope,
      examples: JSON.stringify(examples),
      references: JSON.stringify(references),
      toolPermissions: JSON.stringify(toolPermissions),
      argumentTemplate: argumentTemplate != null ? String(argumentTemplate) : '',
      relatedItems: JSON.stringify(relatedItems),
    });

    return { variant: 'ok', annotation: annotationId, fieldCount };
  },

  async resolve(input, storage) {
    const concept = input.concept as string;

    const allAnnotations = await storage.find('annotation');
    const matching = allAnnotations.filter(
      (a) => a.targetConcept === concept,
    );

    if (matching.length === 0) {
      return { variant: 'notFound', concept };
    }

    // Sort by scope: "concept" first, then alphabetical action names
    matching.sort((a, b) => {
      if (a.scope === 'concept') return -1;
      if (b.scope === 'concept') return 1;
      return (a.scope as string).localeCompare(b.scope as string);
    });

    const annotations = matching.map((a) =>
      JSON.stringify({
        targetConcept: a.targetConcept,
        scope: a.scope,
        examples: JSON.parse(a.examples as string),
        references: JSON.parse(a.references as string),
        toolPermissions: JSON.parse(a.toolPermissions as string),
        argumentTemplate: a.argumentTemplate || null,
        relatedItems: JSON.parse(a.relatedItems as string),
      }),
    );

    return { variant: 'ok', annotations: JSON.stringify(annotations) };
  },
};
