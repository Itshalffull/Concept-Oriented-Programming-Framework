// @clef-handler style=functional
// PromptAssembly Concept Implementation
// Composes complete LLM prompts from independent sections with token budget management.
// Handles section ordering, priority-based truncation, and variable rendering.
import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `prompt-assembly-${++idCounter}`;
}

const VALID_STRATEGIES = new Set(['sequential', 'priority_weighted', 'adaptive']);
const VALID_FORMATS = new Set(['chat_messages', 'single_string', 'structured']);
const VALID_TOKENIZERS = new Set(['cl100k_base', 'o200k_base', 'p50k_base', 'r50k_base']);

/** Approximate BPE token count (~4 chars per token). */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Render template variables in content. */
function renderTemplate(content: string, variables: Array<{ name: string; value: string }>): string {
  let result = content;
  for (const v of variables) {
    result = result.replace(new RegExp(`\\{\\{${v.name}\\}\\}`, 'g'), v.value);
  }
  return result;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'PromptAssembly' }) as StorageProgram<Result>;
  },

  create(input: Record<string, unknown>) {
    const strategy = input.strategy as string;
    const format = input.format as string;
    const tokenizerId = input.tokenizer_id as string;
    const contextWindow = input.context_window as number;

    if (!strategy || strategy.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'strategy is required' }) as StorageProgram<Result>;
    }
    if (!VALID_STRATEGIES.has(strategy)) {
      return complete(createProgram(), 'invalid', { message: `Unknown strategy: ${strategy}` }) as StorageProgram<Result>;
    }
    if (!format || !VALID_FORMATS.has(format)) {
      return complete(createProgram(), 'invalid', { message: `Unknown format: ${format}` }) as StorageProgram<Result>;
    }
    if (!tokenizerId || !VALID_TOKENIZERS.has(tokenizerId)) {
      return complete(createProgram(), 'invalid', { message: `Unknown tokenizer: ${tokenizerId}` }) as StorageProgram<Result>;
    }
    if (!contextWindow || contextWindow <= 0) {
      return complete(createProgram(), 'invalid', { message: 'context_window must be positive' }) as StorageProgram<Result>;
    }

    const id = nextId();
    const responseReserve = Math.ceil(contextWindow * 0.2);
    const responseReserveSection = {
      name: 'response_reserve',
      role: 'system',
      template_ref: null,
      priority: 1000,
      max_tokens: responseReserve,
      required: true,
      content: null,
    };

    let p = createProgram();
    p = put(p, 'assembly', id, {
      id,
      assembly_strategy: strategy,
      format,
      tokenizer_id: tokenizerId,
      context_window: contextWindow,
      sections: [responseReserveSection],
      variables: [],
      output_directive: null,
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { assembly: id }) as StorageProgram<Result>;
  },

  addSection(input: Record<string, unknown>) {
    const assembly = input.assembly as string;
    const name = input.name as string;
    const role = input.role as string;
    const priority = input.priority as number;
    const maxTokens = input.max_tokens as number;
    const required = input.required as boolean;
    const content = input.content as string | null;
    const templateRef = input.template_ref as string | null;

    if (!assembly || assembly.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'assembly is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'assembly', assembly, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Assembly not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'assembly', assembly, 'rec');
        b = putFrom(b, 'assembly', assembly, (bindings) => {
          const rec = bindings.rec as Record<string, unknown>;
          const sections = (rec.sections as unknown[]) || [];
          const newSection = {
            name,
            role,
            template_ref: templateRef ?? null,
            priority: priority ?? 50,
            max_tokens: maxTokens ?? 500,
            required: required ?? false,
            content: content ?? null,
          };
          return { ...rec, sections: [...sections, newSection] };
        });
        return complete(b, 'ok', { assembly });
      })(),
    ) as StorageProgram<Result>;
  },

  setVariable(input: Record<string, unknown>) {
    const assembly = input.assembly as string;
    const name = input.name as string;
    const value = input.value as string;

    if (!assembly || assembly.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'assembly is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'assembly', assembly, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Assembly not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'assembly', assembly, 'rec');
        b = putFrom(b, 'assembly', assembly, (bindings) => {
          const rec = bindings.rec as Record<string, unknown>;
          const variables = (rec.variables as Array<{ name: string; value: string }>) || [];
          const filtered = variables.filter((v) => v.name !== name);
          return { ...rec, variables: [...filtered, { name, value }] };
        });
        return complete(b, 'ok', { assembly });
      })(),
    ) as StorageProgram<Result>;
  },

  assemble(input: Record<string, unknown>) {
    const assembly = input.assembly as string;

    if (!assembly || assembly.trim() === '') {
      return complete(createProgram(), 'over_budget', { minimum_tokens: 0, available_tokens: 0 }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'assembly', assembly, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'over_budget', { minimum_tokens: 0, available_tokens: 0 }),
      (() => {
        let b = createProgram();
        b = get(b, 'assembly', assembly, 'rec');
        return completeFrom(b, 'ok', (bindings) => {
          const rec = bindings.rec as Record<string, unknown>;
          const contextWindow = rec.context_window as number;
          const sections = (rec.sections as Array<Record<string, unknown>>) || [];
          const variables = (rec.variables as Array<{ name: string; value: string }>) || [];

          // Sort by priority descending — highest priority preserved first
          const sorted = [...sections].sort((a, b) => (b.priority as number) - (a.priority as number));

          const included: string[] = [];
          const truncated: string[] = [];
          let totalTokens = 0;
          const parts: string[] = [];

          for (const section of sorted) {
            const rawContent = (section.content as string) || '';
            const rendered = renderTemplate(rawContent, variables);
            const tokens = estimateTokens(rendered);
            const maxToks = (section.max_tokens as number) ?? 500;
            const sectTokens = Math.min(tokens, maxToks);

            if (totalTokens + sectTokens <= contextWindow) {
              included.push(section.name as string);
              totalTokens += sectTokens;
              parts.push(rendered);
            } else if (section.required as boolean) {
              truncated.push(section.name as string);
            } else {
              truncated.push(section.name as string);
            }
          }

          const costPerToken = 0.000002;
          const estimatedCost = totalTokens * costPerToken;

          return {
            prompt: parts.join('\n\n'),
            sections_included: included,
            sections_truncated: truncated,
            total_tokens: totalTokens,
            estimated_cost: estimatedCost,
          };
        });
      })(),
    ) as StorageProgram<Result>;
  },

  toMessages(input: Record<string, unknown>) {
    const assembly = input.assembly as string;

    if (!assembly || assembly.trim() === '') {
      return complete(createProgram(), 'over_budget', { minimum_tokens: 0, available_tokens: 0 }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'assembly', assembly, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'over_budget', { minimum_tokens: 0, available_tokens: 0 }),
      (() => {
        let b = createProgram();
        b = get(b, 'assembly', assembly, 'rec');
        return completeFrom(b, 'ok', (bindings) => {
          const rec = bindings.rec as Record<string, unknown>;
          const contextWindow = rec.context_window as number;
          const sections = (rec.sections as Array<Record<string, unknown>>) || [];
          const variables = (rec.variables as Array<{ name: string; value: string }>) || [];

          const sorted = [...sections].sort((a, b) => (b.priority as number) - (a.priority as number));
          let totalTokens = 0;
          const messages: Array<{ role: string; content: string }> = [];

          for (const section of sorted) {
            const rawContent = (section.content as string) || '';
            const rendered = renderTemplate(rawContent, variables);
            const tokens = estimateTokens(rendered);
            const maxToks = (section.max_tokens as number) ?? 500;
            const sectTokens = Math.min(tokens, maxToks);

            if (totalTokens + sectTokens <= contextWindow && rawContent.trim() !== '') {
              messages.push({ role: section.role as string, content: rendered });
              totalTokens += sectTokens;
            }
          }

          return { messages };
        });
      })(),
    ) as StorageProgram<Result>;
  },

  estimateTokens(input: Record<string, unknown>) {
    const assembly = input.assembly as string;

    if (!assembly || assembly.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'assembly is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'assembly', assembly, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Assembly not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'assembly', assembly, 'rec');
        return completeFrom(b, 'ok', (bindings) => {
          const rec = bindings.rec as Record<string, unknown>;
          const sections = (rec.sections as Array<Record<string, unknown>>) || [];
          const variables = (rec.variables as Array<{ name: string; value: string }>) || [];

          const perSection: Array<{ name: string; tokens: number }> = [];
          let total = 0;

          for (const section of sections) {
            const rawContent = (section.content as string) || '';
            const rendered = renderTemplate(rawContent, variables);
            const tokens = estimateTokens(rendered);
            perSection.push({ name: section.name as string, tokens });
            total += tokens;
          }

          return { total, per_section: perSection };
        });
      })(),
    ) as StorageProgram<Result>;
  },

  removeSection(input: Record<string, unknown>) {
    const assembly = input.assembly as string;
    const name = input.name as string;

    if (!assembly || assembly.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'assembly is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'assembly', assembly, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Assembly not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'assembly', assembly, 'rec');
        b = mapBindings(b, (bindings) => {
          const rec = bindings.rec as Record<string, unknown>;
          const sections = (rec.sections as Array<Record<string, unknown>>) || [];
          return sections.find((s) => s.name === name) ? true : false;
        }, '_sectionExists');
        return branch(b,
          (bindings) => !bindings._sectionExists,
          complete(createProgram(), 'notfound', { message: 'Section not found' }),
          (() => {
            let c = createProgram();
            c = get(c, 'assembly', assembly, 'rec2');
            c = putFrom(c, 'assembly', assembly, (bindings) => {
              const rec = bindings.rec2 as Record<string, unknown>;
              const sections = (rec.sections as Array<Record<string, unknown>>) || [];
              return { ...rec, sections: sections.filter((s) => s.name !== name) };
            });
            return complete(c, 'ok', { assembly });
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },
};

export const promptAssemblyHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetPromptAssembly(): void {
  idCounter = 0;
}
