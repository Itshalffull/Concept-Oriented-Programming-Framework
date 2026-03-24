// @clef-handler style=functional
// ToolBinding Concept Implementation
// Callable tools/functions that LLMs can invoke. Unifies OpenAI function
// calling, Anthropic tool use, and MCP tool primitive. Full lifecycle:
// schema definition, provider format translation, argument validation,
// execution, result formatting, error handling.
// See Architecture doc for concept spec details.
import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `tool-binding-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'ToolBinding' }) as StorageProgram<Result>;
  },

  define(input: Record<string, unknown>) {
    const name = input.name as string;
    const description = input.description as string;
    const inputSchema = input.input_schema as string;
    const outputSchema = input.output_schema as string | null;
    const handler = input.handler as string;
    const annotations = input.annotations as {
      audience: string;
      destructive: boolean;
      idempotent: boolean;
      open_world: boolean;
    };
    const timeoutMs = input.timeout_ms as number;
    const requiresApproval = input.requires_approval as boolean;

    if (!name || name.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'name is required' }) as StorageProgram<Result>;
    }
    if (!description || description.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'description is required' }) as StorageProgram<Result>;
    }
    if (!inputSchema || inputSchema.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'input_schema is required' }) as StorageProgram<Result>;
    }
    if (!handler || handler.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'handler is required' }) as StorageProgram<Result>;
    }

    // Validate input_schema is valid JSON
    try {
      JSON.parse(inputSchema);
    } catch {
      return complete(createProgram(), 'invalid', { message: 'input_schema must be valid JSON' }) as StorageProgram<Result>;
    }

    const id = nextId();
    let p = createProgram();
    p = put(p, 'tool', id, {
      id,
      name,
      description,
      input_schema: inputSchema,
      output_schema: outputSchema || null,
      handler,
      annotations: annotations || { audience: 'user', destructive: false, idempotent: true, open_world: false },
      timeout_ms: timeoutMs || 30000,
      retry_policy: { max_retries: 3, backoff_ms: 1000 },
      requires_approval: requiresApproval ?? false,
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { tool: id }) as StorageProgram<Result>;
  },

  invoke(input: Record<string, unknown>) {
    const tool = input.tool as string;
    const argumentsStr = input.arguments as string;

    if (!tool || (tool as string).trim() === '') {
      return complete(createProgram(), 'execution_error', { message: 'tool is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'tool', tool, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'execution_error', { message: 'Tool not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'tool', tool, 'toolData');

        return completeFrom(b, 'ok', (bindings) => {
          const data = bindings.toolData as Record<string, unknown>;

          // Check approval requirement
          if (data.requires_approval) {
            return {
              _variant_override: 'approval_required',
              tool,
              arguments: argumentsStr,
            };
          }

          // Validate arguments
          if (argumentsStr) {
            try {
              JSON.parse(argumentsStr);
            } catch {
              return {
                _variant_override: 'validation_error',
                errors: [{ path: 'arguments', message: 'Invalid JSON arguments' }],
              };
            }
          }

          const startTime = Date.now();
          // Simulated execution
          const executionMs = Math.floor(Math.random() * 100) + 10;

          return {
            result: JSON.stringify({ status: 'executed', tool: data.name }),
            execution_ms: executionMs,
          };
        });
      })(),
    ) as StorageProgram<Result>;
  },

  toProviderFormat(input: Record<string, unknown>) {
    const tool = input.tool as string;
    const provider = input.provider as string;

    if (!tool || (tool as string).trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'tool is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'tool', tool, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Tool not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'tool', tool, 'toolData');

        return completeFrom(b, 'ok', (bindings) => {
          const data = bindings.toolData as Record<string, unknown>;
          const toolName = data.name as string;
          const desc = data.description as string;
          const schema = data.input_schema as string;

          let formatted: Record<string, unknown>;

          switch (provider) {
            case 'openai':
              formatted = {
                type: 'function',
                function: { name: toolName, description: desc, parameters: JSON.parse(schema) },
              };
              break;
            case 'anthropic':
              formatted = {
                name: toolName,
                description: desc,
                input_schema: JSON.parse(schema),
              };
              break;
            case 'mcp':
              formatted = {
                name: toolName,
                description: desc,
                inputSchema: JSON.parse(schema),
                annotations: data.annotations,
              };
              break;
            default:
              formatted = {
                name: toolName,
                description: desc,
                input_schema: JSON.parse(schema),
                output_schema: data.output_schema ? JSON.parse(data.output_schema as string) : null,
              };
          }

          return { formatted: JSON.stringify(formatted) };
        });
      })(),
    ) as StorageProgram<Result>;
  },

  discover(input: Record<string, unknown>) {
    const filter = input.filter as Record<string, unknown> | null;

    let p = createProgram();
    p = find(p, 'tool', {}, 'allTools');

    return completeFrom(p, 'ok', (bindings) => {
      let tools = (bindings.allTools || []) as Array<Record<string, unknown>>;

      if (filter) {
        const audience = filter.audience as string | null;
        const destructive = filter.destructive as boolean | null;

        if (audience) {
          tools = tools.filter(t => {
            const ann = t.annotations as Record<string, unknown>;
            return ann.audience === audience;
          });
        }
        if (destructive !== null && destructive !== undefined) {
          tools = tools.filter(t => {
            const ann = t.annotations as Record<string, unknown>;
            return ann.destructive === destructive;
          });
        }
      }

      return {
        tools: tools.map(t => ({
          name: t.name as string,
          description: t.description as string,
          input_schema: t.input_schema as string,
          annotations: JSON.stringify(t.annotations),
        })),
      };
    }) as StorageProgram<Result>;
  },

  search(input: Record<string, unknown>) {
    const query = input.query as string;
    const k = input.k as number;

    if (!query || query.trim() === '') {
      return complete(createProgram(), 'ok', { message: 'No matches' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'tool', {}, 'allTools');

    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allTools || []) as Array<Record<string, unknown>>;
      const queryLower = query.toLowerCase();

      const scored = all
        .map(t => {
          const name = (t.name as string).toLowerCase();
          const desc = (t.description as string).toLowerCase();
          let relevance = 0;
          if (name.includes(queryLower)) relevance = 0.95;
          else if (desc.includes(queryLower)) relevance = 0.7;
          else relevance = 0.1;
          return {
            name: t.name as string,
            description: t.description as string,
            relevance,
          };
        })
        .filter(t => t.relevance > 0.1);

      scored.sort((a, b) => b.relevance - a.relevance);
      const results = scored.slice(0, k || 10);

      if (results.length === 0) {
        return { message: 'No matches' };
      }

      return { tools: results };
    }) as StorageProgram<Result>;
  },
};

export const toolBindingHandler = autoInterpret(_handler);
