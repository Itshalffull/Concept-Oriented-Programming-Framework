// ============================================================
// Rust SDK Target Provider — Interface Kit
//
// Generates Rust client structs from ConceptManifest data.
// Each concept produces a src/{snake_name}.rs file with a
// typed async client using reqwest. Package-level files are
// generated when allProjections is provided.
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
  typeToRust,
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

// --- Rust Struct Generation ---

/**
 * Generate a Rust #[derive(Serialize, Deserialize)] struct.
 */
function generateRustStruct(name: string, params: ActionParamSchema[]): string {
  if (params.length === 0) {
    return `#[derive(Debug, Clone, Serialize, Deserialize)]\npub struct ${name} {}`;
  }
  const fields = params.map((p) => {
    const rustType = typeToRust(p.type);
    return `    pub ${toSnakeCase(p.name)}: ${rustType},`;
  });
  return [
    `#[derive(Debug, Clone, Serialize, Deserialize)]`,
    `pub struct ${name} {`,
    ...fields,
    `}`,
  ].join('\n');
}

/**
 * Determine which crate imports are needed based on type usage.
 */
function collectRustImports(actions: ActionSchema[]): string[] {
  const imports: string[] = [
    'use serde::{Deserialize, Serialize};',
    'use reqwest::Client;',
  ];

  let needsHashSet = false;
  let needsHashMap = false;

  const checkType = (typeStr: string) => {
    if (typeStr.includes('HashSet')) needsHashSet = true;
    if (typeStr.includes('HashMap')) needsHashMap = true;
  };

  for (const action of actions) {
    for (const p of action.params) {
      checkType(typeToRust(p.type));
    }
    for (const v of action.variants) {
      for (const f of v.fields) {
        checkType(typeToRust(f.type));
      }
    }
  }

  if (needsHashSet) imports.push('use std::collections::HashSet;');
  if (needsHashMap) imports.push('use std::collections::HashMap;');

  return imports;
}

// --- Client Method Generation ---

/**
 * Generate a single async method for the Rust client impl block.
 */
function generateMethod(
  action: ActionSchema,
  basePath: string,
  conceptName: string,
): string {
  const route = inferHttpRoute(action.name, basePath);
  const methodName = toSnakeCase(action.name);
  const inputStructName = `${toPascalCase(action.name)}${toPascalCase(conceptName)}Input`;
  const outputStructName = `${toPascalCase(action.name)}${toPascalCase(conceptName)}Output`;
  const lines: string[] = [];

  if (route.method === 'GET' || route.method === 'DELETE') {
    if (route.path.includes('{id}')) {
      lines.push(`    pub async fn ${methodName}(&self, id: &str) -> Result<${outputStructName}, Error> {`);
      lines.push(`        let url = format!("{}${route.path.replace('{id}', '{}')}",  self.base_url, id);`);
    } else {
      lines.push(`    pub async fn ${methodName}(&self) -> Result<${outputStructName}, Error> {`);
      lines.push(`        let url = format!("{}${route.path}", self.base_url);`);
    }
    lines.push(`        let mut req = self.client.${route.method.toLowerCase()}(&url);`);
    lines.push(`        for (k, v) in &self.headers {`);
    lines.push(`            req = req.header(k.as_str(), v.as_str());`);
    lines.push(`        }`);
    lines.push(`        let resp = req.send().await.map_err(Error::Request)?;`);
  } else {
    // POST / PUT — JSON body
    lines.push(`    pub async fn ${methodName}(&self, input: ${inputStructName}) -> Result<${outputStructName}, Error> {`);
    if (route.path.includes('{id}')) {
      lines.push(`        let url = format!("{}${route.path.replace('{id}', '{}')}",  self.base_url, "");`);
    } else {
      lines.push(`        let url = format!("{}${route.path}", self.base_url);`);
    }
    lines.push(`        let mut req = self.client.${route.method.toLowerCase()}(&url)`);
    lines.push(`            .json(&input);`);
    lines.push(`        for (k, v) in &self.headers {`);
    lines.push(`            req = req.header(k.as_str(), v.as_str());`);
    lines.push(`        }`);
    lines.push(`        let resp = req.send().await.map_err(Error::Request)?;`);
  }

  // Common response handling
  lines.push(`        if !resp.status().is_success() {`);
  lines.push(`            let status = resp.status().as_u16();`);
  lines.push(`            let body = resp.text().await.unwrap_or_default();`);
  lines.push(`            return Err(Error::Api { status, body });`);
  lines.push(`        }`);
  lines.push(`        resp.json::<${outputStructName}>().await.map_err(Error::Request)`);
  lines.push(`    }`);

  return lines.join('\n');
}

// --- Full Client File Generation ---

/**
 * Generate the complete Rust client file for a single concept.
 */
