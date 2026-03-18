// @migrated dsl-constructs 2026-03-18
// Target Concept Implementation (Clef Bind)
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, branch, complete, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

function computeHash(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) { const ch = content.charCodeAt(i); hash = ((hash << 5) - hash + ch) | 0; }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

export const targetHandler: FunctionalConceptHandler = {
  generate(input: Record<string, unknown>) {
    const projection = input.projection as string;
    const targetType = input.targetType as string;
    const config = input.config as string;
    let configData: Record<string, unknown>;
    try { configData = JSON.parse(config); } catch { configData = {}; }

    const supportedTargets = ['rest', 'graphql', 'grpc', 'cli', 'mcp'];
    if (!supportedTargets.includes(targetType) && !configData.customProvider) {
      let p = createProgram();
      return complete(p, 'targetError', { targetType, reason: `Unsupported target type: "${targetType}". Supported: ${supportedTargets.join(', ')}` }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const files: Array<{ path: string; hash: string; sizeBytes: number }> = [];
    const baseDir = `generated/${targetType}`;
    if (targetType === 'rest') {
      const r = `// REST routes for ${projection}`; files.push({ path: `${baseDir}/router.ts`, hash: computeHash(r), sizeBytes: r.length });
      const t = `// REST types for ${projection}`; files.push({ path: `${baseDir}/types.ts`, hash: computeHash(t), sizeBytes: t.length });
      const h = `// REST handlers for ${projection}`; files.push({ path: `${baseDir}/handlers.ts`, hash: computeHash(h), sizeBytes: h.length });
    } else if (targetType === 'graphql') {
      const s = `# GraphQL schema for ${projection}`; files.push({ path: `${baseDir}/schema.graphql`, hash: computeHash(s), sizeBytes: s.length });
      const r = `// GraphQL resolvers for ${projection}`; files.push({ path: `${baseDir}/resolvers.ts`, hash: computeHash(r), sizeBytes: r.length });
    } else if (targetType === 'grpc') {
      const pr = `// gRPC proto for ${projection}`; files.push({ path: `${baseDir}/service.proto`, hash: computeHash(pr), sizeBytes: pr.length });
      const sv = `// gRPC server for ${projection}`; files.push({ path: `${baseDir}/server.ts`, hash: computeHash(sv), sizeBytes: sv.length });
    } else if (targetType === 'cli') {
      const c = `// CLI commands for ${projection}`; files.push({ path: `${baseDir}/commands.ts`, hash: computeHash(c), sizeBytes: c.length });
    } else if (targetType === 'mcp') {
      const tl = `// MCP tools for ${projection}`; files.push({ path: `${baseDir}/tools.ts`, hash: computeHash(tl), sizeBytes: tl.length });
      const rs = `// MCP resources for ${projection}`; files.push({ path: `${baseDir}/resources.ts`, hash: computeHash(rs), sizeBytes: rs.length });
    }

    const outputId = `output-${targetType}-${projection}-${Date.now()}`;
    const now = new Date().toISOString();
    const filePaths = files.map((f) => f.path);

    let p = createProgram();
    p = put(p, 'output', outputId, { outputId, targetType, concept: projection, projection, generatedAt: now, fileCount: files.length, files: JSON.stringify(files), previous: '' });
    return complete(p, 'ok', { output: outputId, files: JSON.stringify(filePaths) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  diff(input: Record<string, unknown>) {
    const output = input.output as string;
    let p = createProgram();
    p = spGet(p, 'output', output, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const previousStr = existing.previous as string;
          return !previousStr || previousStr === '';
        }, 'noPrevious');
        b2 = branch(b2, (bindings) => !(bindings.noPrevious as boolean),
          (() => {
            let t = createProgram();
            return complete(t, 'ok', { output, added: '[]', removed: '[]', changed: '[]' });
          })(),
          (() => {
            let e = createProgram();
            return complete(e, 'noPrevious', { output });
          })(),
        );
        return b2;
      },
      (b) => complete(b, 'noPrevious', { output }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
