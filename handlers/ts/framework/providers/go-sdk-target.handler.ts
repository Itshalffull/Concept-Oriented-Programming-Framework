// ============================================================
// Go SDK Target Provider — Interface Kit
//
// Generates Go client structs from ConceptManifest data.
// Each concept produces a {snake_name}.go file with a typed
// client struct and methods. Package-level files are generated
// when allProjections is provided.
// Architecture doc: Interface Kit
// ============================================================

import type {
  ConceptHandler,
  ConceptStorage,
  ConceptManifest,
  ActionSchema,
  ActionParamSchema,
  VariantSchema,
} from '../../../../kernel/src/types.js';

import {
  typeToGo,
  toKebabCase,
  toPascalCase,
  toSnakeCase,
  generateFileHeader,
  inferHttpRoute,
} from './codegen-utils.js';

// --- Internal Types ---

interface GeneratedFile {
  path: string;
  content: string;
}

interface ProjectionEntry {
  conceptManifest: string;
  conceptName: string;
}

// --- Go Struct and Type Generation ---

/**
 * Generate a Go struct definition for action input or output types.
 */
function generateGoStruct(name: string, params: ActionParamSchema[]): string {
  if (params.length === 0) return `type ${name} struct{}`;
  const fields = params.map((p) => {
    const goType = typeToGo(p.type);
    const jsonTag = `\`json:"${p.name}"\``;
    return `\t${toPascalCase(p.name)} ${goType} ${jsonTag}`;
  });
  return `type ${name} struct {\n${fields.join('\n')}\n}`;
}

/**
 * Determine which standard library imports are needed.
 */
function collectGoImports(actions: ActionSchema[]): string[] {
  const imports = new Set<string>();
  imports.add('"context"');
  imports.add('"encoding/json"');
  imports.add('"fmt"');
  imports.add('"net/http"');
  imports.add('"bytes"');
  imports.add('"io"');

  // Check if time.Time is used
  for (const action of actions) {
    for (const p of action.params) {
      if (typeToGo(p.type).includes('time.Time')) {
        imports.add('"time"');
        break;
      }
    }
    for (const v of action.variants) {
      for (const f of v.fields) {
        if (typeToGo(f.type).includes('time.Time')) {
          imports.add('"time"');
          break;
        }
      }
    }
  }

  return Array.from(imports).sort();
}

// --- Client Method Generation ---

/**
 * Generate a single Go method for the client struct.
 */
function generateMethod(
  action: ActionSchema,
  basePath: string,
  conceptName: string,
): string {
  const route = inferHttpRoute(action.name, basePath);
  const methodName = toPascalCase(action.name);
  const inputStructName = `${methodName}${toPascalCase(conceptName)}Input`;
  const outputStructName = `${methodName}${toPascalCase(conceptName)}Output`;
  const lines: string[] = [];

  if (route.method === 'GET' || route.method === 'DELETE') {
    if (route.path.includes('{id}')) {
      lines.push(`func (c *${toPascalCase(conceptName)}Client) ${methodName}(ctx context.Context, id string) (*${outputStructName}, error) {`);
      lines.push(`\turl := fmt.Sprintf("%s${route.path.replace('{id}', '%s')}", c.BaseURL, id)`);
      lines.push(`\treq, err := http.NewRequestWithContext(ctx, "${route.method}", url, nil)`);
    } else {
      lines.push(`func (c *${toPascalCase(conceptName)}Client) ${methodName}(ctx context.Context) (*${outputStructName}, error) {`);
      lines.push(`\turl := fmt.Sprintf("%s${route.path}", c.BaseURL)`);
      lines.push(`\treq, err := http.NewRequestWithContext(ctx, "${route.method}", url, nil)`);
    }
    lines.push(`\tif err != nil {`);
    lines.push(`\t\treturn nil, fmt.Errorf("${methodName}: build request: %w", err)`);
    lines.push(`\t}`);
    lines.push(`\tfor k, v := range c.Headers {`);
    lines.push(`\t\treq.Header.Set(k, v)`);
    lines.push(`\t}`);
  } else {
    // POST / PUT — JSON body
    lines.push(`func (c *${toPascalCase(conceptName)}Client) ${methodName}(ctx context.Context, input ${inputStructName}) (*${outputStructName}, error) {`);
    lines.push(`\tbody, err := json.Marshal(input)`);
    lines.push(`\tif err != nil {`);
    lines.push(`\t\treturn nil, fmt.Errorf("${methodName}: marshal input: %w", err)`);
    lines.push(`\t}`);
    if (route.path.includes('{id}')) {
      lines.push(`\turl := fmt.Sprintf("%s${route.path.replace('{id}', '%s')}", c.BaseURL, "")`);
    } else {
      lines.push(`\turl := fmt.Sprintf("%s${route.path}", c.BaseURL)`);
    }
    lines.push(`\treq, err := http.NewRequestWithContext(ctx, "${route.method}", url, bytes.NewReader(body))`);
    lines.push(`\tif err != nil {`);
    lines.push(`\t\treturn nil, fmt.Errorf("${methodName}: build request: %w", err)`);
    lines.push(`\t}`);
    lines.push(`\treq.Header.Set("Content-Type", "application/json")`);
    lines.push(`\tfor k, v := range c.Headers {`);
    lines.push(`\t\treq.Header.Set(k, v)`);
    lines.push(`\t}`);
  }

  // Execute request and decode response (common to all methods)
  lines.push(`\tresp, err := http.DefaultClient.Do(req)`);
  lines.push(`\tif err != nil {`);
  lines.push(`\t\treturn nil, fmt.Errorf("${methodName}: execute request: %w", err)`);
  lines.push(`\t}`);
  lines.push(`\tdefer resp.Body.Close()`);
  lines.push(`\tif resp.StatusCode >= 400 {`);
  lines.push(`\t\terrBody, _ := io.ReadAll(resp.Body)`);
  lines.push(`\t\treturn nil, fmt.Errorf("${methodName}: status %d: %s", resp.StatusCode, string(errBody))`);
  lines.push(`\t}`);
  lines.push(`\tvar output ${outputStructName}`);
  lines.push(`\tif err := json.NewDecoder(resp.Body).Decode(&output); err != nil {`);
  lines.push(`\t\treturn nil, fmt.Errorf("${methodName}: decode response: %w", err)`);
  lines.push(`\t}`);
  lines.push(`\treturn &output, nil`);
  lines.push(`}`);

  return lines.join('\n');
}

