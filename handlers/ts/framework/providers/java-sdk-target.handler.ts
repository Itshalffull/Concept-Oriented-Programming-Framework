// ============================================================
// Java SDK Target Provider — Clef Bind
//
// Generates Java client classes from ConceptManifest data.
// Each concept produces a {PascalName}Client.java file with
// typed methods using java.net.http. Package-level files are
// generated when allProjections is provided.
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
  typeToJava,
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

// --- Java Type Generation ---

/**
 * Generate a Java inner static class for input/output types.
 */
function generateJavaInnerClass(name: string, params: ActionParamSchema[], indent: string): string {
  if (params.length === 0) {
    return `${indent}public static class ${name} {}`;
  }

  const lines: string[] = [];
  lines.push(`${indent}public static class ${name} {`);

  // Fields
  for (const p of params) {
    const javaType = typeToJava(p.type);
    lines.push(`${indent}    private ${javaType} ${toCamelCase(p.name)};`);
  }

  lines.push('');

  // Default constructor
  lines.push(`${indent}    public ${name}() {}`);
  lines.push('');

  // Getters and setters
  for (const p of params) {
    const javaType = typeToJava(p.type);
    const fieldName = toCamelCase(p.name);
    const pascalField = toPascalCase(p.name);
    lines.push(`${indent}    public ${javaType} get${pascalField}() { return this.${fieldName}; }`);
    lines.push(`${indent}    public void set${pascalField}(${javaType} ${fieldName}) { this.${fieldName} = ${fieldName}; }`);
  }

  lines.push(`${indent}}`);
  return lines.join('\n');
}

// --- Client Method Generation ---

/**
 * Generate a single method for the Java client class.
 */
function generateMethod(
  action: ActionSchema,
  basePath: string,
  conceptName: string,
  indent: string,
): string {
  const route = inferHttpRoute(action.name, basePath);
  const methodName = toCamelCase(action.name);
  const inputClassName = `${toPascalCase(action.name)}Input`;
  const outputClassName = `${toPascalCase(action.name)}Output`;
  const lines: string[] = [];

  if (route.method === 'GET' || route.method === 'DELETE') {
    if (route.path.includes('{id}')) {
      lines.push(`${indent}/**`);
      lines.push(`${indent} * ${action.name} — ${route.method} ${route.path}`);
      lines.push(`${indent} */`);
      lines.push(`${indent}public ${outputClassName} ${methodName}(String id) throws Exception {`);
      lines.push(`${indent}    String url = this.baseUrl + "${route.path}".replace("{id}", id);`);
      lines.push(`${indent}    HttpRequest request = HttpRequest.newBuilder()`);
      lines.push(`${indent}        .uri(URI.create(url))`);
      lines.push(`${indent}        .method("${route.method}", HttpRequest.BodyPublishers.noBody())`);
      lines.push(`${indent}        .headers(flatHeaders())`);
      lines.push(`${indent}        .build();`);
    } else {
      lines.push(`${indent}/**`);
      lines.push(`${indent} * ${action.name} — ${route.method} ${route.path}`);
      lines.push(`${indent} */`);
      lines.push(`${indent}public ${outputClassName} ${methodName}() throws Exception {`);
      lines.push(`${indent}    String url = this.baseUrl + "${route.path}";`);
      lines.push(`${indent}    HttpRequest request = HttpRequest.newBuilder()`);
      lines.push(`${indent}        .uri(URI.create(url))`);
      lines.push(`${indent}        .method("${route.method}", HttpRequest.BodyPublishers.noBody())`);
      lines.push(`${indent}        .headers(flatHeaders())`);
      lines.push(`${indent}        .build();`);
    }
  } else {
    // POST / PUT — JSON body
    lines.push(`${indent}/**`);
    lines.push(`${indent} * ${action.name} — ${route.method} ${route.path}`);
    lines.push(`${indent} */`);
    lines.push(`${indent}public ${outputClassName} ${methodName}(${inputClassName} input) throws Exception {`);
    if (route.path.includes('{id}')) {
      lines.push(`${indent}    String url = this.baseUrl + "${route.path}".replace("{id}", "");`);
    } else {
      lines.push(`${indent}    String url = this.baseUrl + "${route.path}";`);
    }
    lines.push(`${indent}    String body = mapper.writeValueAsString(input);`);
    lines.push(`${indent}    HttpRequest request = HttpRequest.newBuilder()`);
    lines.push(`${indent}        .uri(URI.create(url))`);
    lines.push(`${indent}        .method("${route.method}", HttpRequest.BodyPublishers.ofString(body))`);
    lines.push(`${indent}        .header("Content-Type", "application/json")`);
    lines.push(`${indent}        .headers(flatHeaders())`);
    lines.push(`${indent}        .build();`);
  }

  // Common response handling
  lines.push(`${indent}    HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());`);
  lines.push(`${indent}    if (response.statusCode() >= 400) {`);
  lines.push(`${indent}        throw new Exception("${methodName} failed with status " + response.statusCode() + ": " + response.body());`);
  lines.push(`${indent}    }`);
  lines.push(`${indent}    return mapper.readValue(response.body(), ${outputClassName}.class);`);
  lines.push(`${indent}}`);

  return lines.join('\n');
}

