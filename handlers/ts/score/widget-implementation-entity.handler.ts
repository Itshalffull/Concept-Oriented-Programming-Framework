// WidgetImplementationEntity Concept Implementation
//
// Queryable representation of generated widget implementation files.
// Links generated React, Vue, Svelte, or other framework-specific
// components back to their WidgetEntity source specs. Tracks full AST
// of generated code and enables stack trace correlation for widget
// rendering errors.

import type { ConceptHandler, ConceptStorage } from '@clef/runtime';

export const widgetImplementationEntityHandler: ConceptHandler = {

  async register(input, storage) {
    const widget = input.widget as string;
    const framework = input.framework as string;
    const sourceFile = input.sourceFile as string;
    const ast = input.ast as string;

    const key = `widget-impl:${widget}:${framework}`;
    const existing = await storage.get('widget-implementations', key);
    if (existing) {
      return { variant: 'alreadyRegistered', existing: existing.id };
    }

    const id = crypto.randomUUID();
    const parsedAst = ast ? JSON.parse(ast) : {};

    await storage.put('widget-implementations', key, {
      id,
      widget,
      framework,
      sourceFile,
      ast,
      symbol: parsedAst.componentName || `${widget}Component`,
      componentName: parsedAst.componentName || widget,
      renderedParts: JSON.stringify(parsedAst.renderedParts || []),
      propsInterface: JSON.stringify(parsedAst.propsInterface || {}),
      stateBindings: JSON.stringify(parsedAst.stateBindings || []),
      slotImplementations: JSON.stringify(parsedAst.slotImplementations || []),
      accessibilityAttrs: JSON.stringify(parsedAst.accessibilityAttrs || []),
      generatedFrom: parsedAst.generatedFrom || '',
      lastModified: new Date().toISOString(),
    });

    return { variant: 'ok', impl: id };
  },

  async get(input, storage) {
    const widget = input.widget as string;
    const framework = input.framework as string;

    const entry = await storage.get('widget-implementations', `widget-impl:${widget}:${framework}`);
    if (!entry) {
      return { variant: 'notfound' };
    }

    return { variant: 'ok', impl: entry.id };
  },

  async getByFile(input, storage) {
    const sourceFile = input.sourceFile as string;

    const all = await storage.find('widget-implementations');
    const entry = all.find(i => i.sourceFile === sourceFile);
    if (!entry) {
      return { variant: 'notfound' };
    }

    return { variant: 'ok', impl: entry.id };
  },

  async findByWidget(input, storage) {
    const widget = input.widget as string;
    const all = await storage.find('widget-implementations', { widget });

    return { variant: 'ok', implementations: JSON.stringify(all) };
  },

  async findByFramework(input, storage) {
    const framework = input.framework as string;
    const all = await storage.find('widget-implementations', { framework });

    return { variant: 'ok', implementations: JSON.stringify(all) };
  },

  async anatomyMapping(input, storage) {
    const implId = input.impl as string;

    const all = await storage.find('widget-implementations');
    const entry = all.find(i => i.id === implId);
    if (!entry) {
      return { variant: 'ok', mapping: '[]' };
    }

    // TODO: Map anatomy parts from widget spec to rendered DOM elements
    const parts = JSON.parse(entry.renderedParts as string || '[]');
    const mapping = parts.map((part: { name: string; element?: string }) => ({
      part: part.name || part,
      element: part.element || 'div',
      selector: `[data-part="${part.name || part}"]`,
    }));

    return { variant: 'ok', mapping: JSON.stringify(mapping) };
  },

  async diffFromSpec(input, storage) {
    const implId = input.impl as string;

    const all = await storage.find('widget-implementations');
    const entry = all.find(i => i.id === implId);
    if (!entry) {
      return { variant: 'inSync' };
    }

    // TODO: Compare generated implementation against widget spec
    return { variant: 'inSync' };
  },

  async resolveRenderFrame(input, storage) {
    const file = input.file as string;
    const line = input.line as number;
    const col = input.col as number;

    const all = await storage.find('widget-implementations');
    const entry = all.find(i => i.sourceFile === file);
    if (!entry) {
      return { variant: 'notInWidgetImpl' };
    }

    // TODO: Walk AST to find exact node and anatomy part at line:col
    const astNode = JSON.stringify({
      kind: 'Unknown',
      text: '',
      startLine: line,
      startCol: col,
      endLine: line,
      endCol: col,
    });

    return {
      variant: 'ok',
      impl: entry.id as string,
      widget: entry.widget as string,
      part: '',
      astNode,
      astAncestors: '[]',
      sourceSpan: `${file}:${line}:${col}`,
    };
  },

  async resolveToAstNode(input, storage) {
    const implId = input.impl as string;
    const line = input.line as number;
    const col = input.col as number;

    const all = await storage.find('widget-implementations');
    const entry = all.find(i => i.id === implId);
    if (!entry) {
      return { variant: 'outOfRange', line, maxLine: 0 };
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
      part: '',
    };
  },
};
