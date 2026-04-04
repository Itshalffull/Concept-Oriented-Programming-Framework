// @clef-handler style=functional
// ============================================================
// ExternalHandlerGen — Generate TypeScript handlers from ingest manifests
//
// Reads an ingest manifest (JSON), extracts action mappings for a
// given source + concept, and generates a TypeScript handler source
// string. Each action method in the generated handler builds a
// StorageProgram that calls perform('http', ...) with the correct
// method, path, body, and auth headers.
//
// See architecture doc:
//   - Section 6: Concept implementations
//   - Section 6.2: Storage patterns
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, find, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// ── Ingest manifest types ─────────────────────────────────────

interface FieldTransform {
  from: string;
  to: string;
}

interface ActionMapping {
  name: string;
  method: string;
  path: string;
  fieldTransforms: {
    request: FieldTransform[];
    response: FieldTransform[];
  };
}

interface AuthConfig {
  type: 'bearer' | 'apiKey' | string;
  tokenEnvVar?: string;
  headerName?: string;
  keyEnvVar?: string;
}

interface ConceptEntry {
  name: string;
  actions: ActionMapping[];
}

interface SourceEntry {
  name: string;
  baseUrl: string;
  authConfig: AuthConfig;
  concepts: ConceptEntry[];
}

interface IngestManifest {
  sources: SourceEntry[];
}

// ── Code generation helpers ───────────────────────────────────

function generateAuthHeadersCode(authConfig: AuthConfig): string {
  if (authConfig.type === 'bearer') {
    const tokenVar = authConfig.tokenEnvVar ?? 'BEARER_TOKEN';
    return `{ Authorization: \`Bearer \${process.env.${tokenVar} ?? ''}\` }`;
  }
  if (authConfig.type === 'apiKey') {
    const headerName = authConfig.headerName ?? 'X-Api-Key';
    const keyVar = authConfig.keyEnvVar ?? 'API_KEY';
    return `{ '${headerName}': process.env.${keyVar} ?? '' }`;
  }
  return '{}';
}

