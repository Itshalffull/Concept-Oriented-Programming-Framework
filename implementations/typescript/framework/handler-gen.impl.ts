// ============================================================
// HandlerGen — Generate storage-backed .impl.ts handlers
//
// Takes a ConceptManifest and produces a TypeScript handler
// implementation file. Each action becomes a method that
// reads/writes through ConceptStorage, extracts typed input
// fields, and returns the appropriate variant.
//
// Output: single <concept>.impl.ts file per concept.
// ============================================================

import type {
  ConceptHandler,
  ConceptStorage,
  ConceptManifest,
  ActionSchema,
  VariantSchema,
} from '../../../kernel/src/types.js';

function toKebab(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

function toCamel(name: string): string {
  return name.charAt(0).toLowerCase() + name.slice(1);
}

// --- Generate the handler file content ---

function generateHandlerImpl(manifest: ConceptManifest, relativeKernelPath: string): string {
  const conceptName = manifest.name;
  const handlerName = `${toCamel(conceptName)}Handler`;
  const relation = toKebab(conceptName);

  const lines: string[] = [];

  // Header
  lines.push(`// ============================================================`);
  lines.push(`// ${conceptName} Handler`);
  lines.push(`//`);
  if (manifest.purpose) {
    // Wrap purpose to ~60 chars per line
    const words = manifest.purpose.split(/\s+/);
    let line = '//';
    for (const word of words) {
      if (line.length + word.length + 1 > 68) {
        lines.push(line);
        line = '// ' + word;
      } else {
        line += ' ' + word;
      }
    }
    if (line.trim() !== '//') lines.push(line);
  }
  lines.push(`// ============================================================`);
  lines.push(``);
  lines.push(`import type { ConceptHandler, ConceptStorage } from '${relativeKernelPath}/kernel/src/types.js';`);
  lines.push(``);

  // ID counter
  lines.push(`let idCounter = 0;`);
  lines.push(`function nextId(): string {`);
  lines.push(`  return \`${relation}-\${++idCounter}\`;`);
  lines.push(`}`);
  lines.push(``);

  // Handler export
  lines.push(`export const ${handlerName}: ConceptHandler = {`);

  for (let i = 0; i < manifest.actions.length; i++) {
    const action = manifest.actions[i];
    if (i > 0) lines.push(``);
    lines.push(...generateAction(action, relation, conceptName));
  }

  lines.push(`};`);
  lines.push(``);

  // Reset helper for tests
  lines.push(`/** Reset the ID counter. Useful for testing. */`);
  lines.push(`export function reset${conceptName}Counter(): void {`);
  lines.push(`  idCounter = 0;`);
  lines.push(`}`);
  lines.push(``);

  return lines.join('\n');
}

function generateAction(action: ActionSchema, relation: string, conceptName: string): string[] {
  const lines: string[] = [];
  const actionName = action.name;

  lines.push(`  async ${actionName}(input: Record<string, unknown>, storage: ConceptStorage) {`);

  // Extract input parameters
  for (const param of action.params) {
    const tsType = paramToTsType(param.type);
    lines.push(`    const ${param.name} = input.${param.name} as ${tsType};`);
  }

  if (action.params.length > 0) {
    lines.push(``);
  }

  // Generate logic based on action pattern
  const variants = action.variants;
  const variantNames = variants.map(v => v.tag);

  if (isRegistrationAction(actionName, variantNames)) {
    lines.push(...generateRegistrationBody(action, relation));
  } else if (isLookupAction(actionName, variantNames)) {
    lines.push(...generateLookupBody(action, relation));
  } else if (isQueryAction(actionName, variantNames)) {
    lines.push(...generateQueryBody(action, relation));
  } else if (isRemoveAction(actionName, variantNames)) {
    lines.push(...generateRemoveBody(action, relation));
  } else if (isUpdateAction(actionName, variantNames)) {
    lines.push(...generateUpdateBody(action, relation));
  } else {
    // Generic: return first variant with stub fields
    lines.push(...generateGenericBody(action, relation));
  }

  lines.push(`  },`);
  return lines;
}

// --- Action pattern detection ---

function isRegistrationAction(name: string, variants: string[]): boolean {
  const regNames = ['register', 'create', 'add', 'record', 'define', 'compute', 'classify', 'enroll', 'start', 'begin', 'open'];
  return regNames.some(r => name.toLowerCase().startsWith(r))
    && (variants.includes('ok') || variants.includes('alreadyExists') || variants.includes('created'));
}

function isLookupAction(name: string, variants: string[]): boolean {
  const lookupNames = ['resolve', 'get', 'lookup', 'find', 'check', 'status', 'describe'];
  return lookupNames.some(r => name.toLowerCase().startsWith(r))
    && (variants.includes('notfound') || variants.includes('notFound') || variants.includes('unknown'));
}

function isQueryAction(name: string, variants: string[]): boolean {
  const queryNames = ['find', 'list', 'query', 'search', 'report', 'summary', 'graph', 'export', 'history'];
  return queryNames.some(r => name.toLowerCase().startsWith(r))
    && variants.includes('ok')
    && !variants.includes('notfound') && !variants.includes('notFound');
}

function isRemoveAction(name: string, variants: string[]): boolean {
  const removeNames = ['remove', 'delete', 'clear', 'unregister', 'deregister', 'close', 'end', 'stop', 'quarantine'];
  return removeNames.some(r => name.toLowerCase().startsWith(r));
}

function isUpdateAction(name: string, variants: string[]): boolean {
  const updateNames = ['update', 'set', 'rename', 'mark', 'link', 'tag', 'assign', 'connect', 'annotate', 'configure', 'apply', 'merge', 'rebase', 'checkpoint'];
  return updateNames.some(r => name.toLowerCase().startsWith(r));
}

// --- Action body generators ---

function generateRegistrationBody(action: ActionSchema, relation: string): string[] {
  const lines: string[] = [];
  const okVariant = action.variants.find(v => v.tag === 'ok' || v.tag === 'created');
  const dupVariant = action.variants.find(v => v.tag === 'alreadyExists' || v.tag === 'duplicate');

  // Look for a natural key parameter (first string param that's a name/id/key/string)
  const keyParam = action.params.find(p => ['name', 'id', 'key', 'symbolString', 'testId', 'uri', 'locator', 'path', 'file'].includes(p.name))
    || action.params[0];

  if (dupVariant && keyParam) {
    lines.push(`    // Check for duplicates`);
    lines.push(`    const existing = await storage.find('${relation}', { ${keyParam.name} });`);
    lines.push(`    if (existing.length > 0) {`);
    lines.push(`      return ${buildVariantReturn(dupVariant, 'existing[0]')};`);
    lines.push(`    }`);
    lines.push(``);
  }

  lines.push(`    const id = nextId();`);

  // Build storage record from all input params
  const fields = action.params.map(p => p.name);
  lines.push(`    await storage.put('${relation}', id, {`);
  lines.push(`      id,`);
  for (const f of fields) {
    lines.push(`      ${f},`);
  }
  lines.push(`    });`);
  lines.push(``);

  if (okVariant) {
    lines.push(`    return ${buildOkReturn(okVariant, 'id')};`);
  } else {
    lines.push(`    return { variant: '${action.variants[0].tag}' };`);
  }

  return lines;
}

function generateLookupBody(action: ActionSchema, relation: string): string[] {
  const lines: string[] = [];
  const okVariant = action.variants.find(v => v.tag === 'ok');
  const notFoundVariant = action.variants.find(v => v.tag === 'notfound' || v.tag === 'notFound' || v.tag === 'unknown');

  const keyParam = action.params[0];
  if (keyParam) {
    lines.push(`    const results = await storage.find('${relation}', { ${keyParam.name} });`);
    lines.push(`    if (results.length === 0) {`);
    if (notFoundVariant) {
      lines.push(`      return ${buildVariantReturn(notFoundVariant)};`);
    } else {
      lines.push(`      return { variant: 'notfound' };`);
    }
    lines.push(`    }`);
    lines.push(``);
    lines.push(`    const record = results[0];`);

    if (okVariant) {
      lines.push(`    return ${buildOkReturnFromRecord(okVariant)};`);
    } else {
      lines.push(`    return { variant: 'ok', ...record };`);
    }
  } else {
    lines.push(`    return { variant: '${action.variants[0].tag}' };`);
  }

  return lines;
}

function generateQueryBody(action: ActionSchema, relation: string): string[] {
  const lines: string[] = [];
  const okVariant = action.variants.find(v => v.tag === 'ok');

  if (action.params.length > 0) {
    const criteria = action.params.map(p => p.name);
    lines.push(`    const criteria: Record<string, unknown> = {};`);
    for (const c of criteria) {
      lines.push(`    if (${c} !== undefined && ${c} !== '') criteria.${c} = ${c};`);
    }
    lines.push(`    const results = await storage.find('${relation}', Object.keys(criteria).length > 0 ? criteria : undefined);`);
  } else {
    lines.push(`    const results = await storage.find('${relation}');`);
  }
  lines.push(``);

  if (okVariant) {
    // Check if the variant has a field that looks like a list/results field
    const listField = okVariant.fields.find(f => ['results', 'items', 'entries', 'symbols', 'records', 'paths', 'rules', 'nodes', 'edges', 'artifacts', 'files', 'branches', 'tags', 'versions', 'patches', 'diffs', 'events', 'summary'].includes(f.name));
    if (listField) {
      lines.push(`    return { variant: 'ok', ${listField.name}: JSON.stringify(results) };`);
    } else {
      lines.push(`    return { variant: 'ok', ...${okVariant.fields.length > 0 ? `{ ${okVariant.fields.map(f => `${f.name}: JSON.stringify(results)`).join(', ')} }` : '{}'} };`);
    }
  } else {
    lines.push(`    return { variant: '${action.variants[0].tag}', results: JSON.stringify(results) };`);
  }

  return lines;
}

function generateRemoveBody(action: ActionSchema, relation: string): string[] {
  const lines: string[] = [];
  const keyParam = action.params[0];

  if (keyParam) {
    lines.push(`    const existing = await storage.find('${relation}', { ${keyParam.name} });`);
    lines.push(`    if (existing.length === 0) {`);
    const notFoundV = action.variants.find(v => v.tag === 'notfound' || v.tag === 'notFound');
    if (notFoundV) {
      lines.push(`      return ${buildVariantReturn(notFoundV)};`);
    } else {
      lines.push(`      return { variant: 'notfound' };`);
    }
    lines.push(`    }`);
    lines.push(``);
    lines.push(`    await storage.del('${relation}', existing[0].id as string);`);
  }

  const okVariant = action.variants.find(v => v.tag === 'ok' || v.tag === 'removed' || v.tag === 'done');
  if (okVariant) {
    lines.push(`    return { variant: '${okVariant.tag}' };`);
  } else {
    lines.push(`    return { variant: '${action.variants[0].tag}' };`);
  }

  return lines;
}

function generateUpdateBody(action: ActionSchema, relation: string): string[] {
  const lines: string[] = [];
  const keyParam = action.params[0];

  if (keyParam) {
    lines.push(`    const existing = await storage.find('${relation}', { ${keyParam.name} });`);
    lines.push(`    if (existing.length === 0) {`);
    const notFoundV = action.variants.find(v => v.tag === 'notfound' || v.tag === 'notFound');
    if (notFoundV) {
      lines.push(`      return ${buildVariantReturn(notFoundV)};`);
    } else {
      lines.push(`      return { variant: 'notfound' };`);
    }
    lines.push(`    }`);
    lines.push(``);
    lines.push(`    const record = existing[0];`);

    // Update with all params beyond the key
    const updateParams = action.params.slice(1);
    if (updateParams.length > 0) {
      lines.push(`    await storage.put('${relation}', record.id as string, {`);
      lines.push(`      ...record,`);
      for (const p of updateParams) {
        lines.push(`      ...(${p.name} !== undefined ? { ${p.name} } : {}),`);
      }
      lines.push(`    });`);
    }
  }
  lines.push(``);

  const okVariant = action.variants.find(v => v.tag === 'ok' || v.tag === 'updated' || v.tag === 'done');
  if (okVariant) {
    lines.push(`    return { variant: '${okVariant.tag}' };`);
  } else {
    lines.push(`    return { variant: '${action.variants[0].tag}' };`);
  }

  return lines;
}

function generateGenericBody(action: ActionSchema, relation: string): string[] {
  const lines: string[] = [];
  const okVariant = action.variants.find(v => v.tag === 'ok') || action.variants[0];

  if (okVariant) {
    lines.push(`    return ${buildVariantReturn(okVariant)};`);
  } else {
    lines.push(`    return { variant: 'ok' };`);
  }

  return lines;
}

// --- Variant return builders ---

function buildVariantReturn(variant: VariantSchema, recordExpr?: string): string {
  const fields: string[] = [`variant: '${variant.tag}'`];
  for (const f of variant.fields) {
    fields.push(`${f.name}: ${defaultForField(f.name, recordExpr)}`);
  }
  return `{ ${fields.join(', ')} }`;
}

function buildOkReturn(variant: VariantSchema, idExpr: string): string {
  const fields: string[] = [`variant: 'ok'`];
  for (const f of variant.fields) {
    // If a field name matches common ID patterns, use the id expression
    if (['symbol', 'entity', 'field', 'node', 'rule', 'path', 'slice', 'embedding', 'flow', 'coverage', 'profile', 'correlation', 'branch', 'version', 'diff', 'patch', 'merge', 'ref', 'policy', 'test', 'contract', 'snapshot', 'guide', 'surface', 'renderer', 'plan', 'resource', 'kind'].includes(f.name)
      || f.name.endsWith('Id') || f.name === 'id') {
      fields.push(`${f.name}: ${idExpr}`);
    } else {
      fields.push(`${f.name}: ${defaultForField(f.name)}`);
    }
  }
  return `{ ${fields.join(', ')} }`;
}

function buildOkReturnFromRecord(variant: VariantSchema): string {
  const fields: string[] = [`variant: 'ok'`];
  for (const f of variant.fields) {
    fields.push(`${f.name}: record.${f.name} as ${paramToTsType(f.type)}`);
  }
  return `{ ${fields.join(', ')} }`;
}

function defaultForField(name: string, recordExpr?: string): string {
  if (recordExpr) {
    return `${recordExpr}.${name} ?? ''`;
  }
  // Heuristic defaults based on field name
  if (name === 'message' || name === 'reason' || name === 'description') return `''`;
  if (name === 'count' || name === 'total' || name === 'duration' || name === 'size') return `0`;
  if (name.endsWith('s') || name === 'results' || name === 'items') return `'[]'`;
  return `''`;
}

function paramToTsType(type: any): string {
  if (!type) return 'unknown';
  if (typeof type === 'string') return type;
  switch (type.kind) {
    case 'primitive': return primitiveToTs(type.primitive);
    case 'param': return 'string';
    case 'list': return `string`; // serialized JSON
    case 'set': return `string`;
    case 'option': return `${paramToTsType(type.inner)} | undefined`;
    case 'map': return 'string'; // serialized JSON
    case 'record': return 'string'; // serialized JSON
    default: return 'unknown';
  }
}

function primitiveToTs(name: string): string {
  switch (name) {
    case 'String': return 'string';
    case 'Int': case 'Float': return 'number';
    case 'Bool': return 'boolean';
    case 'DateTime': return 'string';
    default: return 'string';
  }
}

// --- Determine output path ---

function determineOutputPath(manifest: ConceptManifest, specPath: string): string {
  const kebab = toKebab(manifest.name);
  // Route based on where the spec lives
  if (specPath.startsWith('kits/')) {
    // Extract kit name: kits/<kit-name>/...
    const parts = specPath.split('/');
    const kitName = parts[1];
    // Providers go under providers/ subfolder
    if (specPath.includes('/providers/')) {
      const providerPath = specPath.slice(specPath.indexOf('/providers/') + 1);
      const dir = providerPath.replace(/\/[^/]+\.concept$/, '');
      return `kits/${kitName}/implementations/typescript/${dir}/${kebab}.impl.ts`;
    }
    return `kits/${kitName}/implementations/typescript/${kebab}.impl.ts`;
  }
  if (specPath.startsWith('specs/framework/')) {
    return `implementations/typescript/framework/${kebab}.impl.ts`;
  }
  if (specPath.startsWith('specs/app/')) {
    return `implementations/typescript/app/${kebab}.impl.ts`;
  }
  return `implementations/typescript/${kebab}.impl.ts`;
}

function determineRelativeKernelPath(outputPath: string): string {
  // Count directory depth from project root to determine ../../../ etc
  const depth = outputPath.split('/').length - 1;
  return Array(depth).fill('..').join('/');
}

// --- ConceptHandler interface ---

export const handlerGenHandler: ConceptHandler = {
  async generate(
    input: Record<string, unknown>,
    _storage: ConceptStorage,
  ) {
    const specPath = input.spec as string;
    const manifest = input.manifest as ConceptManifest;

    if (!manifest || !manifest.name) {
      return { variant: 'error', message: 'Missing manifest' };
    }

    const outputPath = determineOutputPath(manifest, specPath);
    const relKernel = determineRelativeKernelPath(outputPath);
    const content = generateHandlerImpl(manifest, relKernel);

    return {
      variant: 'ok',
      files: [{ path: outputPath, content }],
      message: `Generated handler for ${manifest.name}`,
    };
  },
};
