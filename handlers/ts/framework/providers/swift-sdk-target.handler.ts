// ============================================================
// Swift SDK Target Provider — Clef Bind
//
// Generates Swift client classes from ConceptManifest data.
// Each concept produces a {PascalName}Client.swift file with
// typed async methods using URLSession. Package-level files
// are generated when allProjections is provided.
// Architecture doc: Clef Bind
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
  typeToSwift,
  toKebabCase,
  toPascalCase,
  toCamelCase,
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

// --- Swift Struct Generation ---

/**
 * Generate a Swift Codable struct for input/output types.
 */
function generateSwiftStruct(name: string, params: ActionParamSchema[], indent: string): string {
  if (params.length === 0) {
    return `${indent}public struct ${name}: Codable {}`;
  }

  const lines: string[] = [];
  lines.push(`${indent}public struct ${name}: Codable {`);

  for (const p of params) {
    const swiftType = typeToSwift(p.type);
    const propName = toCamelCase(p.name);
    lines.push(`${indent}    public let ${propName}: ${swiftType}`);
  }

  // CodingKeys enum for JSON field mapping
  const needsCodingKeys = params.some((p) => toCamelCase(p.name) !== p.name);
  if (needsCodingKeys) {
    lines.push('');
    lines.push(`${indent}    enum CodingKeys: String, CodingKey {`);
    for (const p of params) {
      const propName = toCamelCase(p.name);
      if (propName !== p.name) {
        lines.push(`${indent}        case ${propName} = "${p.name}"`);
      } else {
        lines.push(`${indent}        case ${propName}`);
      }
    }
    lines.push(`${indent}    }`);
  }

  lines.push(`${indent}}`);
  return lines.join('\n');
}

// --- Client Method Generation ---

/**
 * Generate a single async method for the Swift client class.
 */
function generateMethod(
  action: ActionSchema,
  basePath: string,
  conceptName: string,
  indent: string,
): string {
  const route = inferHttpRoute(action.name, basePath);
  const methodName = toCamelCase(action.name);
  const inputStructName = `${toPascalCase(action.name)}Input`;
  const outputStructName = `${toPascalCase(action.name)}Output`;
  const lines: string[] = [];

  if (route.method === 'GET' || route.method === 'DELETE') {
    if (route.path.includes('{id}')) {
      lines.push(`${indent}/// ${action.name} — ${route.method} ${route.path}`);
      lines.push(`${indent}public func ${methodName}(id: String) async throws -> ${outputStructName} {`);
      lines.push(`${indent}    let path = "${route.path}".replacingOccurrences(of: "{id}", with: id)`);
      lines.push(`${indent}    let url = baseURL.appendingPathComponent(path)`);
    } else {
      lines.push(`${indent}/// ${action.name} — ${route.method} ${route.path}`);
      lines.push(`${indent}public func ${methodName}() async throws -> ${outputStructName} {`);
      lines.push(`${indent}    let url = baseURL.appendingPathComponent("${route.path}")`);
    }
    lines.push(`${indent}    var request = URLRequest(url: url)`);
    lines.push(`${indent}    request.httpMethod = "${route.method}"`);
    lines.push(`${indent}    for (key, value) in headers {`);
    lines.push(`${indent}        request.setValue(value, forHTTPHeaderField: key)`);
    lines.push(`${indent}    }`);
  } else {
    // POST / PUT — JSON body
    lines.push(`${indent}/// ${action.name} — ${route.method} ${route.path}`);
    lines.push(`${indent}public func ${methodName}(input: ${inputStructName}) async throws -> ${outputStructName} {`);
    if (route.path.includes('{id}')) {
      lines.push(`${indent}    let path = "${route.path}".replacingOccurrences(of: "{id}", with: "")`);
      lines.push(`${indent}    let url = baseURL.appendingPathComponent(path)`);
    } else {
      lines.push(`${indent}    let url = baseURL.appendingPathComponent("${route.path}")`);
    }
    lines.push(`${indent}    var request = URLRequest(url: url)`);
    lines.push(`${indent}    request.httpMethod = "${route.method}"`);
    lines.push(`${indent}    request.setValue("application/json", forHTTPHeaderField: "Content-Type")`);
    lines.push(`${indent}    for (key, value) in headers {`);
    lines.push(`${indent}        request.setValue(value, forHTTPHeaderField: key)`);
    lines.push(`${indent}    }`);
    lines.push(`${indent}    request.httpBody = try encoder.encode(input)`);
  }

  // Common response handling
  lines.push(`${indent}    let (data, response) = try await URLSession.shared.data(for: request)`);
  lines.push(`${indent}    guard let httpResponse = response as? HTTPURLResponse else {`);
  lines.push(`${indent}        throw ClientError.invalidResponse`);
  lines.push(`${indent}    }`);
  lines.push(`${indent}    guard httpResponse.statusCode < 400 else {`);
  lines.push(`${indent}        let body = String(data: data, encoding: .utf8) ?? ""`);
  lines.push(`${indent}        throw ClientError.apiError(status: httpResponse.statusCode, body: body)`);
  lines.push(`${indent}    }`);
  lines.push(`${indent}    return try decoder.decode(${outputStructName}.self, from: data)`);
  lines.push(`${indent}}`);

  return lines.join('\n');
}

