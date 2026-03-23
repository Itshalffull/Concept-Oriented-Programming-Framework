// @clef-handler style=functional
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
    if (!input.widget || (typeof input.widget === 'string' && (input.widget as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'widget is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const widget = input.widget as string;
    const framework = input.framework as string;
    const sourceFile = input.sourceFile as string;
    const ast = input.ast as string;

    const key = `widget-impl:${widget}:${framework}`;
    p = get(p, 'widget-implementations', key, 'existing');

    const id = crypto.randomUUID();
    const parsedAst = ast ? JSON.parse(ast) : {};

    return branch(p,
      (b) => b.existing != null,
      (tp) => completeFrom(tp, 'alreadyRegistered', (b) => ({ existing: (b.existing as any).id })),
      (ep) => {
        let q = put(ep, 'widget-implementations', key, {
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
        return complete(q, 'ok', { impl: id });
      },
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    let p = createProgram();
    const widget = input.widget as string;
    const framework = input.framework as string;

    p = get(p, 'widget-implementations', `widget-impl:${widget}:${framework}`, 'entry');

    return branch(p,
      (b) => b.entry == null,
      (tp) => complete(tp, 'notfound', {}),
      (ep) => completeFrom(ep, 'ok', (b) => ({ impl: (b.entry as any).id })),
    ) as StorageProgram<Result>;
  },

  getByFile(input: Record<string, unknown>) {
    if (!input.sourceFile || (typeof input.sourceFile === 'string' && (input.sourceFile as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'sourceFile is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const sourceFile = input.sourceFile as string;

    p = find(p, 'widget-implementations', {}, 'all');
    p = mapBindings(p, (b) => (b.all as any[]).find((i: any) => i.sourceFile === sourceFile) || null, 'entry');

    return branch(p,
      (b) => b.entry == null,
      (tp) => complete(tp, 'notfound', {}),
      (ep) => completeFrom(ep, 'ok', (b) => ({ impl: (b.entry as any).id })),
    ) as StorageProgram<Result>;
  },

  findByWidget(input: Record<string, unknown>) {
    if (!input.widget || (typeof input.widget === 'string' && (input.widget as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'widget is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const widget = input.widget as string;
    p = find(p, 'widget-implementations', { widget }, 'all');

    return completeFrom(p, 'ok', (b) => ({ implementations: JSON.stringify(b.all) })) as StorageProgram<Result>;
  },

  findByFramework(input: Record<string, unknown>) {
    if (!input.framework || (typeof input.framework === 'string' && (input.framework as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'framework is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const framework = input.framework as string;
    p = find(p, 'widget-implementations', { framework }, 'all');

    return completeFrom(p, 'ok', (b) => ({ implementations: JSON.stringify(b.all) })) as StorageProgram<Result>;
  },

  anatomyMapping(input: Record<string, unknown>) {
    let p = createProgram();
    const implId = input.impl as string;

    p = find(p, 'widget-implementations', {}, 'all');
    p = mapBindings(p, (b) => (b.all as any[]).find((i: any) => i.id === implId) || null, 'entry');

    return branch(p,
      (b) => b.entry == null,
      (tp) => complete(tp, 'ok', { mapping: '[]' }),
      (ep) => {
        // Map anatomy parts from widget spec to rendered DOM elements
        let q = mapBindings(ep, (b) => {
          const entry = b.entry as any;
          const parts = JSON.parse(entry.renderedParts as string || '[]');
          const mapping = parts.map((part: { name: string; element?: string }) => ({
            part: part.name || part,
            element: part.element || 'div',
            selector: `[data-part="${part.name || part}"]`,
          }));
          return JSON.stringify(mapping);
        }, 'mapping');
        return completeFrom(q, 'ok', (b) => ({ mapping: b.mapping as string }));
      },
    ) as StorageProgram<Result>;
  },

  diffFromSpec(input: Record<string, unknown>) {
    let p = createProgram();
    const implId = input.impl as string;

    p = find(p, 'widget-implementations', {}, 'all');
    p = mapBindings(p, (b) => (b.all as any[]).find((i: any) => i.id === implId) || null, 'entry');

    return branch(p,
      (b) => b.entry == null,
      (tp) => complete(tp, 'ok', {}),
      // TODO: Compare generated implementation against widget spec
      (ep) => complete(ep, 'ok', {}),
    ) as StorageProgram<Result>;
  },

  resolveRenderFrame(input: Record<string, unknown>) {
    let p = createProgram();
    const file = input.file as string;
    const line = input.line as number;
    const col = input.col as number;

    p = find(p, 'widget-implementations', {}, 'all');
    p = mapBindings(p, (b) => (b.all as any[]).find((i: any) => i.sourceFile === file) || null, 'entry');

    return branch(p,
      (b) => b.entry == null,
      (tp) => complete(tp, 'notInWidgetImpl', {}),
      (ep) => {
        // TODO: Walk AST to find exact node and anatomy part at line:col
        const astNode = JSON.stringify({
          kind: 'Unknown',
          text: '',
          startLine: line,
          startCol: col,
          endLine: line,
          endCol: col,
        });

        return completeFrom(ep, 'ok', (b) => ({
          impl: (b.entry as any).id as string,
          widget: (b.entry as any).widget as string,
          part: '',
          astNode,
          astAncestors: '[]',
          sourceSpan: `${file}:${line}:${col}`,
        }));
      },
    ) as StorageProgram<Result>;
  },

  resolveToAstNode(input: Record<string, unknown>) {
    let p = createProgram();
    const implId = input.impl as string;
    const line = input.line as number;
    const col = input.col as number;

    p = find(p, 'widget-implementations', {}, 'all');
    p = mapBindings(p, (b) => (b.all as any[]).find((i: any) => i.id === implId) || null, 'entry');

    return branch(p,
      (b) => b.entry == null,
      (tp) => complete(tp, 'outOfRange', { line, maxLine: 0 }),
      (ep) => {
        // TODO: Walk AST to find innermost node at line:col
        const node = JSON.stringify({
          kind: 'Unknown',
          startLine: line,
          startCol: col,
          endLine: line,
          endCol: col,
          text: '',
        });

        return complete(ep, 'ok', {
          node,
          ancestors: '[]',
          part: '',
        });
      },
    ) as StorageProgram<Result>;
  },
};

export const widgetImplementationEntityHandler = autoInterpret(_handler);
