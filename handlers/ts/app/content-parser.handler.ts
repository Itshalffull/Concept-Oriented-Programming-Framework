// @migrated dsl-constructs 2026-03-18
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

export const contentParserHandler: FunctionalConceptHandler = {
  registerFormat(input: Record<string, unknown>) {
    const name = input.name as string;
    const grammar = input.grammar as string;

    let p = createProgram();
    p = spGet(p, 'format', name, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'exists', { message: 'already exists' }),
      (b) => {
        let b2 = put(b, 'format', name, { name, grammar });
        return complete(b2, 'ok', { name });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  registerExtractor(input: Record<string, unknown>) {
    const name = input.name as string;
    const pattern = input.pattern as string;

    let p = createProgram();
    p = spGet(p, 'extractor', name, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'exists', { message: 'already exists' }),
      (b) => {
        let b2 = put(b, 'extractor', name, { name, pattern });
        return complete(b2, 'ok', { name });
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  parse(input: Record<string, unknown>) {
    const content = input.content as string;
    const text = input.text as string;
    const format = input.format as string;

    let p = createProgram();
    p = spGet(p, 'format', format, 'formatRecord');
    p = branch(p, 'formatRecord',
      (b) => {
        const refs: string[] = [];
        const refRegex = /\[\[([^\]]+)\]\]/g;
        let match: RegExpExecArray | null;
        match = refRegex.exec(text);
        while (match !== null) {
          refs.push(match[1]);
          match = refRegex.exec(text);
        }
        const tags: string[] = [];
        const tagRegex = /#(\w+)/g;
        match = tagRegex.exec(text);
        while (match !== null) {
          tags.push(match[1]);
          match = tagRegex.exec(text);
        }
        const properties: Record<string, string> = {};
        const propRegex = /(\w+)::\s*(.+)/g;
        match = propRegex.exec(text);
        while (match !== null) {
          properties[match[1]] = match[2].trim();
          match = propRegex.exec(text);
        }
        const ast = JSON.stringify({ text, format, refs, tags, properties });
        let b2 = put(b, 'ast', content, { content, ast, format });
        return complete(b2, 'ok', { ast });
      },
      (b) => complete(b, 'error', { message: 'Format not registered' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  extractRefs(input: Record<string, unknown>) {
    const content = input.content as string;

    let p = createProgram();
    p = spGet(p, 'ast', content, 'astRecord');
    p = branch(p, 'astRecord',
      (b) => complete(b, 'ok', { refs: '' }),
      (b) => complete(b, 'notfound', { message: 'No AST cached for this content' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  extractTags(input: Record<string, unknown>) {
    const content = input.content as string;

    let p = createProgram();
    p = spGet(p, 'ast', content, 'astRecord');
    p = branch(p, 'astRecord',
      (b) => complete(b, 'ok', { tags: '' }),
      (b) => complete(b, 'notfound', { message: 'No AST cached for this content' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  extractProperties(input: Record<string, unknown>) {
    const content = input.content as string;

    let p = createProgram();
    p = spGet(p, 'ast', content, 'astRecord');
    p = branch(p, 'astRecord',
      (b) => complete(b, 'ok', { properties: '' }),
      (b) => complete(b, 'notfound', { message: 'No AST cached for this content' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  serialize(input: Record<string, unknown>) {
    const content = input.content as string;
    const format = input.format as string;

    let p = createProgram();
    p = spGet(p, 'ast', content, 'astRecord');
    p = branch(p, 'astRecord',
      (b) => complete(b, 'ok', { text: '' }),
      (b) => complete(b, 'notfound', { message: 'No AST cached for this content' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
