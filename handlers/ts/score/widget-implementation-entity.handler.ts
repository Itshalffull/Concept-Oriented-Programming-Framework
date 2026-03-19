// @migrated dsl-constructs 2026-03-18
// WidgetImplementationEntity Concept Implementation
//
// Queryable representation of generated widget implementation files.
// Links generated React, Vue, Svelte, or other framework-specific
// components back to their WidgetEntity source specs. Tracks full AST
// of generated code and enables stack trace correlation for widget
// rendering errors.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, merge, branch, complete, completeFrom,
  mapBindings, putFrom, mergeFrom, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {

  register(input: Record<string, unknown>) {
    let p = createProgram();
    const widget = input.widget as string;
    const framework = input.framework as string;
    const sourceFile = input.sourceFile as string;
    const ast = input.ast as string;

    const key = `widget-impl:${widget}:${framework}`;
    p = get(p, 'widget-implementations', key, 'existing');
    if (existing) {
      return complete(p, 'alreadyRegistered', { existing: existing.id }) as StorageProgram<Result>;
    }

    const id = crypto.randomUUID();
    const parsedAst = ast ? JSON.parse(ast) : {};

    p = put(p, 'widget-implementations', key, {
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

    return complete(p, 'ok', { impl: id }) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    let p = createProgram();
    const widget = input.widget as string;
    const framework = input.framework as string;

    p = get(p, 'widget-implementations', `widget-impl:${widget}:${framework}`, 'entry');
    if (!entry) {
      return complete(p, 'notfound', {}) as StorageProgram<Result>;
    }

    return complete(p, 'ok', { impl: entry.id }) as StorageProgram<Result>;
  },

  getByFile(input: Record<string, unknown>) {
    let p = createProgram();
    const sourceFile = input.sourceFile as string;

    p = find(p, 'widget-implementations', 'all');
    const entry = all.find(i => i.sourceFile === sourceFile);
    if (!entry) {
      return complete(p, 'notfound', {}) as StorageProgram<Result>;
    }

    return complete(p, 'ok', { impl: entry.id }) as StorageProgram<Result>;
  },

  findByWidget(input: Record<string, unknown>) {
    let p = createProgram();
    const widget = input.widget as string;
    p = find(p, 'widget-implementations', { widget }, 'all');

    return complete(p, 'ok', { implementations: JSON.stringify(all) }) as StorageProgram<Result>;
  },

  findByFramework(input: Record<string, unknown>) {
    let p = createProgram();
    const framework = input.framework as string;
    p = find(p, 'widget-implementations', { framework }, 'all');

    return complete(p, 'ok', { implementations: JSON.stringify(all) }) as StorageProgram<Result>;
  },

  anatomyMapping(input: Record<string, unknown>) {
    let p = createProgram();
    const implId = input.impl as string;

    p = find(p, 'widget-implementations', 'all');
    const entry = all.find(i => i.id === implId);
    if (!entry) {
      return complete(p, 'ok', { mapping: '[]' }) as StorageProgram<Result>;
    }

    // TODO: Map anatomy parts from widget spec to rendered DOM elements
    const parts = JSON.parse(entry.renderedParts as string || '[]');
    const mapping = parts.map((part: { name: string; element?: string }) => ({
      part: part.name || part,
      element: part.element || 'div',
      selector: `[data-part="${part.name || part}"]`,
    }));

    return complete(p, 'ok', { mapping: JSON.stringify(mapping) }) as StorageProgram<Result>;
  },

  diffFromSpec(input: Record<string, unknown>) {
    let p = createProgram();
    const implId = input.impl as string;

    p = find(p, 'widget-implementations', 'all');
    const entry = all.find(i => i.id === implId);
    if (!entry) {
      return complete(p, 'inSync', {}) as StorageProgram<Result>;
    }

    // TODO: Compare generated implementation against widget spec
    return complete(p, 'inSync', {}) as StorageProgram<Result>;
  },

  resolveRenderFrame(input: Record<string, unknown>) {
    let p = createProgram();
    const file = input.file as string;
    const line = input.line as number;
    const col = input.col as number;

    p = find(p, 'widget-implementations', 'all');
    const entry = all.find(i => i.sourceFile === file);
    if (!entry) {
      return complete(p, 'notInWidgetImpl', {}) as StorageProgram<Result>;
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

    return complete(p, 'ok', {
      impl: entry.id as string,
      widget: entry.widget as string,
      part: '',
      astNode,
      astAncestors: '[]',
      sourceSpan: `${file}:${line}:${col}`,
    }) as StorageProgram<Result>;
  },

  resolveToAstNode(input: Record<string, unknown>) {
    let p = createProgram();
    const implId = input.impl as string;
    const line = input.line as number;
    const col = input.col as number;

    p = find(p, 'widget-implementations', 'all');
    const entry = all.find(i => i.id === implId);
    if (!entry) {
      return complete(p, 'outOfRange', { line, maxLine: 0 }) as StorageProgram<Result>;
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

    return complete(p, 'ok', {
      node,
      ancestors: '[]',
      part: '',
    }) as StorageProgram<Result>;
  },
};

export const widgetImplementationEntityHandler = autoInterpret(_handler);
