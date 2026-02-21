// Target Concept Implementation (Interface Kit)
import type { ConceptHandler } from '@copf/kernel';

function computeHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const ch = content.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export const targetHandler: ConceptHandler = {
  async generate(input, storage) {
    const projection = input.projection as string;
    const targetType = input.targetType as string;
    const config = input.config as string;

    // Parse config
    let configData: Record<string, unknown>;
    try {
      configData = JSON.parse(config);
    } catch {
      configData = {};
    }

    // Validate target type is supported
    const supportedTargets = ['rest', 'graphql', 'grpc', 'cli', 'mcp'];
    if (!supportedTargets.includes(targetType) && !configData.customProvider) {
      return {
        variant: 'targetError',
        targetType,
        reason: `Unsupported target type: "${targetType}". Supported: ${supportedTargets.join(', ')}`,
      };
    }

    // Generate output files based on target type
    const files: Array<{ path: string; hash: string; sizeBytes: number }> = [];
    const baseDir = `generated/${targetType}`;

    if (targetType === 'rest') {
      const routerContent = `// REST routes for ${projection}`;
      files.push({ path: `${baseDir}/router.ts`, hash: computeHash(routerContent), sizeBytes: routerContent.length });
      const typesContent = `// REST types for ${projection}`;
      files.push({ path: `${baseDir}/types.ts`, hash: computeHash(typesContent), sizeBytes: typesContent.length });
      const handlersContent = `// REST handlers for ${projection}`;
      files.push({ path: `${baseDir}/handlers.ts`, hash: computeHash(handlersContent), sizeBytes: handlersContent.length });
    } else if (targetType === 'graphql') {
      const schemaContent = `# GraphQL schema for ${projection}`;
      files.push({ path: `${baseDir}/schema.graphql`, hash: computeHash(schemaContent), sizeBytes: schemaContent.length });
      const resolversContent = `// GraphQL resolvers for ${projection}`;
      files.push({ path: `${baseDir}/resolvers.ts`, hash: computeHash(resolversContent), sizeBytes: resolversContent.length });
    } else if (targetType === 'grpc') {
      const protoContent = `// gRPC proto for ${projection}`;
      files.push({ path: `${baseDir}/service.proto`, hash: computeHash(protoContent), sizeBytes: protoContent.length });
      const serverContent = `// gRPC server for ${projection}`;
      files.push({ path: `${baseDir}/server.ts`, hash: computeHash(serverContent), sizeBytes: serverContent.length });
    } else if (targetType === 'cli') {
      const commandsContent = `// CLI commands for ${projection}`;
      files.push({ path: `${baseDir}/commands.ts`, hash: computeHash(commandsContent), sizeBytes: commandsContent.length });
    } else if (targetType === 'mcp') {
      const toolsContent = `// MCP tools for ${projection}`;
      files.push({ path: `${baseDir}/tools.ts`, hash: computeHash(toolsContent), sizeBytes: toolsContent.length });
      const resourcesContent = `// MCP resources for ${projection}`;
      files.push({ path: `${baseDir}/resources.ts`, hash: computeHash(resourcesContent), sizeBytes: resourcesContent.length });
    }

    const outputId = `output-${targetType}-${projection}-${Date.now()}`;
    const now = new Date().toISOString();

    // Check for previous generation for this concept + target
    const allOutputs = await storage.find('output');
    const previousOutput = allOutputs.find(
      (o) => o.targetType === targetType && o.projection === projection && o.outputId !== outputId,
    );

    await storage.put('output', outputId, {
      outputId,
      targetType,
      concept: projection,
      projection,
      generatedAt: now,
      fileCount: files.length,
      files: JSON.stringify(files),
      previous: previousOutput
        ? JSON.stringify({
            generatedAt: previousOutput.generatedAt,
            fileCount: previousOutput.fileCount,
            hash: computeHash(previousOutput.files as string),
          })
        : '',
    });

    const filePaths = files.map((f) => f.path);

    return {
      variant: 'ok',
      output: outputId,
      files: JSON.stringify(filePaths),
    };
  },

  async diff(input, storage) {
    const output = input.output as string;

    const existing = await storage.get('output', output);
    if (!existing) {
      return { variant: 'noPrevious', output };
    }

    const previousStr = existing.previous as string;
    if (!previousStr || previousStr === '') {
      return { variant: 'noPrevious', output };
    }

    // Parse current and previous file lists
    const currentFiles = JSON.parse(existing.files as string) as Array<{ path: string; hash: string }>;
    const currentFileMap = new Map(currentFiles.map((f) => [f.path, f.hash]));

    // Find previous output to compare against
    const allOutputs = await storage.find('output');
    const targetType = existing.targetType as string;
    const projection = existing.projection as string;
    const previousOutputs = allOutputs.filter(
      (o) =>
        o.targetType === targetType &&
        o.projection === projection &&
        o.outputId !== output,
    );

    if (previousOutputs.length === 0) {
      return { variant: 'noPrevious', output };
    }

    const prev = previousOutputs[previousOutputs.length - 1];
    const prevFiles = JSON.parse(prev.files as string) as Array<{ path: string; hash: string }>;
    const prevFileMap = new Map(prevFiles.map((f) => [f.path, f.hash]));

    const added: string[] = [];
    const removed: string[] = [];
    const changed: string[] = [];

    // Files in current but not in previous
    for (const [path, hash] of currentFileMap) {
      if (!prevFileMap.has(path)) {
        added.push(path);
      } else if (prevFileMap.get(path) !== hash) {
        changed.push(path);
      }
    }

    // Files in previous but not in current
    for (const path of prevFileMap.keys()) {
      if (!currentFileMap.has(path)) {
        removed.push(path);
      }
    }

    return {
      variant: 'ok',
      output,
      added: JSON.stringify(added),
      removed: JSON.stringify(removed),
      changed: JSON.stringify(changed),
    };
  },
};