// --- Full Client File Generation ---

/**
 * Generate the complete Go client file for a single concept.
 */
function generateClientFile(manifest: ConceptManifest, goPackage: string): { content: string; fileName: string } {
  const conceptName = manifest.name;
  const snakeName = toSnakeCase(manifest.name);
  const basePath = `/api/${toKebabCase(manifest.name)}s`;
  const imports = collectGoImports(manifest.actions);

  const header = `// Auto-generated by Clef Interface Kit — go-sdk target\n// Concept: ${manifest.name}\n// Do not edit manually; regenerate with: copf interface generate`;

  // Generate input/output structs
  const structDefs: string[] = [];
  for (const action of manifest.actions) {
    const methodName = toPascalCase(action.name);
    const inputStructName = `${methodName}${toPascalCase(conceptName)}Input`;
    structDefs.push(generateGoStruct(inputStructName, action.params));

    // Output: use first variant's fields (simplification)
    const outputFields = action.variants.length > 0 ? action.variants[0].fields : [];
    const outputStructName = `${methodName}${toPascalCase(conceptName)}Output`;
    structDefs.push(generateGoStruct(outputStructName, outputFields));
  }

  // Generate methods
  const methods = manifest.actions.map((a) => generateMethod(a, basePath, conceptName));

  const body = [
    header,
    '',
    `package ${goPackage}`,
    '',
    `import (`,
    imports.map((i) => `\t${i}`).join('\n'),
    `)`,
    '',
    `// ${toPascalCase(conceptName)}Client provides HTTP methods for the ${conceptName} concept.`,
    `type ${toPascalCase(conceptName)}Client struct {`,
    `\tBaseURL string`,
    `\tHeaders map[string]string`,
    `}`,
    '',
    `// New${toPascalCase(conceptName)}Client creates a new client for the ${conceptName} concept.`,
    `func New${toPascalCase(conceptName)}Client(baseURL string) *${toPascalCase(conceptName)}Client {`,
    `\treturn &${toPascalCase(conceptName)}Client{BaseURL: baseURL, Headers: map[string]string{}}`,
    `}`,
    '',
    '// --- Request/Response Types ---',
    '',
    structDefs.join('\n\n'),
    '',
    '// --- Client Methods ---',
    '',
    methods.join('\n\n'),
    '',
  ].join('\n');

  return { content: body, fileName: `${snakeName}.go` };
}

// --- Package-Level File Generation ---

function generateGoMod(moduleName: string): string {
  return [
    `module ${moduleName}`,
    '',
    'go 1.21',
    '',
  ].join('\n');
}

