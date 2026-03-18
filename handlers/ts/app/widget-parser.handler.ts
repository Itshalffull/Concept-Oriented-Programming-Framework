// @migrated dsl-constructs 2026-03-18
// WidgetParser Concept Implementation [W]
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
import { autoInterpret } from '../../../runtime/functional-compat.ts';
  createProgram, get as spGet, put, branch, complete, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

const _widgetParserHandler: FunctionalConceptHandler = {
  parse(input: Record<string, unknown>) {
    const widget = input.widget as string; const source = input.source as string;
    const id = widget || nextId('W');
    let ast: Record<string, unknown>; const errors: string[] = [];
    try { ast = JSON.parse(source); } catch (e) {
      let p = createProgram(); return complete(p, 'error', { errors: JSON.stringify([e instanceof Error ? e.message : 'Unknown parse error']) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }
    if (!ast.name) errors.push('Widget must have a "name" field');
    if (!ast.template && !ast.render && !ast.children) errors.push('Widget must have at least one of "template", "render", or "children"');
    if (errors.length > 0) { let p = createProgram(); return complete(p, 'error', { errors: JSON.stringify(errors) }) as StorageProgram<{ variant: string; [key: string]: unknown }>; }
    let p = createProgram();
    p = put(p, 'widgetParser', id, { source, ast: JSON.stringify(ast), errors: JSON.stringify([]), version: 1 });
    return complete(p, 'ok', { ast: JSON.stringify(ast) }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
  validate(input: Record<string, unknown>) {
    const widget = input.widget as string;
    let p = createProgram(); p = spGet(p, 'widgetParser', widget, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const ast: Record<string, unknown> = JSON.parse(existing.ast as string);
          const warnings: string[] = [];
          if (!ast.props || (Array.isArray(ast.props) && ast.props.length === 0)) warnings.push('Widget has no props defined');
          if (!ast.styles && !ast.className) warnings.push('Widget has no styling information');
          if (!ast.accessibility && !ast.aria) warnings.push('Widget has no accessibility attributes defined');
          if (!ast.slots && !ast.children) warnings.push('Widget has no slot or children composition defined');
          if (!ast.events && !ast.handlers) warnings.push('Widget has no event handlers defined');
          return warnings;
        }, 'warnings');
        b2 = branch(b2, (bindings) => ((bindings.warnings as string[]).length > 0),
          (() => { let t = createProgram(); return complete(t, 'incomplete', { warnings: '' }); })(),
          (() => { let e = createProgram(); return complete(e, 'ok', {}); })());
        return b2;
      },
      (b) => complete(b, 'incomplete', { warnings: JSON.stringify(['Widget not found; parse a widget first']) }));
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const widgetParserHandler = autoInterpret(_widgetParserHandler);

