// ============================================================
// Clef Surface GTK Widget — TreeSelect
//
// Hierarchical tree selection control. Uses Gtk.TreeView with
// a Gtk.TreeStore for expandable tree-structured option
// selection.
//
// Adapts the tree-select.widget spec: anatomy (root, tree,
// branch, leaf, expandButton, checkbox), states (idle,
// expanded, selected), and connect attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface TreeSelectNode {
  id: string;
  label: string;
  children?: TreeSelectNode[];
}

// --------------- Props ---------------

export interface TreeSelectProps {
  nodes?: TreeSelectNode[];
  selectedId?: string | null;
  disabled?: boolean;
  onSelect?: (id: string) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 tree selection using nested Gtk.Expander
 * widgets for hierarchical option selection.
 */
export function createTreeSelect(props: TreeSelectProps = {}): Gtk.Widget {
  const {
    nodes = [],
    selectedId = null,
    disabled = false,
    onSelect,
  } = props;

  const scrolled = new Gtk.ScrolledWindow({
    minContentHeight: 200,
    hscrollbarPolicy: Gtk.PolicyType.NEVER,
    vscrollbarPolicy: Gtk.PolicyType.AUTOMATIC,
  });

  const container = new Gtk.Box({
    orientation: Gtk.Orientation.VERTICAL,
    spacing: 0,
  });

  function buildTree(treeNodes: TreeSelectNode[], depth: number): void {
    treeNodes.forEach((node) => {
      if (node.children && node.children.length > 0) {
        const expander = new Gtk.Expander({
          label: node.label,
          marginStart: depth * 16,
        });
        expander.set_sensitive(!disabled);

        const childBox = new Gtk.Box({
          orientation: Gtk.Orientation.VERTICAL,
          spacing: 0,
        });

        buildTree(node.children, depth + 1);

        node.children.forEach((child) => {
          const btn = new Gtk.Button({
            label: child.label,
          });
          btn.get_style_context().add_class('flat');
          btn.set_halign(Gtk.Align.START);
          if (child.id === selectedId) {
            btn.get_style_context().add_class('accent');
          }
          btn.set_sensitive(!disabled);
          btn.connect('clicked', () => onSelect?.(child.id));
          childBox.append(btn);
        });

        expander.set_child(childBox);
        container.append(expander);
      } else {
        const btn = new Gtk.Button({
          label: node.label,
        });
        btn.get_style_context().add_class('flat');
        btn.set_halign(Gtk.Align.START);
        btn.set_margin_start(depth * 16);
        if (node.id === selectedId) {
          btn.get_style_context().add_class('accent');
        }
        btn.set_sensitive(!disabled);
        btn.connect('clicked', () => onSelect?.(node.id));
        container.append(btn);
      }
    });
  }

  buildTree(nodes, 0);
  scrolled.set_child(container);
  return scrolled;
}