function generateActionMethod(action: ActionMapping, authConfig: AuthConfig, baseUrl: string): string {
  const { name, method, path, fieldTransforms } = action;
  const authHeaders = generateAuthHeadersCode(authConfig);

  const lines: string[] = [];
  lines.push(`  ${name}(input: Record<string, unknown>) {`);

  // Input validation: extract declared request field transforms
  if (fieldTransforms.request.length > 0) {
    for (const ft of fieldTransforms.request) {
      lines.push(`    const _${ft.from} = input.${ft.from};`);
    }
    lines.push('');
  }

  // Build a QueryProgram instead of raw perform() calls.
  // The RemoteQueryProvider interprets this program and handles
  // HTTP dispatch, field transforms, and planPushdown.
  lines.push('    // Build QueryProgram — the remote provider handles HTTP dispatch');
  lines.push('    let p = createProgram();');

  // For list/query actions, build scan + filter + sort + limit program
  const isListAction = name === 'list' || method === 'GET' && !path.includes(':');
  if (isListAction) {
    lines.push(`    // List action: scan → filter → sort → limit → pure`);
    lines.push(`    p = put(p, 'queryProgram', '${name}', {`);
    lines.push(`      instructions: JSON.stringify([`);
    lines.push(`        { type: "scan", source: "${baseUrl}${path}", bindAs: "records" },`);
    if (fieldTransforms.request.length > 0) {
      // Convert request field transforms to filter predicates
      for (const ft of fieldTransforms.request) {
        lines.push(`        ...(input.${ft.from} ? [{ type: "filter", node: JSON.stringify({ type: "eq", field: "${ft.to}", value: input.${ft.from} }), bindAs: "filtered" }] : []),`);
      }
    }
    lines.push(`        { type: "pure", variant: "ok", output: "records" },`);
    lines.push(`      ]),`);
    lines.push(`      terminated: true,`);
    lines.push('    });');
  } else {
    // For CRUD actions (create, get, update, delete), build a single-step
    // program with the action metadata embedded for the remote provider
    lines.push(`    // ${name} action: single-step program for remote provider`);

    // Build request body mapping
    lines.push('    const _requestBody: Record<string, unknown> = {};');
    if (fieldTransforms.request.length > 0) {
      for (const ft of fieldTransforms.request) {
        lines.push(`    if (_${ft.from} !== undefined) _requestBody['${ft.to}'] = _${ft.from};`);
      }
    } else {
      lines.push('    Object.assign(_requestBody, input);');
    }

    // Build path (handle :param placeholders)
    const hasPathParams = path.includes(':');
    if (hasPathParams) {
      const resolvedPath = path.replace(/:(\w+)/g, (_m, p) => `\${(input.${p} as string) ?? ''}`);
      lines.push(`    const _path = \`${resolvedPath}\`;`);
    } else {
      lines.push(`    const _path = '${path}';`);
    }

    lines.push(`    p = put(p, 'queryProgram', '${name}', {`);
    lines.push(`      instructions: JSON.stringify([`);
    lines.push(`        { type: "scan", source: "${baseUrl}" + _path, bindAs: "records",`);
    lines.push(`          _remote: { method: "${method}", body: _requestBody, headers: ${authHeaders} } },`);
    lines.push(`        { type: "pure", variant: "ok", output: "records" },`);
    lines.push(`      ]),`);
    lines.push(`      terminated: true,`);
    lines.push('    });');
  }

  // Also store the raw perform() as a fallback for direct execution
  // (when not going through QueryExecution)
  lines.push('');
  lines.push('    // Fallback: direct HTTP call via perform for non-QueryExecution paths');
  // Build request body for fallback
  if (!isListAction) {
    // Already built above
  } else {
    lines.push('    const _requestBody: Record<string, unknown> = {};');
    if (fieldTransforms.request.length > 0) {
      for (const ft of fieldTransforms.request) {
        lines.push(`    if (input.${ft.from} !== undefined) _requestBody['${ft.to}'] = input.${ft.from};`);
      }
    }
    const hasPathParams = path.includes(':');
    if (hasPathParams) {
      const resolvedPath = path.replace(/:(\w+)/g, (_m, p) => `\${(input.${p} as string) ?? ''}`);
      lines.push(`    const _path = \`${resolvedPath}\`;`);
    } else {
      lines.push(`    const _path = '${path}';`);
    }
  }
  lines.push(`    p = perform(p, 'http', '${method}', {`);
  lines.push(`      endpoint: '${baseUrl}',`);
  lines.push(`      path: _path,`);
  if (method !== 'GET' && method !== 'DELETE') {
    lines.push('      body: _requestBody,');
  }
  lines.push(`      headers: ${authHeaders},`);
  lines.push("    }, '_httpResponse');");
  lines.push('');

  // Build response mapping
  if (fieldTransforms.response.length > 0) {
    lines.push('    // Map response fields via response field transforms');
    lines.push("    return completeFrom(p, 'ok', (bindings) => {");
    lines.push("      const _resp = (bindings._httpResponse ?? {}) as Record<string, unknown>;");
    lines.push('      const _out: Record<string, unknown> = {};');
    for (const ft of fieldTransforms.response) {
      lines.push(`      if (_resp['${ft.from}'] !== undefined) _out['${ft.to}'] = _resp['${ft.from}'];`);
    }
    lines.push('      return _out;');
    lines.push('    });');
  } else {
    lines.push("    return completeFrom(p, 'ok', (bindings) => ({");
    lines.push('      ...(bindings._httpResponse as Record<string, unknown> ?? {}),');
    lines.push('    }));');
  }

  lines.push('  },');
  return lines.join('\n');
}

function generateHandlerCode(
  conceptEntry: ConceptEntry,
  sourceEntry: SourceEntry,
): string {
  const conceptName = conceptEntry.name;
  const camelName = conceptName.charAt(0).toLowerCase() + conceptName.slice(1);
  const { authConfig, baseUrl } = sourceEntry;

  const lines: string[] = [
    '// @clef-handler style=functional',
    `// Auto-generated handler for ${conceptName} via ExternalHandlerGen`,
    `// Source: ${sourceEntry.name} (${baseUrl})`,
    '',
    "import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';",
    "import {",
    "  createProgram, complete, completeFrom, perform,",
    "  type StorageProgram,",
    "} from '../../../runtime/storage-program.ts';",
    "import { autoInterpret } from '../../../runtime/functional-compat.ts';",
    '',
    `const _handler: FunctionalConceptHandler = {`,
    '',
    '  register(_input: Record<string, unknown>) {',
    "    return complete(createProgram(), 'ok', {",
    `      name: '${conceptName}',`,
    "      inputKind: 'ExternalRequest',",
    "      outputKind: 'ExternalResponse',",
    "      capabilities: JSON.stringify(['http-perform']),",
    '    });',
    '  },',
    '',
  ];

  for (const action of conceptEntry.actions) {
    lines.push(generateActionMethod(action, authConfig, baseUrl));
    lines.push('');
  }

  lines.push('};');
  lines.push('');
  lines.push(`export const ${camelName}Handler = autoInterpret(_handler);`);

  return lines.join('\n');
}

function parseManifest(manifestStr: string): IngestManifest | null {
  try {
    const parsed = JSON.parse(manifestStr);
    if (typeof parsed !== 'object' || parsed === null || !Array.isArray(parsed.sources)) {
      return null;
    }
    return parsed as IngestManifest;
  } catch {
    return null;
  }
}

// ── Functional Handler ────────────────────────────────────────

