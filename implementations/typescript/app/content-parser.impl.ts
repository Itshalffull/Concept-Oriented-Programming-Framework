import type { ConceptHandler } from '@copf/kernel';

export const contentParserHandler: ConceptHandler = {
  async registerFormat(input, storage) {
    const name = input.name as string;
    const grammar = input.grammar as string;
    const existing = await storage.get('format', name);
    if (existing) return { variant: 'exists', message: 'already exists' };
    await storage.put('format', name, { name, grammar });
    return { variant: 'ok', name };
  },

  async registerExtractor(input, storage) {
    const name = input.name as string;
    const pattern = input.pattern as string;
    const existing = await storage.get('extractor', name);
    if (existing) return { variant: 'exists', message: 'already exists' };
    await storage.put('extractor', name, { name, pattern });
    return { variant: 'ok', name };
  },

  async parse(input, storage) {
    const content = input.content as string;
    const text = input.text as string;
    const format = input.format as string;
    const formatRecord = await storage.get('format', format);
    if (!formatRecord) return { variant: 'error', message: 'Format not registered' };
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
    await storage.put('ast', content, { content, ast, format });
    return { variant: 'ok', ast };
  },

  async extractRefs(input, storage) {
    const content = input.content as string;
    const astRecord = await storage.get('ast', content);
    if (!astRecord) return { variant: 'notfound', message: 'No AST cached for this content' };
    const ast = JSON.parse(astRecord.ast as string);
    return { variant: 'ok', refs: JSON.stringify(ast.refs) };
  },

  async extractTags(input, storage) {
    const content = input.content as string;
    const astRecord = await storage.get('ast', content);
    if (!astRecord) return { variant: 'notfound', message: 'No AST cached for this content' };
    const ast = JSON.parse(astRecord.ast as string);
    return { variant: 'ok', tags: JSON.stringify(ast.tags) };
  },

  async extractProperties(input, storage) {
    const content = input.content as string;
    const astRecord = await storage.get('ast', content);
    if (!astRecord) return { variant: 'notfound', message: 'No AST cached for this content' };
    const ast = JSON.parse(astRecord.ast as string);
    return { variant: 'ok', properties: JSON.stringify(ast.properties) };
  },

  async serialize(input, storage) {
    const content = input.content as string;
    const format = input.format as string;
    const astRecord = await storage.get('ast', content);
    if (!astRecord) return { variant: 'notfound', message: 'No AST cached for this content' };
    const ast = JSON.parse(astRecord.ast as string);
    let text = ast.text as string;
    if (format !== ast.format) {
      text = ast.text as string;
    }
    return { variant: 'ok', text };
  },
};
