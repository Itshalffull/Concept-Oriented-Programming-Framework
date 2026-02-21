// GrpcTarget Concept Implementation
import type { ConceptHandler } from '@copf/kernel';

export const grpcTargetHandler: ConceptHandler = {
  async generate(input, storage) {
    const projection = input.projection as string;
    const config = input.config as string;

    const parsedConfig = JSON.parse(config || '{}');
    const protoPackage = (parsedConfig.protoPackage as string) || 'copf.generated';
    const goPackage = (parsedConfig.goPackage as string) || '';
    const javaPackage = (parsedConfig.javaPackage as string) || '';

    const conceptName = projection.replace(/-projection$/, '').replace(/-/g, '');
    const serviceName = conceptName.charAt(0).toUpperCase() + conceptName.slice(1) + 'Service';
    const messageName = conceptName.charAt(0).toUpperCase() + conceptName.slice(1);

    // Check for proto-incompatible types
    if (parsedConfig.protoIncompatible) {
      return {
        variant: 'protoIncompatible',
        type: parsedConfig.protoIncompatible as string,
        reason: `Type cannot be represented in Protocol Buffers: recursive type without indirection`,
      };
    }

    const optionLines: string[] = [];
    if (goPackage) {
      optionLines.push(`option go_package = "${goPackage}";`);
    }
    if (javaPackage) {
      optionLines.push(`option java_package = "${javaPackage}";`);
    }

    const protoContent = [
      `syntax = "proto3";`,
      ``,
      `package ${protoPackage};`,
      ``,
      ...optionLines,
      optionLines.length > 0 ? `` : '',
      `// Generated from projection: ${projection}`,
      ``,
      `message ${messageName} {`,
      `  string id = 1;`,
      `  string name = 2;`,
      `  string created_at = 3;`,
      `  string updated_at = 4;`,
      `}`,
      ``,
      `message Create${messageName}Request {`,
      `  string name = 1;`,
      `}`,
      ``,
      `message Get${messageName}Request {`,
      `  string id = 1;`,
      `}`,
      ``,
      `message List${messageName}Request {`,
      `  int32 page_size = 1;`,
      `  string page_token = 2;`,
      `}`,
      ``,
      `message List${messageName}Response {`,
      `  repeated ${messageName} items = 1;`,
      `  string next_page_token = 2;`,
      `}`,
      ``,
      `message Update${messageName}Request {`,
      `  string id = 1;`,
      `  string name = 2;`,
      `}`,
      ``,
      `message Delete${messageName}Request {`,
      `  string id = 1;`,
      `}`,
      ``,
      `message Delete${messageName}Response {`,
      `  bool success = 1;`,
      `}`,
      ``,
      `message Stream${messageName}Request {`,
      `  string filter = 1;`,
      `}`,
      ``,
      `service ${serviceName} {`,
      `  rpc Create${messageName}(Create${messageName}Request) returns (${messageName});`,
      `  rpc Get${messageName}(Get${messageName}Request) returns (${messageName});`,
      `  rpc List${messageName}(List${messageName}Request) returns (List${messageName}Response);`,
      `  rpc Update${messageName}(Update${messageName}Request) returns (${messageName});`,
      `  rpc Delete${messageName}(Delete${messageName}Request) returns (Delete${messageName}Response);`,
      `  rpc Stream${messageName}(Stream${messageName}Request) returns (stream ${messageName});`,
      `}`,
    ].join('\n');

    const services = [serviceName];
    const files = [
      `proto/${conceptName}.proto`,
      `gen/go/${conceptName}_grpc.pb.go`,
      `gen/go/${conceptName}.pb.go`,
    ];
    if (javaPackage) {
      files.push(`gen/java/${messageName}ServiceGrpc.java`);
    }

    const serviceId = `grpc-${conceptName}-${Date.now()}`;

    await storage.put('service', serviceId, {
      serviceId,
      protoPackage,
      goPackage,
      javaPackage,
      concept: conceptName,
      serviceName,
      rpcName: `Create${messageName}`,
      streamingMode: 'server_streaming',
      services: JSON.stringify(services),
      files: JSON.stringify(files),
      protoContent,
      projection,
      config,
      generatedAt: new Date().toISOString(),
    });

    return {
      variant: 'ok',
      services,
      files,
    };
  },

  async validate(input, storage) {
    const service = input.service as string;

    const existing = await storage.get('service', service);
    if (!existing) {
      return { variant: 'ok', service };
    }

    // Check for field number conflicts
    const protoContent = existing.protoContent as string;
    const fieldNumberPattern = /=\s*(\d+);/g;
    const fieldNumbers = new Map<string, Set<number>>();
    let currentMessage = '';
    const lines = protoContent.split('\n');

    for (const line of lines) {
      const messageMatch = line.match(/message\s+(\w+)/);
      if (messageMatch) {
        currentMessage = messageMatch[1];
        fieldNumbers.set(currentMessage, new Set());
      }
      const fieldMatch = line.match(/\s+\w+\s+\w+\s+=\s+(\d+);/);
      if (fieldMatch && currentMessage) {
        const num = parseInt(fieldMatch[1], 10);
        const msgFields = fieldNumbers.get(currentMessage)!;
        if (msgFields.has(num)) {
          return {
            variant: 'fieldNumberConflict',
            service,
            message: currentMessage,
            field: `field number ${num}`,
          };
        }
        msgFields.add(num);
      }
    }

    return { variant: 'ok', service };
  },

  async listRpcs(input, storage) {
    const concept = input.concept as string;
    const messageName = concept.charAt(0).toUpperCase() + concept.slice(1);

    const rpcs = [
      `Create${messageName}`,
      `Get${messageName}`,
      `List${messageName}`,
      `Update${messageName}`,
      `Delete${messageName}`,
      `Stream${messageName}`,
    ];

    const streamingModes = [
      'unary',
      'unary',
      'unary',
      'unary',
      'unary',
      'server_streaming',
    ];

    return {
      variant: 'ok',
      rpcs,
      streamingModes,
    };
  },
};
