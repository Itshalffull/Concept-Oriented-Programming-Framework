// ============================================================
// Clef Surface GTK Widget — ContextMenu
//
// Right-click context menu overlay. Uses Gtk.PopoverMenu
// attached to a widget with a GestureClick controller for
// secondary button activation.
//
// Adapts the context-menu.widget spec: anatomy (root, trigger,
// content, item, separator, group), states (open, closed), and
// connect attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';
import Gio from 'gi://Gio';

// --------------- Types ---------------

export interface ContextMenuItem {
  id: string;
  label: string;
  disabled?: boolean;
}

// --------------- Props ---------------

export interface ContextMenuProps {
  items?: ContextMenuItem[];
  target?: Gtk.Widget | null;
  onSelect?: (id: string) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 context menu using Gtk.PopoverMenu attached
 * to the target widget, triggered by right-click.
 */
export function createContextMenu(props: ContextMenuProps = {}): Gtk.Widget {
  const {
    items = [],
    target = null,
    onSelect,
  } = props;

  const menu = new Gio.Menu();
  items.forEach((item) => {
    menu.append(item.label, `ctx.${item.id}`);
  });

  const popoverMenu = Gtk.PopoverMenu.new_from_model(menu);
  popoverMenu.set_has_arrow(false);

  if (target) {
    popoverMenu.set_parent(target);

    // Right-click gesture
    const gesture = new Gtk.GestureClick({ button: 3 });
    gesture.connect('released', (_gesture: Gtk.GestureClick, _n: number, x: number, y: number) => {
      popoverMenu.set_pointing_to({ x: Math.round(x), y: Math.round(y), width: 1, height: 1 });
      popoverMenu.popup();
    });
    target.add_controller(gesture);

    // Action group for selections
    const actionGroup = new Gio.SimpleActionGroup();
    items.forEach((item) => {
      const action = new Gio.SimpleAction({ name: item.id });
      action.set_enabled(!item.disabled);
      action.connect('activate', () => onSelect?.(item.id));
      actionGroup.add_action(action);
    });
    target.insert_action_group('ctx', actionGroup);
  }

  return popoverMenu;
}