function generateClientFile(manifest: ConceptManifest): { content: string; fileName: string } {
  const conceptName = manifest.name;
  const snakeName = toSnakeCase(manifest.name);
  const basePath = `/api/${toKebabCase(manifest.name)}s`;
  const clientName = `${toPascalCase(manifest.name)}Client`;
  const imports = collectRustImports(manifest.actions);

  const header = `// Auto-generated by COPF Interface Kit — rust-sdk target\n// Concept: ${manifest.name}\n// Do not edit manually; regenerate with: copf interface generate`;

  // Generate input/output structs
  const structDefs: string[] = [];
  for (const action of manifest.actions) {
    const inputStructName = `${toPascalCase(action.name)}${toPascalCase(conceptName)}Input`;
    structDefs.push(generateRustStruct(inputStructName, action.params));

    const outputFields = action.variants.length > 0 ? action.variants[0].fields : [];
    const outputStructName = `${toPascalCase(action.name)}${toPascalCase(conceptName)}Output`;
    structDefs.push(generateRustStruct(outputStructName, outputFields));
  }

  // Generate methods
  const methods = manifest.actions.map((a) => generateMethod(a, basePath, conceptName));

  const body = [
    header,
    '',
    imports.join('\n'),
    '',
    '// --- Error Type ---',
    '',
    '#[derive(Debug)]',
    'pub enum Error {',
    '    Request(reqwest::Error),',
    '    Api { status: u16, body: String },',
    '}',
    '',
    'impl std::fmt::Display for Error {',
    '    fn fmt(&self, f: &mut std::fmt::Formatter<\'_>) -> std::fmt::Result {',
    '        match self {',
    '            Error::Request(e) => write!(f, "request error: {e}"),',
    '            Error::Api { status, body } => write!(f, "API error {status}: {body}"),',
    '        }',
    '    }',
    '}',
    '',
    'impl std::error::Error for Error {}',
    '',
    '// --- Request/Response Types ---',
    '',
    structDefs.join('\n\n'),
    '',
    '// --- Client ---',
    '',
    `pub struct ${clientName} {`,
    `    base_url: String,`,
    `    headers: Vec<(String, String)>,`,
    `    client: Client,`,
    `}`,
    '',
    `impl ${clientName} {`,
    `    pub fn new(base_url: impl Into<String>) -> Self {`,
    `        Self {`,
    `            base_url: base_url.into(),`,
    `            headers: Vec::new(),`,
    `            client: Client::new(),`,
    `        }`,
    `    }`,
    '',
    `    pub fn with_header(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {`,
    `        self.headers.push((key.into(), value.into()));`,
    `        self`,
    `    }`,
    '',
    methods.join('\n\n'),
    `}`,
    '',
  ].join('\n');

  return { content: body, fileName: `src/${snakeName}.rs` };
}

// --- Package-Level File Generation ---

function generateCargoToml(packageName: string): string {
  const safeName = packageName.replace(/@/g, '').replace(/\//g, '-');
  return [
    '[package]',
    `name = "${safeName}"`,
    'version = "0.1.0"',
    'edition = "2021"',
    'description = "Auto-generated Rust SDK client — COPF Interface Kit"',
    '',
    '[dependencies]',
    'reqwest = { version = "0.12", features = ["json"] }',
    'serde = { version = "1", features = ["derive"] }',
    'serde_json = "1"',
    'tokio = { version = "1", features = ["full"] }',
    '',
  ].join('\n');
}

function generateLibRs(projections: ProjectionEntry[]): string {
  const lines: string[] = [
    '// Auto-generated by COPF Interface Kit — rust-sdk target',
    '// Crate root: re-exports all concept client modules',
    '',
  ];

  for (const proj of projections) {
    const snakeName = toSnakeCase(proj.conceptName);
    lines.push(`pub mod ${snakeName};`);
  }

  lines.push('');
  lines.push('// Re-export all client types at crate root');
  for (const proj of projections) {
    const snakeName = toSnakeCase(proj.conceptName);
    const clientName = `${toPascalCase(proj.conceptName)}Client`;
    lines.push(`pub use ${snakeName}::${clientName};`);
  }

  lines.push('');
  return lines.join('\n');
}

// --- Concept Handler ---

export const rustSdkTargetHandler: ConceptHandler = {
  /**
   * Generate Rust SDK client files from ConceptManifest projections.
   *
   * Input fields:
   *   - projection:     JSON string containing { conceptManifest, conceptName }
   *   - config:         JSON string of SDK config (packageName, etc.)
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

    const packageName = (config.packageName as string) || 'copf-sdk';

    // --- Validate manifest ---
    if (!manifest.actions || manifest.actions.length === 0) {
      return { variant: 'ok', files: [], package: packageName };
    }

    // --- Generate concept client file ---
    const files: GeneratedFile[] = [];
    const { content, fileName } = generateClientFile(manifest);
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

        files.push({ path: 'Cargo.toml', content: generateCargoToml(packageName) });
        files.push({ path: 'src/lib.rs', content: generateLibRs(allProjections) });
      }
    }

    return { variant: 'ok', files, package: packageName };
  },
};