function generateGoMainClient(projections: ProjectionEntry[], goPackage: string): string {
  const header = `// Auto-generated by Clef Interface Kit — go-sdk target\n// Package client: aggregated client for all concepts`;
  const lines: string[] = [header, '', `package ${goPackage}`, ''];

  lines.push('// Client aggregates all concept clients under a single entry point.');
  lines.push('type Client struct {');
  for (const proj of projections) {
    const pascalName = toPascalCase(proj.conceptName);
    lines.push(`\t${pascalName} *${pascalName}Client`);
  }
  lines.push('}');
  lines.push('');

  lines.push('// NewClient creates a new aggregated client.');
  lines.push('func NewClient(baseURL string) *Client {');
  lines.push('\treturn &Client{');
  for (const proj of projections) {
    const pascalName = toPascalCase(proj.conceptName);
    lines.push(`\t\t${pascalName}: New${pascalName}Client(baseURL),`);
  }
  lines.push('\t}');
  lines.push('}');
  lines.push('');

  return lines.join('\n');
}

// --- Concept Handler ---

export const goSdkTargetHandler: ConceptHandler = {
  async register() {
    return {
      variant: 'ok',
      name: 'GoSdkTarget',
      inputKind: 'InterfaceProjection',
      outputKind: 'GoSdk',
      capabilities: JSON.stringify(['client', 'types', 'go-mod']),
      targetKey: 'go',
      providerType: 'sdk',
    };
  },

  /**
   * Generate Go SDK client files from ConceptManifest projections.
   *
   * Input fields:
   *   - projection:     JSON string containing { conceptManifest, conceptName }
   *   - config:         JSON string of SDK config (packageName, moduleName, etc.)
   *   - allProjections: JSON string array of all concept projections (for package files)
   *
   * Returns variant 'ok' with generated files and package name.
   */
  async generate(
    input: Record<string, unknown>,
    _storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    // --- Parse projection ---
    const projectionRaw = input.projection as string;
    if (!projectionRaw || typeof projectionRaw !== 'string') {
      return { variant: 'error', reason: 'projection is required and must be a JSON string' };
    }

    let projection: Record<string, unknown>;
    try {
      projection = JSON.parse(projectionRaw) as Record<string, unknown>;
    } catch {
      return { variant: 'error', reason: 'projection is not valid JSON' };
    }

    const manifestRaw = projection.conceptManifest as string;
    if (!manifestRaw || typeof manifestRaw !== 'string') {
      return { variant: 'error', reason: 'projection.conceptManifest is required and must be a JSON string' };
    }

    let manifest: ConceptManifest;
    try {
      manifest = JSON.parse(manifestRaw) as ConceptManifest;
    } catch {
      return { variant: 'error', reason: 'conceptManifest is not valid JSON' };
    }

    const conceptName = (projection.conceptName as string) || manifest.name;

    // --- Parse config ---
    let config: Record<string, unknown> = {};
    if (input.config && typeof input.config === 'string') {
      try {
        config = JSON.parse(input.config) as Record<string, unknown>;
      } catch {
        // Non-fatal: use defaults
      }
    }

    const packageName = (config.packageName as string) || 'conduit';
    const moduleName = (config.moduleName as string) || `github.com/copf/${packageName}`;

    // --- Validate manifest ---
    if (!manifest.actions || manifest.actions.length === 0) {
      return { variant: 'ok', files: [], package: packageName };
    }

    // --- Generate concept client file ---
    const files: GeneratedFile[] = [];
    const { content, fileName } = generateClientFile(manifest, packageName);
    files.push({ path: fileName, content });

    // --- Generate package-level files when allProjections is provided ---
    if (input.allProjections && typeof input.allProjections === 'string') {
      let allProjections: ProjectionEntry[] = [];
      try {
        const rawArray = JSON.parse(input.allProjections) as string[];
        allProjections = rawArray.map((raw) => {
          const parsed = JSON.parse(raw) as Record<string, unknown>;
          return {
            conceptManifest: parsed.conceptManifest as string,
            conceptName: (parsed.conceptName as string) || '',
          };
        });
      } catch {
        // Non-fatal: skip package files
      }

      if (allProjections.length > 0) {
        for (const proj of allProjections) {
          if (!proj.conceptName && proj.conceptManifest) {
            try {
              const m = JSON.parse(proj.conceptManifest) as ConceptManifest;
              proj.conceptName = m.name;
            } catch {
              // skip
            }
          }
        }

        files.push({ path: 'go.mod', content: generateGoMod(moduleName) });
        files.push({ path: 'client.go', content: generateGoMainClient(allProjections, packageName) });
      }
    }

    return { variant: 'ok', files, package: packageName };
  },
};
