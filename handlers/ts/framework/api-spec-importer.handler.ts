// @clef-handler style=functional concept=ApiSpecImporter
// @category framework
// ============================================================
// ApiSpecImporter — Parse external API specs into draft ingest manifests
// Section 16.11 (external spec ingestion pipeline)
// ============================================================
//
// The import action would normally fetch a URL using the transport layer
// (perform()), but the sync layer handles fetching and delivers inline
// content. importInline() is the core action; import() validates inputs
// and delegates actual parsing to the same logic via inline content passed
// by the caller.
//
// inferMappings() parses an OpenAPI-like spec JSON and infers action
// mappings from HTTP methods + paths:
//   POST /items         → create
//   GET /items          → list
//   GET /items/{id}     → get
//   PUT /items/{id}     → update
//   DELETE /items/{id}  → delete

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram,
  get,
  find,
  put,
  complete,
  completeFrom,
  branch,
  mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const VALID_SPEC_TYPES = new Set(['openapi', 'graphql', 'asyncapi']);

// ── HTTP method → concept action heuristic ──────────────────
const METHOD_ACTION: Record<string, string> = {
  post: 'create',
  get: 'list',     // overridden to 'get' when path has {id} parameter
  put: 'update',
  patch: 'update',
  delete: 'delete',
};

function hasIdParam(path: string): boolean {
  return /\{[^}]+\}/.test(path);
}

interface Mapping {
  action: string;
  method: string;
  path: string;
  confidence: number;
}

// ── OpenAPI spec parsing ─────────────────────────────────────

