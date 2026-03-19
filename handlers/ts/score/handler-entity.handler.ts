// HandlerEntity Concept Implementation
//
// Queryable representation of concept handler implementation files.
// Links handler source to concept entities, action entities, parsed AST,
// dependencies, and runtime behavior. Enables stack trace correlation,
// error root-cause analysis, and implementation coverage tracking.

import type { ConceptHandler, ConceptStorage } from '@clef/runtime';

export const handlerEntityHandler: ConceptHandler = {

  async register(input, storage) {
    const concept = input.concept as string;
    const sourceFile = input.sourceFile as string;
    const language = input.language as string;
    const ast = input.ast as string;

    const key = `handler:${concept}:${language}`;
    const existing = await storage.get('handlers', key);
    if (existing) {
      return { variant: 'alreadyRegistered', existing: existing.id };
    }

    const id = crypto.randomUUID();
    // TODO: Parse AST to extract action methods, dependencies, exports, storage collections
    const parsedAst = ast ? JSON.parse(ast) : {};
    const actionMethods = JSON.stringify(parsedAst.actionMethods || []);
    const dependencies = JSON.stringify(parsedAst.dependencies || []);
    const exports = JSON.stringify(parsedAst.exports || []);
    const storageCollections = JSON.stringify(parsedAst.storageCollections || []);

    await storage.put('handlers', key, {
      id,
      concept,
      sourceFile,
      language,
      ast,
      symbol: `${concept}Handler`,
      actionMethods,
      dependencies,
      exports,
      storageCollections,
      lineCount: parsedAst.lineCount || 0,
      lastModified: new Date().toISOString(),
    });

    return { variant: 'ok', handler: id };
  },

  async get(input, storage) {
    const concept = input.concept as string;
    const language = input.language as string;

    const entry = await storage.get('handlers', `handler:${concept}:${language}`);
    if (!entry) {
      return { variant: 'notfound' };
    }

    return { variant: 'ok', handler: entry.id };
  },

  async getByFile(input, storage) {
    const sourceFile = input.sourceFile as string;

    const all = await storage.find('handlers');
    const entry = all.find(h => h.sourceFile === sourceFile);
    if (!entry) {
      return { variant: 'notfound' };
    }

    return { variant: 'ok', handler: entry.id };
  },

  async findByConcept(input, storage) {
    const concept = input.concept as string;
    const all = await storage.find('handlers', { concept });

    return { variant: 'ok', handlers: JSON.stringify(all) };
  },

  async findByLanguage(input, storage) {
    const language = input.language as string;
    const all = await storage.find('handlers', { language });

    return { variant: 'ok', handlers: JSON.stringify(all) };
  },

  async getActionMethod(input, storage) {
    const handlerId = input.handler as string;
    const actionName = input.actionName as string;

    const all = await storage.find('handlers');
    const entry = all.find(h => h.id === handlerId);
    if (!entry) {
      return { variant: 'notfound' };
    }

    const methods = JSON.parse(entry.actionMethods as string || '[]');
    const method = methods.find((m: { name: string }) => m.name === actionName);
    if (!method) {
      return { variant: 'notfound' };
    }

    return { variant: 'ok', method: JSON.stringify(method) };
  },

  async implementationGaps(input, storage) {
    const concept = input.concept as string;

    const handlers = await storage.find('handlers', { concept });
    if (handlers.length === 0) {
      return { variant: 'noHandler' };
    }

    // TODO: Compare declared actions from ConceptEntity against implemented methods
    // For now, report fully implemented based on handler metadata
    const handler = handlers[0];
    const methods = JSON.parse(handler.actionMethods as string || '[]');

    return { variant: 'fullyImplemented', actionCount: methods.length };
  },

  async getDependencies(input, storage) {
    const handlerId = input.handler as string;

    const all = await storage.find('handlers');
    const entry = all.find(h => h.id === handlerId);
    if (!entry) {
      return { variant: 'ok', imports: '[]', externalPackages: '[]', internalModules: '[]' };
    }

    const deps = JSON.parse(entry.dependencies as string || '[]');
    const externalPackages = deps.filter((d: { external?: boolean }) => d.external);
    const internalModules = deps.filter((d: { external?: boolean }) => !d.external);

    return {
      variant: 'ok',
      imports: JSON.stringify(deps),
      externalPackages: JSON.stringify(externalPackages),
      internalModules: JSON.stringify(internalModules),
    };
  },

  async getStorageUsage(input, storage) {
    const handlerId = input.handler as string;

    const all = await storage.find('handlers');
    const entry = all.find(h => h.id === handlerId);
    if (!entry) {
      return { variant: 'ok', collections: '[]' };
    }

    return { variant: 'ok', collections: entry.storageCollections as string || '[]' };
  },

  async resolveStackFrame(input, storage) {
    const file = input.file as string;
    const line = input.line as number;
    const col = input.col as number;

    const all = await storage.find('handlers');
    const entry = all.find(h => h.sourceFile === file);
    if (!entry) {
      return { variant: 'notInHandler' };
    }

    // TODO: Walk AST to find exact node at line:col
    const astNode = JSON.stringify({
      kind: 'Unknown',
      startLine: line,
      startCol: col,
      endLine: line,
      endCol: col,
      text: '',
      parent: null,
      children: [],
    });

    return {
      variant: 'ok',
      handler: entry.id as string,
      concept: entry.concept as string,
      actionMethod: '',
      astNode,
      sourceSpan: `${file}:${line}:${col}`,
    };
  },

  async resolveToAstNode(input, storage) {
    const handlerId = input.handler as string;
    const line = input.line as number;
    const col = input.col as number;

    const all = await storage.find('handlers');
    const entry = all.find(h => h.id === handlerId);
    if (!entry) {
      return { variant: 'outOfRange', line, maxLine: 0 };
    }

    const maxLine = entry.lineCount as number || 0;
    if (maxLine > 0 && line > maxLine) {
      return { variant: 'outOfRange', line, maxLine };
    }

    // TODO: Walk AST to find innermost node at line:col
    const node = JSON.stringify({
      kind: 'Unknown',
      startLine: line,
      startCol: col,
      endLine: line,
      endCol: col,
      text: '',
    });

    return {
      variant: 'ok',
      node,
      ancestors: '[]',
      actionMethod: '',
    };
  },

  async resolveStackTrace(input, storage) {
    const stackTrace = input.stackTrace as string;

    // Parse stack trace lines to extract file:line:col
    const frameRegex = /at\s+(?:.*?\s+)?\(?(.+?):(\d+):(\d+)\)?/g;
    const frames: Array<Record<string, unknown>> = [];
    let match: RegExpExecArray | null;

    const allHandlers = await storage.find('handlers');

    while ((match = frameRegex.exec(stackTrace)) !== null) {
      const file = match[1];
      const line = parseInt(match[2], 10);
      const col = parseInt(match[3], 10);

      const handler = allHandlers.find(h => h.sourceFile === file);

      frames.push({
        file,
        line,
        col,
        handler: handler ? handler.id : null,
        concept: handler ? handler.concept : null,
        actionMethod: null,
        astNode: null,
        symbol: handler ? handler.symbol : file.split('/').pop(),
      });
    }

    return { variant: 'ok', frames: JSON.stringify(frames) };
  },

  async traceToVariantReturn(input, storage) {
    const handlerId = input.handler as string;
    const actionName = input.actionName as string;

    const all = await storage.find('handlers');
    const entry = all.find(h => h.id === handlerId);
    if (!entry) {
      return { variant: 'notfound' };
    }

    // TODO: Parse AST to find all `return { variant: '...' }` statements
    return { variant: 'ok', returns: '[]' };
  },

  async traceToStorageCalls(input, storage) {
    const handlerId = input.handler as string;
    const actionName = input.actionName as string;

    const all = await storage.find('handlers');
    const entry = all.find(h => h.id === handlerId);
    if (!entry) {
      return { variant: 'notfound' };
    }

    // TODO: Parse AST to find all storage.put/get/find/del calls
    return { variant: 'ok', calls: '[]' };
  },

  async findByError(input, storage) {
    const errorSymbol = input.errorSymbol as string;
    const since = input.since as string;

    // TODO: Cross-reference with ErrorCorrelation entities
    const all = await storage.find('handlers');

    return { variant: 'ok', handlers: JSON.stringify([]) };
  },

  async sourceForAction(input, storage) {
    const concept = input.concept as string;
    const actionName = input.actionName as string;

    const handlers = await storage.find('handlers', { concept });
    if (handlers.length === 0) {
      return { variant: 'noHandler' };
    }

    const handler = handlers[0];
    const methods = JSON.parse(handler.actionMethods as string || '[]');
    const method = methods.find((m: { name: string }) => m.name === actionName);
    if (!method) {
      return { variant: 'actionNotImplemented' };
    }

    return {
      variant: 'ok',
      source: method.body || '',
      file: handler.sourceFile as string,
      startLine: method.startLine || 0,
      endLine: method.endLine || 0,
    };
  },
};
