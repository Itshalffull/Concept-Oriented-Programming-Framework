// ============================================================
// Clef Surface GTK Widget — Outliner
//
// Hierarchical outline editor with indented items and
// expand/collapse behavior.
//
// Adapts the outliner.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface OutlineItem { id: string; text: string; children?: OutlineItem[]; expanded?: boolean; }

// --------------- Props ---------------

export interface OutlinerProps {
  items?: OutlineItem[];
  onItemChange?: (id: string, text: string) => void;
  onToggle?: (id: string) => void;
}

// --------------- Component ---------------

export function createOutliner(props: OutlinerProps = {}): Gtk.Widget {
  const { items = [], onItemChange, onToggle } = props;

  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 0 });

  function buildItems(outlineItems: OutlineItem[], depth: number): void {
    outlineItems.forEach((item) => {
      const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4, marginStart: depth * 20 });

      if (item.children && item.children.length > 0) {
        const toggleBtn = new Gtk.Button({
          iconName: item.expanded ? 'pan-down-symbolic' : 'pan-end-symbolic',
        });
        toggleBtn.get_style_context().add_class('flat');
        toggleBtn.connect('clicked', () => onToggle?.(item.id));
        row.append(toggleBtn);
      } else {
        row.append(new Gtk.Label({ label: '\u2022', widthChars: 2 }));
      }

      const entry = new Gtk.Entry({ text: item.text, hexpand: true });
      entry.get_style_context().add_class('flat');
      entry.connect('changed', () => onItemChange?.(item.id, entry.get_text()));
      row.append(entry);

      box.append(row);

      if (item.expanded && item.children) {
        buildItems(item.children, depth + 1);
      }
    });
  }

  buildItems(items, 0);
  return box;
}