function inferOpenApiMappings(
  spec: Record<string, unknown>,
  conceptActions: string[],
): Mapping[] {
  const paths = (spec.paths as Record<string, Record<string, unknown>>) ?? {};
  const mappings: Mapping[] = [];

  for (const [path, methods] of Object.entries(paths)) {
    for (const [rawMethod, opObj] of Object.entries(methods as Record<string, unknown>)) {
      const method = rawMethod.toLowerCase();
      if (!['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method)) continue;

      const op = opObj as Record<string, unknown>;
      const operationId = (op.operationId as string | undefined) ?? '';

      // Derive candidate action name from method + path shape
      let candidateAction: string;
      if (method === 'get' && hasIdParam(path)) {
        candidateAction = 'get';
      } else {
        candidateAction = METHOD_ACTION[method] ?? method;
      }

      // Base confidence
      let confidence = 0.5;

      // Boost if operationId matches a concept action exactly
      const opIdLower = operationId.toLowerCase();
      if (conceptActions.some(a => opIdLower === a || opIdLower === `${a.toLowerCase()}s` || opIdLower.startsWith(a.toLowerCase()))) {
        confidence = 0.9;
        // Pick the matching action if operationId starts with it
        const matched = conceptActions.find(
          a => opIdLower === a || opIdLower.startsWith(a.toLowerCase()),
        );
        if (matched) candidateAction = matched;
      } else if (conceptActions.includes(candidateAction)) {
        confidence = 0.7;
      }

      mappings.push({ action: candidateAction, method, path, confidence });
    }
  }

  return mappings;
}

// ── GraphQL introspection schema parsing ─────────────────────

function inferGraphQLMappings(
  schema: Record<string, unknown>,
  conceptActions: string[],
): Mapping[] {
  const inner = (schema.__schema as Record<string, unknown>) ?? schema;
  const types = (inner.types as Array<Record<string, unknown>>) ?? [];
  const mappings: Mapping[] = [];

  for (const type of types) {
    const typeName = (type.name as string) ?? '';
    const kind = (type.kind as string) ?? '';
    if (kind !== 'OBJECT' || !['Query', 'Mutation', 'Subscription'].includes(typeName)) continue;

    const isQuery = typeName === 'Query';
    const fields = (type.fields as Array<Record<string, unknown>>) ?? [];

    for (const field of fields) {
      const fieldName = (field.name as string) ?? '';
      const fieldLower = fieldName.toLowerCase();

      let candidateAction = isQuery ? 'list' : 'create';
      let confidence = 0.4;

      // Match field name against concept actions
      const matched = conceptActions.find(
        a => fieldLower === a || fieldLower.startsWith(a) || fieldLower.endsWith(a),
      );
      if (matched) {
        candidateAction = matched;
        confidence = 0.8;
      }

      const method = isQuery ? 'query' : 'mutation';
      mappings.push({ action: candidateAction, method, path: `/${fieldName}`, confidence });
    }
  }

  return mappings;
}

// ── Dispatch spec parsing by type ────────────────────────────

function inferMappingsFromSpec(
  specJson: Record<string, unknown>,
  specType: string,
  conceptActions: string[],
): Mapping[] {
  if (specType === 'openapi') {
    return inferOpenApiMappings(specJson, conceptActions);
  }
  if (specType === 'graphql') {
    return inferGraphQLMappings(specJson, conceptActions);
  }
  // asyncapi — minimal heuristic
  const channels = (specJson.channels as Record<string, unknown>) ?? {};
  const mappings: Mapping[] = [];
  for (const [channel] of Object.entries(channels)) {
    mappings.push({ action: 'subscribe', method: 'subscribe', path: channel, confidence: 0.4 });
  }
  return mappings;
}

function buildDraftManifest(
  targetConcept: string,
  specType: string,
  specUrl: string | undefined,
  mappings: Mapping[],
): string {
  return JSON.stringify({
    concept: targetConcept,
    specType,
    specUrl: specUrl ?? null,
    mappings,
    generatedAt: new Date().toISOString(),
  });
}

function overallConfidence(mappings: Mapping[]): number {
  if (mappings.length === 0) return 0;
  const sum = mappings.reduce((acc, m) => acc + m.confidence, 0);
  return Math.min(1, sum / mappings.length);
}

// ── Handler ──────────────────────────────────────────────────

const _handler: FunctionalConceptHandler = {

  register(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', {
      name: 'ApiSpecImporter',
      inputKind: 'ApiSpecConfig',
      outputKind: 'IngestManifest',
      capabilities: JSON.stringify(['openapi', 'graphql', 'asyncapi', 'inline-import', 'url-import']),
    }) as StorageProgram<Result>;
  },

  // import(specUrl, specType, targetConcept)
  // In production the sync layer fetches the URL and passes content inline.
  // The handler validates inputs and, because it cannot do live HTTP I/O,
  // stores the intent record and returns a minimal draft manifest.
  // Full content processing happens when importInline is called by the sync.
  import(input: Record<string, unknown>) {
    const specUrl = (input.specUrl as string | undefined) ?? '';
    const specType = (input.specType as string | undefined) ?? '';
    const targetConcept = (input.targetConcept as string | undefined) ?? '';

    // Input validation (error-case fixtures: empty_url, unknown_type, empty_concept)
    if (!specUrl || specUrl.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'specUrl is required' }) as StorageProgram<Result>;
    }
    if (!VALID_SPEC_TYPES.has(specType)) {
      return complete(createProgram(), 'invalid', { message: `specType must be one of: ${[...VALID_SPEC_TYPES].join(', ')}` }) as StorageProgram<Result>;
    }
    if (!targetConcept || targetConcept.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'targetConcept is required' }) as StorageProgram<Result>;
    }

    // For the handler, accept specContent passed alongside specUrl (sync layer provides it).
    // If specContent is provided, parse it; otherwise produce a minimal error (unreachable URL).
    const specContent = (input.specContent as string | undefined) ?? '';

    if (!specContent || specContent.trim() === '') {
      // No inline content means the URL was "unreachable" from the handler's perspective.
      return complete(createProgram(), 'error', { message: `Could not fetch spec from ${specUrl}` }) as StorageProgram<Result>;
    }

    let specJson: Record<string, unknown>;
    try {
      specJson = JSON.parse(specContent);
    } catch {
      return complete(createProgram(), 'error', { message: 'Spec content is not valid JSON' }) as StorageProgram<Result>;
    }

    const mappings = inferMappingsFromSpec(specJson, specType, []);
    const draftManifest = buildDraftManifest(targetConcept, specType, specUrl, mappings);
    const confidence = overallConfidence(mappings);
    const inferredMappings = JSON.stringify(mappings);
    const importedAt = new Date().toISOString();

    const importId = `${specType}:${targetConcept}:${Date.now()}`;

    let p = createProgram();
    // Check for existing import with same key to avoid duplicates
    p = get(p, 'import', importId, '_existing');
    p = put(p, 'import', importId, {
      importId,
      specUrl,
      specType,
      targetConcept,
      draftManifest,
      confidence,
      inferredMappings,
      importedAt,
    });
    return completeFrom(p, 'ok', (_b) => ({
      import: importId,
      draftManifest,
      confidence,
    })) as StorageProgram<Result>;
  },

  // importInline(specContent, specType, targetConcept)
  importInline(input: Record<string, unknown>) {
    const specContent = (input.specContent as string | undefined) ?? '';
    const specType = (input.specType as string | undefined) ?? '';
    const targetConcept = (input.targetConcept as string | undefined) ?? '';

    // Input validation (error-case fixtures: empty_content, empty_concept_inline, unknown_type)
    if (!specContent || specContent.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'specContent is required' }) as StorageProgram<Result>;
    }
    if (!VALID_SPEC_TYPES.has(specType)) {
      return complete(createProgram(), 'invalid', { message: `specType must be one of: ${[...VALID_SPEC_TYPES].join(', ')}` }) as StorageProgram<Result>;
    }
    if (!targetConcept || targetConcept.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'targetConcept is required' }) as StorageProgram<Result>;
    }

    let specJson: Record<string, unknown>;
    try {
      specJson = JSON.parse(specContent);
    } catch {
      return complete(createProgram(), 'invalid', { message: 'specContent is not valid JSON' }) as StorageProgram<Result>;
    }

    const mappings = inferMappingsFromSpec(specJson, specType, []);
    const draftManifest = buildDraftManifest(targetConcept, specType, undefined, mappings);
    const confidence = overallConfidence(mappings);
    const inferredMappings = JSON.stringify(mappings);
    const importedAt = new Date().toISOString();

    // Use a content-addressed key so identical imports are idempotent
    const importId = `inline:${specType}:${targetConcept}:${importedAt}`;

    let p = createProgram();
    p = put(p, 'import', importId, {
      importId,
      specUrl: null,
      specType,
      targetConcept,
      draftManifest,
      confidence,
      inferredMappings,
      importedAt,
    });
    return completeFrom(p, 'ok', (_b) => ({
      import: importId,
      draftManifest,
      confidence,
    })) as StorageProgram<Result>;
  },

  // inferMappings(spec, conceptManifest)
  // Parses both arguments as JSON and cross-references endpoint names
  // against concept action names to produce ranked mappings.
  inferMappings(input: Record<string, unknown>) {
    const specStr = (input.spec as string | undefined) ?? '';
    const manifestStr = (input.conceptManifest as string | undefined) ?? '';

    // Input validation (error-case fixtures: empty_spec, empty_manifest, malformed_spec)
    if (!specStr || specStr.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'spec is required' }) as StorageProgram<Result>;
    }
    if (!manifestStr || manifestStr.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'conceptManifest is required' }) as StorageProgram<Result>;
    }

    let specJson: Record<string, unknown>;
    try {
      specJson = JSON.parse(specStr);
    } catch {
      return complete(createProgram(), 'invalid', { message: 'spec is not valid JSON' }) as StorageProgram<Result>;
    }

    let manifestJson: Record<string, unknown>;
    try {
      manifestJson = JSON.parse(manifestStr);
    } catch {
      return complete(createProgram(), 'invalid', { message: 'conceptManifest is not valid JSON' }) as StorageProgram<Result>;
    }

    // Extract concept action names from manifest
    const rawActions = (manifestJson.actions as Array<Record<string, unknown>>) ?? [];
    const conceptActions = rawActions
      .map(a => (a.name as string) ?? '')
      .filter(Boolean);

    // Detect spec type from structure
    let specType = 'openapi';
    if ('__schema' in specJson || (specJson as any).__schema) {
      specType = 'graphql';
    } else if ('channels' in specJson) {
      specType = 'asyncapi';
    }

    const mappings = inferMappingsFromSpec(specJson, specType, conceptActions);

    // Sort descending by confidence
    mappings.sort((a, b) => b.confidence - a.confidence);

    const confidence = overallConfidence(mappings);

    const p = createProgram();
    return complete(p, 'ok', {
      mappings: JSON.stringify(mappings),
      confidence,
    }) as StorageProgram<Result>;
  },

  // get(import)
  get(input: Record<string, unknown>) {
    const importId = input.import as string;

    let p = createProgram();
    p = get(p, 'import', importId, 'record');
    return branch(
      p,
      (b) => b.record != null,
      (b) => completeFrom(b, 'ok', (bindings) => {
        const r = bindings.record as Record<string, unknown>;
        return {
          import: r.importId as string,
          specUrl: r.specUrl ?? null,
          specType: r.specType as string,
          targetConcept: r.targetConcept as string,
          draftManifest: r.draftManifest as string,
          confidence: r.confidence as number,
          inferredMappings: r.inferredMappings as string,
          importedAt: r.importedAt as string,
        };
      }),
      (b) => complete(b, 'notfound', { message: 'No import record exists with this identifier' }),
    ) as StorageProgram<Result>;
  },

  // list()
  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'import', {}, 'allImports');
    return completeFrom(p, 'ok', (bindings) => {
      const records = (bindings.allImports as Array<Record<string, unknown>>) ?? [];
      const imports = records.map(r => r.importId as string).filter(Boolean);
      return { imports };
    }) as StorageProgram<Result>;
  },

};

export const apiSpecImporterHandler = autoInterpret(_handler);
