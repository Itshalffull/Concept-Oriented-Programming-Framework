// GTK Target Interpreter — C with GObject/GTK4

import type { RenderInstruction } from '../render-program-builder.js';
import { classify, groupStates } from './_classify.js';

export function interpretGtk(instructions: RenderInstruction[], componentName: string): { output: string; trace: string[] } {
  const c = classify(instructions, 'gtk');
  const lines: string[] = [];
  const snake = toSnake(componentName);
  const upper = snake.toUpperCase();
  const camel = componentName;

  lines.push(`#include <gtk/gtk.h>`);
  lines.push('');

  // Type definition
  lines.push(`typedef struct _${camel} ${camel};`);
  lines.push(`struct _${camel} {`);
  lines.push(`    GtkBox parent_instance;`);

  // Props as fields
  for (const p of c.props) {
    const ct = cType(p.propType);
    lines.push(`    ${ct} ${p.name};`);
  }

  // State fields
  const stateGroups = groupStates(c.states);
  for (const [group, gStates] of stateGroups) {
    const initial = gStates.find(s => s.initial) || gStates[0];
    const v = group || 'state';
    lines.push(`    const gchar *${v}; /* initial: "${initial.name}" */`);
  }

  // Anatomy part widgets
  for (const el of c.elements) {
    lines.push(`    GtkWidget *${el.part}; /* ${el.role} */`);
  }

  lines.push(`};`);
  lines.push('');
  lines.push(`G_DEFINE_TYPE(${camel}, ${snake}, GTK_TYPE_BOX)`);
  lines.push('');

  // Send function
  if (c.transitions.length > 0) {
    lines.push(`static void ${snake}_send(${camel} *self, const gchar *event) {`);
    for (const [group] of stateGroups) {
      const v = group || 'state';
      const gt = c.transitions.filter(t => {
        const pfx = group ? group + '.' : '';
        return t.fromState.startsWith(pfx) || (!group && !t.fromState.includes('.'));
      });
      if (gt.length > 0) {
        const byFrom = groupBy(gt, t => t.fromState);
        for (const [from, trans] of byFrom) {
          lines.push(`    if (g_strcmp0(self->${v}, "${from}") == 0) {`);
          for (const t of trans) {
            lines.push(`        if (g_strcmp0(event, "${t.event}") == 0) { self->${v} = "${t.toState}"; return; }`);
          }
          lines.push(`    }`);
        }
      }
    }
    lines.push(`}`);
    lines.push('');
  }

  // Key press handler
  if (c.keyboards.length > 0) {
    lines.push(`static gboolean ${snake}_key_pressed(GtkEventControllerKey *controller, guint keyval, guint keycode, GdkModifierType state, gpointer user_data) {`);
    lines.push(`    ${camel} *self = (${camel} *)user_data;`);
    lines.push(`    switch (keyval) {`);
    for (const kb of c.keyboards) {
      lines.push(`    case GDK_KEY_${gdkKey(kb.key)}: ${snake}_send(self, "${kb.event}"); return TRUE;`);
    }
    lines.push(`    default: return FALSE;`);
    lines.push(`    }`);
    lines.push(`}`);
    lines.push('');
  }

  // Click handlers
  const clickBinds = [...c.bindMap.entries()].flatMap(([part, binds]) =>
    binds.filter(b => b.attr === 'onClick' || b.attr.startsWith('on')).map(b => ({ part, ...b }))
  );
  for (const cb of clickBinds) {
    const m = cb.expr.match(/send\s*\(\s*(\w+)\s*\)/);
    const event = m ? m[1] : 'click';
    lines.push(`static void ${snake}_${cb.part}_clicked(GtkButton *button, gpointer user_data) {`);
    lines.push(`    ${snake}_send((${camel} *)user_data, "${event}");`);
    lines.push(`}`);
    lines.push('');
  }

  // Init
  lines.push(`static void ${snake}_init(${camel} *self) {`);
  lines.push(`    gtk_orientable_set_orientation(GTK_ORIENTABLE(self), GTK_ORIENTATION_VERTICAL);`);

  // Initialize state
  for (const [group, gStates] of stateGroups) {
    const initial = gStates.find(s => s.initial) || gStates[0];
    const v = group || 'state';
    lines.push(`    self->${v} = "${initial.name}";`);
  }

  // Create anatomy parts
  for (const el of c.elements) {
    lines.push(`    self->${el.part} = gtk_box_new(GTK_ORIENTATION_VERTICAL, 0);`);
    const ariaAttrs = c.ariaMap.get(el.part) || [];
    const labelAttr = ariaAttrs.find(a => a.attr === 'label' || a.attr === 'aria-label');
    if (labelAttr) {
      lines.push(`    gtk_accessible_update_property(GTK_ACCESSIBLE(self->${el.part}), GTK_ACCESSIBLE_PROPERTY_LABEL, "${labelAttr.value}", -1);`);
    }
    lines.push(`    gtk_box_append(GTK_BOX(self), self->${el.part});`);
  }

  // Keyboard controller
  if (c.keyboards.length > 0) {
    lines.push(`    GtkEventController *key_ctrl = gtk_event_controller_key_new();`);
    lines.push(`    g_signal_connect(key_ctrl, "key-pressed", G_CALLBACK(${snake}_key_pressed), self);`);
    lines.push(`    gtk_widget_add_controller(GTK_WIDGET(self), key_ctrl);`);
  }

  // Focus
  if (c.focusConfig) {
    lines.push(`    gtk_widget_set_focusable(GTK_WIDGET(self), TRUE);`);
    lines.push(`    gtk_widget_grab_focus(GTK_WIDGET(self));`);
  }

  // Prop defaults
  for (const p of c.props) {
    if (p.defaultValue) {
      if (p.propType.toLowerCase() === 'string') lines.push(`    self->${p.name} = "${p.defaultValue}";`);
      else lines.push(`    self->${p.name} = ${p.defaultValue};`);
    }
  }

  lines.push(`}`);
  lines.push('');

  // Class init
  lines.push(`static void ${snake}_class_init(${camel}Class *klass) {`);
  lines.push(`    /* TODO: Register properties and signals */`);
  lines.push(`}`);
  lines.push('');

  // Constructor
  lines.push(`GtkWidget *${snake}_new(void) {`);
  lines.push(`    return g_object_new(${upper}_TYPE, NULL);`);
  lines.push(`}`);

  return { output: lines.join('\n'), trace: c.trace };
}

function toSnake(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}
function cType(t: string): string {
  const l = t.toLowerCase();
  if (l === 'string') return 'const gchar *';
  if (l === 'bool' || l === 'boolean') return 'gboolean';
  if (l === 'int' || l === 'integer') return 'gint';
  if (l === 'number') return 'gdouble';
  return 'gpointer';
}
function gdkKey(key: string): string {
  if (key === 'Enter') return 'Return';
  if (key === 'Escape') return 'Escape';
  if (key === 'Tab') return 'Tab';
  if (key === 'Space') return 'space';
  if (key === 'ArrowUp') return 'Up';
  if (key === 'ArrowDown') return 'Down';
  return key;
}
function groupBy<T>(arr: T[], key: (t: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const t of arr) { const k = key(t); if (!m.has(k)) m.set(k, []); m.get(k)!.push(t); }
  return m;
}
