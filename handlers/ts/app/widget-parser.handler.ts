// WidgetParser Concept Implementation [W]
// Parses widget source definitions into an AST and validates completeness.
import type { ConceptHandler } from '@clef/runtime';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

export const widgetParserHandler: ConceptHandler = {
  async parse(input, storage) {
    const widget = input.widget as string;
    const source = input.source as string;

    const id = widget || nextId('W');

    let ast: Record<string, unknown>;
    const errors: string[] = [];

    try {
      ast = JSON.parse(source);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown parse error';
      return {
        variant: 'error',
        errors: JSON.stringify([errorMessage]),
      };
    }

    // Validate required widget fields
    if (!ast.name) {
      errors.push('Widget must have a "name" field');
    }

    if (!ast.template && !ast.render && !ast.children) {
      errors.push('Widget must have at least one of "template", "render", or "children"');
    }

    if (errors.length > 0) {
      return {
        variant: 'error',
        errors: JSON.stringify(errors),
      };
    }

    await storage.put('widgetParser', id, {
      source,
      ast: JSON.stringify(ast),
      errors: JSON.stringify([]),
      version: 1,
    });

    return {
      variant: 'ok',
      ast: JSON.stringify(ast),
    };
  },

  async validate(input, storage) {
    const widget = input.widget as string;

    const existing = await storage.get('widgetParser', widget);
    if (!existing) {
      return { variant: 'incomplete', warnings: JSON.stringify(['Widget not found; parse a widget first']) };
    }

    const ast: Record<string, unknown> = JSON.parse(existing.ast as string);
    const warnings: string[] = [];

    // Check for common completeness issues
    if (!ast.props || (Array.isArray(ast.props) && ast.props.length === 0)) {
      warnings.push('Widget has no props defined');
    }

    if (!ast.styles && !ast.className) {
      warnings.push('Widget has no styling information');
    }

    if (!ast.accessibility && !ast.aria) {
      warnings.push('Widget has no accessibility attributes defined');
    }

    if (!ast.slots && !ast.children) {
      warnings.push('Widget has no slot or children composition defined');
    }

    if (!ast.events && !ast.handlers) {
      warnings.push('Widget has no event handlers defined');
    }

    if (warnings.length > 0) {
      return {
        variant: 'incomplete',
        warnings: JSON.stringify(warnings),
      };
    }

    return { variant: 'ok' };
  },
};
