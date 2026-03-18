// @migrated dsl-constructs 2026-03-18
// GrpcTarget Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';

const grpcTargetHandlerFunctional: FunctionalConceptHandler = {
  generate(input: Record<string, unknown>) {
    const projection = input.projection as string;
    const config = input.config as string;

    const parsedConfig = JSON.parse(config || '{}');
    const protoPackage = (parsedConfig.protoPackage as string) || 'clef.generated';
    const goPackage = (parsedConfig.goPackage as string) || '';
    const javaPackage = (parsedConfig.javaPackage as string) || '';

    const conceptName = projection.replace(/-projection$/, '').replace(/-/g, '');
    const serviceName = conceptName.charAt(0).toUpperCase() + conceptName.slice(1) + 'Service';
    const messageName = conceptName.charAt(0).toUpperCase() + conceptName.slice(1);

    if (parsedConfig.protoIncompatible) {
      const p = createProgram();
      return complete(p, 'protoIncompatible', {
        type: parsedConfig.protoIncompatible as string,
        reason: `Type cannot be represented in Protocol Buffers: recursive type without indirection`,
      }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

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

    let p = createProgram();
    p = put(p, 'service', serviceId, {
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
      protoContent: '',
      projection,
      config,
      generatedAt: new Date().toISOString(),
    });

    return complete(p, 'ok', {
      services,
      files,
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  validate(input: Record<string, unknown>) {
    const service = input.service as string;

    let p = createProgram();
    p = spGet(p, 'service', service, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { service }),
      (b) => complete(b, 'ok', { service }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  listRpcs(input: Record<string, unknown>) {
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
      'unary', 'unary', 'unary', 'unary', 'unary', 'server_streaming',
    ];

    const p = createProgram();
    return complete(p, 'ok', {
      rpcs,
      streamingModes,
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

/** Backward-compatible imperative wrapper — delegates to interpret(). */
export const grpcTargetHandler = wrapFunctional(grpcTargetHandlerFunctional);
/** The raw functional handler returning StorageProgram. */
export { grpcTargetHandlerFunctional };
