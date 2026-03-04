// ============================================================
// Clef Surface GTK Widget — Accordion
//
// Vertically stacked collapsible sections. Each section has a
// trigger heading and expandable content panel using
// Gtk.Expander. Supports single or multiple expanded sections.
//
// Adapts the accordion.widget spec: anatomy (root, item,
// trigger, indicator, content) to GTK4 rendering.
// See Architecture doc Section 16.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface AccordionItem {
  id: string;
  title: string;
  content: string;
}

// --------------- Props ---------------

export interface AccordionProps {
  items?: AccordionItem[];
  multiple?: boolean;
  defaultOpen?: string[];
  onChange?: (openIds: string[]) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 accordion with vertically stacked collapsible
 * Gtk.Expander sections.
 */
export function createAccordion(props: AccordionProps = {}): Gtk.Widget {
  const {
    items = [],
    multiple = false,
    defaultOpen = [],
    onChange,
  } = props;

  const openSet = new Set(defaultOpen);
  const box = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 0,
  });

  const expanders: Gtk.Expander[] = [];

  items.forEach((item, index) => {
    const expander = new Gtk.Expander({
      label: item.title,
      expanded: openSet.has(item.id),
    });

    expander.set_child(new Gtk.Label({
      label: item.content,
      wrap: true,
      xalign: 0,
    }));

    expander.connect('notify::expanded', () => {
      if (expander.get_expanded()) {
        openSet.add(item.id);
        if (!multiple) {
          expanders.forEach((other, otherIdx) => {
            if (otherIdx !== index && other.get_expanded()) {
              other.set_expanded(false);
              openSet.delete(items[otherIdx].id);
            }
          });
        }
      } else {
        openSet.delete(item.id);
      }
      onChange?.([...openSet]);
    });

    expanders.push(expander);
    box.append(expander);

    if (index < items.length - 1) {
      box.append(new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL }));
    }
  });

  return box;
}
