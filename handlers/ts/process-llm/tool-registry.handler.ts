// @clef-handler style=functional
// ToolRegistry Concept Implementation
// Register, version, and authorize tool schemas for LLM function/tool calling.
import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `tool-${++idCounter}`;
}

const _toolRegistryHandler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'ToolRegistry' }) as StorageProgram<Result>;
  },

  register_tool(input: Record<string, unknown>) {
    const name = input.name as string;
    const description = input.description as string;
    const schema = input.schema as string;

    if (!name || name.trim() === '') {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }

    // Validate schema is valid JSON
    try {
      JSON.parse(schema);
    } catch {
      return complete(createProgram(), 'ok', { message: 'Schema is not valid JSON Schema' }) as StorageProgram<Result>;
    }

    // Check if tool with this name already exists
    let p = createProgram();
    p = find(p, 'tool', { name }, 'existingTools');
    p = mapBindings(p, (bindings) => {
      const existing = (bindings.existingTools as Array<Record<string, unknown>>) || [];
      return existing.length > 0 ? existing[0] : null;
    }, '_existing');

    return branch(p,
      (bindings) => bindings._existing != null,
      (() => {
        // Increment version of existing tool
        let b = createProgram();
        b = find(b, 'tool', { name }, 'existingTools');
        b = mapBindings(b, (bindings) => {
          const existing = (bindings.existingTools as Array<Record<string, unknown>>) || [];
          return existing.length > 0 ? existing[0] : null;
        }, '_existing');
        b = putFrom(b, 'tool', '_placeholder', (bindings) => {
          const existing = bindings._existing as Record<string, unknown>;
          const newVersion = (existing.version as number) + 1;
          return {
            ...existing,
            description,
            schema,
            version: newVersion,
          };
        });
        b = mapBindings(b, (bindings) => {
          const existing = bindings._existing as Record<string, unknown>;
          return (existing.version as number) + 1;
        }, '_newVersion');
        b = mapBindings(b, (bindings) => {
          const existing = bindings._existing as Record<string, unknown>;
          return existing.tool as string;
        }, '_toolId');
        return completeFrom(b, 'ok', (bindings) => ({
          tool: bindings._toolId as string,
          version: bindings._newVersion as number,
        }));
      })(),
      (() => {
        // Register new tool
        const toolId = nextId();
        let b = createProgram();
        b = put(b, 'tool', toolId, {
          tool: toolId,
          name,
          version: 1,
          description,
          schema,
          status: 'active',
          allowed_models: ['*'],
          allowed_processes: ['*'],
        });
        return complete(b, 'ok', { tool: toolId, version: 1 }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  deprecate(input: Record<string, unknown>) {
    const toolId = input.tool as string;

    if (!toolId) {
      return complete(createProgram(), 'error', { message: 'tool is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'tool', toolId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      (() => complete(createProgram(), 'error', { message: 'tool not found' }))(),
      (() => {
        let b = createProgram();
        b = get(b, 'tool', toolId, 'existing');
        b = putFrom(b, 'tool', toolId, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { ...existing, status: 'deprecated' };
        });
        return complete(b, 'ok', { tool: toolId }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  disable(input: Record<string, unknown>) {
    const toolId = input.tool as string;

    if (!toolId) {
      return complete(createProgram(), 'error', { message: 'tool is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'tool', toolId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      (() => complete(createProgram(), 'error', { message: 'tool not found' }))(),
      (() => {
        let b = createProgram();
        b = get(b, 'tool', toolId, 'existing');
        b = putFrom(b, 'tool', toolId, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { ...existing, status: 'disabled' };
        });
        return complete(b, 'ok', { tool: toolId }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  authorize(input: Record<string, unknown>) {
    const toolId = input.tool as string;
    const model = input.model as string;
    const processRef = input.process_ref as string;

    if (!toolId) {
      return complete(createProgram(), 'error', { message: 'tool is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'tool', toolId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      (() => complete(createProgram(), 'error', { message: 'tool not found' }))(),
      (() => {
        let b = createProgram();
        b = get(b, 'tool', toolId, 'existing');
        b = putFrom(b, 'tool', toolId, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const allowedModels = [...(existing.allowed_models as string[])];
          const allowedProcesses = [...(existing.allowed_processes as string[])];
          if (!allowedModels.includes(model) && !allowedModels.includes('*')) {
            allowedModels.push(model);
          }
          if (!allowedProcesses.includes(processRef) && !allowedProcesses.includes('*')) {
            allowedProcesses.push(processRef);
          }
          return { ...existing, allowed_models: allowedModels, allowed_processes: allowedProcesses };
        });
        return complete(b, 'ok', { tool: toolId }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  check_access(input: Record<string, unknown>) {
    const toolId = input.tool as string;
    const model = input.model as string;
    const processRef = input.process_ref as string;

    if (!toolId) {
      return complete(createProgram(), 'error', { message: 'tool is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'tool', toolId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      (() => complete(createProgram(), 'denied', { tool: toolId, reason: 'tool not found' }))(),
      (() => {
        let b = createProgram();
        b = get(b, 'tool', toolId, 'existing');
        b = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const status = existing.status as string;
          if (status === 'disabled') return 'tool is disabled';
          if (status === 'deprecated') return 'tool is deprecated';
          const allowedModels = existing.allowed_models as string[];
          const allowedProcesses = existing.allowed_processes as string[];
          const modelOk = allowedModels.includes('*') || allowedModels.includes(model);
          const processOk = allowedProcesses.includes('*') || allowedProcesses.includes(processRef);
          if (!modelOk) return `model ${model} is not authorized`;
          if (!processOk) return `process ${processRef} is not authorized`;
          return null;
        }, '_denial');

        return branch(b,
          (bindings) => bindings._denial != null,
          (() => {
            let d = createProgram();
            d = get(d, 'tool', toolId, 'existing');
            d = mapBindings(d, (bindings) => {
              const existing = bindings.existing as Record<string, unknown>;
              const status = existing.status as string;
              if (status === 'disabled') return 'tool is disabled';
              if (status === 'deprecated') return 'tool is deprecated';
              const allowedModels = existing.allowed_models as string[];
              const allowedProcesses = existing.allowed_processes as string[];
              const modelOk = allowedModels.includes('*') || allowedModels.includes(model);
              if (!modelOk) return `model ${model} is not authorized`;
              return `process ${processRef} is not authorized`;
            }, '_reason');
            return completeFrom(d, 'denied', (bindings) => ({
              tool: toolId,
              reason: bindings._reason as string,
            }));
          })(),
          (() => {
            let a = createProgram();
            a = get(a, 'tool', toolId, 'existing');
            a = mapBindings(a, (bindings) => {
              const existing = bindings.existing as Record<string, unknown>;
              return existing.schema as string;
            }, '_schema');
            return completeFrom(a, 'allowed', (bindings) => ({
              tool: toolId,
              schema: bindings._schema as string,
            }));
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  list_active(input: Record<string, unknown>) {
    const processRef = input.process_ref as string;

    let p = createProgram();
    p = find(p, 'tool', { status: 'active' }, 'activeTools');
    p = mapBindings(p, (bindings) => {
      const tools = (bindings.activeTools as Array<Record<string, unknown>>) || [];
      const filtered = tools.filter((t) => {
        const allowedProcesses = t.allowed_processes as string[];
        return allowedProcesses.includes('*') || allowedProcesses.includes(processRef);
      });
      return JSON.stringify(filtered.map((t) => ({
        tool: t.tool,
        name: t.name,
        version: t.version,
        description: t.description,
        schema: t.schema,
      })));
    }, '_result');

    return completeFrom(p, 'ok', (bindings) => ({
      tools: bindings._result as string,
    })) as StorageProgram<Result>;
  },
};

export const toolRegistryHandler = autoInterpret(_toolRegistryHandler);
