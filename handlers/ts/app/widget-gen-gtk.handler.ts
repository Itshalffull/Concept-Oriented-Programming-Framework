// WidgetGenGtk — GTK widget generation provider
// Produces C GtkWidget factory functions with signal connections.

import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

let idCounter = 0;
function nextId(): string { return `widget-gen-gtk-${++idCounter}`; }

function toCType(type: string): string {
  switch (type) {
    case 'string': return 'const gchar*';
    case 'number': return 'gdouble';
    case 'boolean': return 'gboolean';
    case 'int': case 'integer': return 'gint';
    default: return 'gpointer';
  }
}

function toSnakeCase(name: string): string {
  return name.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
}

export const widgetGenGtkHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();
    const providerRef = 'widget-gen-provider:gtk';

    const existing = await storage.find('widget-gen-gtk', { providerRef });
    if (existing.length > 0) return { variant: 'ok', instance: existing[0].id as string };

    await storage.put('widget-gen-gtk', id, { id, providerRef, target: 'gtk' });
    await storage.put('plugin-registry', `widget-gen-provider:${id}`, {
      id: `widget-gen-provider:${id}`,
      pluginKind: 'widget-gen-provider',
      target: 'gtk',
      providerRef,
      instanceId: id,
    });

    return { variant: 'ok', instance: id };
  },

  async generate(input: Record<string, unknown>, storage: ConceptStorage) {
    const widgetAst = input.widgetAst as string;

    let ast: Record<string, unknown>;
    try {
      ast = JSON.parse(widgetAst);
    } catch {
      return { variant: 'error', message: 'Failed to parse widget AST as JSON' };
    }

    const componentName = (ast.name as string) || 'Widget';
    const snakeName = toSnakeCase(componentName);
    const props = (ast.props || []) as Array<{ name: string; type: string }>;
    const params = props.map(p => `${toCType(p.type)} ${p.name}`).join(', ');
    const paramList = params ? `, ${params}` : '';

    const lines: string[] = [];
    lines.push('#include <gtk/gtk.h>');
    lines.push('');
    lines.push(`GtkWidget* ${snakeName}_new(GtkWidget* parent${paramList}) {`);
    lines.push('    GtkWidget* widget = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);');
    lines.push(`    GtkWidget* label = gtk_label_new("${componentName}");`);
    lines.push('    gtk_box_append(GTK_BOX(widget), label);');
    lines.push('    return widget;');
    lines.push('}');

    const output = lines.join('\n');

    return { variant: 'ok', output };
  },
};

export function resetWidgetGenGtkCounter(): void { idCounter = 0; }