// --- Full Client File Generation ---

/**
 * Generate the complete Swift client file for a single concept.
 */
function generateClientFile(manifest: ConceptManifest): { content: string; fileName: string } {
  const conceptName = manifest.name;
  const className = `${toPascalCase(conceptName)}Client`;
  const basePath = `/api/${toKebabCase(manifest.name)}s`;

  const header = `// Auto-generated by Clef Clef Bind — swift-sdk target\n// Concept: ${manifest.name}\n// Do not edit manually; regenerate with: clef interface generate`;

  // Generate input/output structs
  const structDefs: string[] = [];
  for (const action of manifest.actions) {
    const inputStructName = `${toPascalCase(action.name)}Input`;
    structDefs.push(generateSwiftStruct(inputStructName, action.params, '    '));

    const outputFields = action.variants.length > 0 ? action.variants[0].fields : [];
    const outputStructName = `${toPascalCase(action.name)}Output`;
    structDefs.push(generateSwiftStruct(outputStructName, outputFields, '    '));
  }

  // Generate methods
  const methods = manifest.actions.map((a) => generateMethod(a, basePath, conceptName, '    '));

  const body = [
    header,
    '',
    'import Foundation',
    '',
    '// --- Error Type ---',
    '',
    'public enum ClientError: Error, LocalizedError {',
    '    case invalidResponse',
    '    case apiError(status: Int, body: String)',
    '',
    '    public var errorDescription: String? {',
    '        switch self {',
    '        case .invalidResponse:',
    '            return "Invalid HTTP response"',
    '        case .apiError(let status, let body):',
    '            return "API error \\(status): \\(body)"',
    '        }',
    '    }',
    '}',
    '',
    `// --- ${className} ---`,
    '',
    `public class ${className} {`,
    '',
    '    let baseURL: URL',
    '    var headers: [String: String]',
    '    private let encoder = JSONEncoder()',
    '    private let decoder = JSONDecoder()',
    '',
    `    public init(baseURL: URL, headers: [String: String] = [:]) {`,
    '        self.baseURL = baseURL',
    '        self.headers = headers',
    '    }',
    '',
    '    // --- Request/Response Types ---',
    '',
    structDefs.join('\n\n'),
    '',
    '    // --- Client Methods ---',
    '',
    methods.join('\n\n'),
    '}',
    '',
  ].join('\n');

  return { content: body, fileName: `${className}.swift` };
}

// --- Package-Level File Generation ---

function generatePackageSwift(packageName: string, projections: ProjectionEntry[]): string {
  const safeName = packageName.replace(/@/g, '').replace(/\//g, '-');
  const lines: string[] = [
    '// swift-tools-version: 5.9',
    '// Auto-generated by Clef Clef Bind — swift-sdk target',
    '',
    'import PackageDescription',
    '',
    'let package = Package(',
    `    name: "${safeName}",`,
    '    platforms: [',
    '        .macOS(.v13),',
    '        .iOS(.v16),',
    '    ],',
    '    products: [',
    `        .library(name: "${safeName}", targets: ["${safeName}"]),`,
    '    ],',
    '    targets: [',
    `        .target(`,
    `            name: "${safeName}",`,
    `            path: "Sources"`,
    `        ),`,
    '    ]',
    ')',
    '',
  ];
  return lines.join('\n');
}

// --- Concept Handler ---

export const swiftSdkTargetHandler: ConceptHandler = {
  async register() {
    return {
      variant: 'ok',
      name: 'SwiftSdkTarget',
      inputKind: 'InterfaceProjection',
      outputKind: 'SwiftSdk',
      capabilities: JSON.stringify(['client', 'types', 'package']),
      targetKey: 'swift',
      providerType: 'sdk',
    };
  },

  /**
   * Generate Swift SDK client files from ConceptManifest projections.
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

    const packageName = (config.packageName as string) || 'ClefClient';

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

        files.push({ path: 'Package.swift', content: generatePackageSwift(packageName, allProjections) });
      }
    }

    return { variant: 'ok', files, package: packageName };
  },
};