const _handler: FunctionalConceptHandler = {

  register(_input: Record<string, unknown>) {
    return complete(createProgram(), 'ok', {
      name: 'ExternalHandlerGen',
      inputKind: 'IngestManifest',
      outputKind: 'HandlerImpl',
      capabilities: JSON.stringify(['http-perform', 'field-transform', 'auth-headers', 'multi-source']),
    }) as StorageProgram<Result>;
  },

  generate(input: Record<string, unknown>) {
    const manifestStr = (input.manifest as string) ?? '';
    const sourceName = (input.source as string) ?? '';
    const conceptName = (input.concept as string) ?? '';

    // Validate and parse manifest
    const manifest = parseManifest(manifestStr);
    if (!manifest) {
      return complete(createProgram(), 'invalid', {
        message: 'manifest JSON is malformed or missing required "sources" array',
      }) as StorageProgram<Result>;
    }

    // Find source
    const sourceEntry = manifest.sources.find(s => s.name === sourceName);
    if (!sourceEntry) {
      return complete(createProgram(), 'invalid', {
        message: `source "${sourceName}" not found in manifest`,
      }) as StorageProgram<Result>;
    }

    // Find concept under source
    const conceptEntry = sourceEntry.concepts.find(c => c.name === conceptName);
    if (!conceptEntry) {
      return complete(createProgram(), 'invalid', {
        message: `concept "${conceptName}" not found under source "${sourceName}"`,
      }) as StorageProgram<Result>;
    }

    // Generate handler code
    const handlerCode = generateHandlerCode(conceptEntry, sourceEntry);
    const actionCount = conceptEntry.actions.length;

    // Store the generation record
    const id = `${sourceName}:${conceptName}:${Date.now()}`;
    const now = new Date().toISOString();
    let p = createProgram();
    p = put(p, 'generation', id, {
      id,
      source: sourceName,
      concept: conceptName,
      handlerCode,
      generatedAt: now,
    });
    return completeFrom(p, 'ok', (_bindings) => ({
      handlerCode,
      actionCount,
    })) as StorageProgram<Result>;
  },

  generateAll(input: Record<string, unknown>) {
    const manifestStr = (input.manifest as string) ?? '';

    // Validate and parse manifest
    const manifest = parseManifest(manifestStr);
    if (!manifest) {
      return complete(createProgram(), 'invalid', {
        message: 'manifest JSON is malformed or missing required "sources" array',
      }) as StorageProgram<Result>;
    }

    // Require at least one source
    if (manifest.sources.length === 0) {
      return complete(createProgram(), 'invalid', {
        message: 'manifest contains no source entries',
      }) as StorageProgram<Result>;
    }

    // Generate handler code for each concept across all sources
    const sections: string[] = [];
    let count = 0;

    for (const sourceEntry of manifest.sources) {
      for (const conceptEntry of sourceEntry.concepts) {
        const header = `// === Source: ${sourceEntry.name} / Concept: ${conceptEntry.name} ===`;
        const code = generateHandlerCode(conceptEntry, sourceEntry);
        sections.push(`${header}\n${code}`);
        count++;
      }
    }

    const handlers = sections.join('\n\n');
    return complete(createProgram(), 'ok', {
      handlers,
      count,
    }) as StorageProgram<Result>;
  },

  preview(input: Record<string, unknown>) {
    const manifestStr = (input.manifest as string) ?? '';
    const sourceName = (input.source as string) ?? '';
    const conceptName = (input.concept as string) ?? '';
    const actionName = (input.action as string) ?? '';

    // Validate and parse manifest
    const manifest = parseManifest(manifestStr);
    if (!manifest) {
      return complete(createProgram(), 'notfound', {}) as StorageProgram<Result>;
    }

    // Find source
    const sourceEntry = manifest.sources.find(s => s.name === sourceName);
    if (!sourceEntry) {
      return complete(createProgram(), 'notfound', {}) as StorageProgram<Result>;
    }

    // Find concept
    const conceptEntry = sourceEntry.concepts.find(c => c.name === conceptName);
    if (!conceptEntry) {
      return complete(createProgram(), 'notfound', {}) as StorageProgram<Result>;
    }

    // Find action
    const actionMapping = conceptEntry.actions.find(a => a.name === actionName);
    if (!actionMapping) {
      return complete(createProgram(), 'notfound', {}) as StorageProgram<Result>;
    }

    // Generate preview of just this action method
    const preview = generateActionMethod(actionMapping, sourceEntry.authConfig, sourceEntry.baseUrl);
    return complete(createProgram(), 'ok', { preview }) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'generation', {}, '_all');
    return completeFrom(p, 'ok', (bindings) => ({
      generations: (bindings._all as unknown[]) ?? [],
    })) as StorageProgram<Result>;
  },
};

export const externalHandlerGenHandler = autoInterpret(_handler);
