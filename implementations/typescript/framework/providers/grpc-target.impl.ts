// ============================================================
// gRPC Target Provider Handler
//
// Generates proto3 service definitions from concept projections.
// Each concept produces a single .proto file containing the
// service definition and all request/response messages.
// Architecture doc: Interface Kit
// ============================================================

import type { ConceptHandler, ConceptStorage, ConceptManifest, ActionSchema, ActionParamSchema } from '../../../../kernel/src/types.js';
import { toKebabCase, toPascalCase, typeToProtobuf, generateFileHeader, getHierarchicalTrait } from './codegen-utils.js';
import type { HierarchicalConfig } from './codegen-utils.js';

// --- Proto Field Type Resolution ---

/**
 * Resolve a param's protobuf type, stripping the "repeated" / "optional"
 * qualifiers so they can be emitted at the field level.
 */
function protoFieldType(param: ActionParamSchema): string {
  const raw = typeToProtobuf(param.type);
  // typeToProtobuf may prefix with "repeated " or "optional " — strip for
  // inline field declarations since the qualifier is emitted separately.
  return raw.replace(/^(repeated|optional)\s+/, '');
}

/**
 * Return the protobuf qualifier (empty, "repeated", or "optional") for a param.
 */
function protoQualifier(param: ActionParamSchema): string {
  const raw = typeToProtobuf(param.type);
  if (raw.startsWith('repeated ')) return 'repeated ';
  if (raw.startsWith('optional ')) return 'optional ';
  return '';
}

// --- Message Builder ---

function buildMessage(name: string, params: ActionParamSchema[]): string {
  const lines: string[] = [];
  lines.push(`message ${name} {`);
  params.forEach((p, i) => {
    const qualifier = protoQualifier(p);
    const fieldType = protoFieldType(p);
    lines.push(`  ${qualifier}${fieldType} ${p.name} = ${i + 1};`);
  });
  lines.push('}');
  return lines.join('\n');
}

// --- Generate Proto File ---

function generateProtoFile(
  manifest: ConceptManifest,
  packageName: string,
  hierConfig?: HierarchicalConfig,
): string {
  const conceptPascal = toPascalCase(manifest.name);
  const lines: string[] = [];

  lines.push(generateFileHeader('grpc', manifest.name));
  lines.push('syntax = "proto3";');
  lines.push(`package ${packageName};`);
  lines.push('');

  // Service definition
  lines.push(`service ${conceptPascal}Service {`);
  for (const action of manifest.actions) {
    const actionPascal = toPascalCase(action.name);
    lines.push(`  rpc ${actionPascal}(${actionPascal}${conceptPascal}Request) returns (${actionPascal}${conceptPascal}Response);`);
  }
  if (hierConfig) {
    lines.push(`  // @hierarchical — tree traversal RPCs`);
    lines.push(`  rpc ListChildren(ListChildren${conceptPascal}Request) returns (ListChildren${conceptPascal}Response);`);
    lines.push(`  rpc GetAncestors(GetAncestors${conceptPascal}Request) returns (GetAncestors${conceptPascal}Response);`);
  }
  lines.push('}');
  lines.push('');

  // Request and response messages
  for (const action of manifest.actions) {
    const actionPascal = toPascalCase(action.name);

    // Request message — uses action params
    lines.push(buildMessage(`${actionPascal}${conceptPascal}Request`, action.params));
    lines.push('');

    // Response message — union of all variant fields plus a variant tag
    const responseParams: ActionParamSchema[] = [
      { name: 'variant', type: { kind: 'primitive', primitive: 'String' } },
    ];

    // Collect unique fields across all variants
    const seen = new Set<string>();
    seen.add('variant');
    for (const v of action.variants) {
      for (const f of v.fields) {
        if (!seen.has(f.name)) {
          seen.add(f.name);
          responseParams.push(f);
        }
      }
    }

    lines.push(buildMessage(`${actionPascal}${conceptPascal}Response`, responseParams));
    lines.push('');
  }

  // Hierarchical messages when @hierarchical trait is present
  if (hierConfig) {
    // ListChildren RPC
    lines.push(`// @hierarchical — tree traversal RPCs`);
    lines.push(`message ListChildren${conceptPascal}Request {`);
    lines.push(`  string parent = 1;`);
    lines.push(`  optional int32 depth = 2;`);
    lines.push(`}`);
    lines.push('');
    lines.push(`message ListChildren${conceptPascal}Response {`);
    lines.push(`  repeated ${conceptPascal}Response children = 1;`);
    lines.push(`}`);
    lines.push('');

    // GetAncestors RPC
    lines.push(`message GetAncestors${conceptPascal}Request {`);
    lines.push(`  string id = 1;`);
    lines.push(`}`);
    lines.push('');
    lines.push(`message GetAncestors${conceptPascal}Response {`);
    lines.push(`  repeated ${conceptPascal}Response ancestors = 1;`);
    lines.push(`}`);
    lines.push('');
  }

  return lines.join('\n');
}

// --- Concept Handler ---

export const grpcTargetHandler: ConceptHandler = {
  async register() {
    return {
      variant: 'ok',
      name: 'GrpcTarget',
      inputKind: 'InterfaceProjection',
      outputKind: 'GrpcProto',
      capabilities: JSON.stringify(['proto3', 'service', 'hierarchical']),
      targetKey: 'grpc',
      providerType: 'target',
    };
  },

  /**
   * Generate proto3 service definitions for one or more concepts.
   *
   * Input projection contains the concept manifest (as nested JSON),
   * concept name, and target-specific config with an optional
   * `package` field.
   */
  async generate(
    input: Record<string, unknown>,
    _storage: ConceptStorage,
  ): Promise<{ variant: string; [key: string]: unknown }> {
    const projectionRaw = input.projection as string;
    const configRaw = input.config as string | undefined;

    if (!projectionRaw || typeof projectionRaw !== 'string') {
      return { variant: 'ok', files: [] };
    }

    let projection: Record<string, unknown>;
    try {
      projection = JSON.parse(projectionRaw);
    } catch {
      return { variant: 'ok', files: [] };
    }

    const manifestRaw = projection.conceptManifest as string | Record<string, unknown>;
    const conceptName = projection.conceptName as string;

    let manifest: ConceptManifest;
    if (typeof manifestRaw === 'string') {
      try {
        manifest = JSON.parse(manifestRaw) as ConceptManifest;
      } catch {
        return { variant: 'ok', files: [] };
      }
    } else {
      manifest = manifestRaw as ConceptManifest;
    }

    // Parse config for package name
    let packageName = 'app.v1';
    if (configRaw && typeof configRaw === 'string') {
      try {
        const config = JSON.parse(configRaw) as Record<string, unknown>;
        if (config.package && typeof config.package === 'string') {
          packageName = config.package;
        }
      } catch {
        // Use default package name
      }
    }

    let parsedManifestYaml: Record<string, unknown> | undefined;
    if (input.manifestYaml && typeof input.manifestYaml === 'string') {
      try {
        parsedManifestYaml = JSON.parse(input.manifestYaml) as Record<string, unknown>;
      } catch { /* ignore */ }
    }
    const hierConfig = getHierarchicalTrait(parsedManifestYaml, conceptName || manifest.name);

    const kebab = toKebabCase(conceptName || manifest.name);
    const protoContent = generateProtoFile(manifest, packageName, hierConfig);

    const files = [
      {
        path: `${kebab}/${kebab}.proto`,
        content: protoContent,
      },
    ];

    return { variant: 'ok', files };
  },
};