// --- Full Client File Generation ---

/**
 * Generate the complete Java client file for a single concept.
 */
function generateClientFile(manifest: ConceptManifest, javaPackage: string): { content: string; fileName: string } {
  const conceptName = manifest.name;
  const className = `${toPascalCase(conceptName)}Client`;
  const basePath = `/api/${toKebabCase(manifest.name)}s`;

  const header = `// Auto-generated by Clef Clef Bind — java-sdk target\n// Concept: ${manifest.name}\n// Do not edit manually; regenerate with: clef interface generate`;

  // Generate inner classes for input/output types
  const innerClasses: string[] = [];
  for (const action of manifest.actions) {
    const inputClassName = `${toPascalCase(action.name)}Input`;
    innerClasses.push(generateJavaInnerClass(inputClassName, action.params, '    '));

    const outputFields = action.variants.length > 0 ? action.variants[0].fields : [];
    const outputClassName = `${toPascalCase(action.name)}Output`;
    innerClasses.push(generateJavaInnerClass(outputClassName, outputFields, '    '));
  }

  // Generate methods
  const methods = manifest.actions.map((a) => generateMethod(a, basePath, conceptName, '    '));

  const body = [
    header,
    `package ${javaPackage};`,
    '',
    'import java.net.URI;',
    'import java.net.http.HttpClient;',
    'import java.net.http.HttpRequest;',
    'import java.net.http.HttpResponse;',
    'import java.util.*;',
    'import com.fasterxml.jackson.databind.ObjectMapper;',
    '',
    `public class ${className} {`,
    '',
    '    private final String baseUrl;',
    '    private final Map<String, String> headers;',
    '    private final HttpClient client;',
    '    private final ObjectMapper mapper;',
    '',
    `    public ${className}(String baseUrl) {`,
    '        this(baseUrl, new HashMap<>());',
    '    }',
    '',
    `    public ${className}(String baseUrl, Map<String, String> headers) {`,
    '        this.baseUrl = baseUrl;',
    '        this.headers = headers;',
    '        this.client = HttpClient.newHttpClient();',
    '        this.mapper = new ObjectMapper();',
    '    }',
    '',
    '    private String[] flatHeaders() {',
    '        List<String> flat = new ArrayList<>();',
    '        for (Map.Entry<String, String> entry : headers.entrySet()) {',
    '            flat.add(entry.getKey());',
    '            flat.add(entry.getValue());',
    '        }',
    '        return flat.toArray(new String[0]);',
    '    }',
    '',
    '    // --- Request/Response Types ---',
    '',
    innerClasses.join('\n\n'),
    '',
    '    // --- Client Methods ---',
    '',
    methods.join('\n\n'),
    '}',
    '',
  ].join('\n');

  return { content: body, fileName: `${className}.java` };
}

// --- Package-Level File Generation ---

function generatePomXml(groupId: string, artifactId: string): string {
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!-- Auto-generated by Clef Clef Bind — java-sdk target -->',
    '<project xmlns="http://maven.apache.org/POM/4.0.0"',
    '         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
    '         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">',
    '    <modelVersion>4.0.0</modelVersion>',
    '',
    `    <groupId>${groupId}</groupId>`,
    `    <artifactId>${artifactId}</artifactId>`,
    '    <version>0.1.0</version>',
    '    <packaging>jar</packaging>',
    '',
    '    <name>Clef SDK Client</name>',
    '    <description>Auto-generated Java SDK client — Clef Clef Bind</description>',
    '',
    '    <properties>',
    '        <maven.compiler.source>17</maven.compiler.source>',
    '        <maven.compiler.target>17</maven.compiler.target>',
    '        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>',
    '    </properties>',
    '',
    '    <dependencies>',
    '        <dependency>',
    '            <groupId>com.fasterxml.jackson.core</groupId>',
    '            <artifactId>jackson-databind</artifactId>',
    '            <version>2.17.0</version>',
    '        </dependency>',
    '    </dependencies>',
    '</project>',
    '',
  ].join('\n');
}

// --- Concept Handler ---

export const javaSdkTargetHandler: ConceptHandler = {
  async register() {
    return {
      variant: 'ok',
      name: 'JavaSdkTarget',
      inputKind: 'InterfaceProjection',
      outputKind: 'JavaSdk',
      capabilities: JSON.stringify(['client', 'types', 'pom']),
      targetKey: 'java',
      providerType: 'sdk',
    };
  },

  /**
   * Generate Java SDK client files from ConceptManifest projections.
   *
   * Input fields:
   *   - projection:     JSON string containing { conceptManifest, conceptName }
   *   - config:         JSON string of SDK config (packageName, groupId, artifactId, etc.)
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

    const packageName = (config.packageName as string) || 'com.clef.client';
    const groupId = (config.groupId as string) || 'com.clef';
    const artifactId = (config.artifactId as string) || 'clef-sdk-java';

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

        files.push({ path: 'pom.xml', content: generatePomXml(groupId, artifactId) });
      }
    }

    return { variant: 'ok', files, package: packageName };
  },
};
