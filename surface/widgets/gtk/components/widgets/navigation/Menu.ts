// ============================================================
// Clef Surface GTK Widget — Menu
//
// Dropdown menu triggered by a button. Uses Gtk.MenuButton
// with Gtk.PopoverMenu and Gio.Menu model for structured
// menu display.
//
// Adapts the menu.widget spec: anatomy (root, trigger, content,
// item, separator, group, label), states (open, closed), and
// connect attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';
import Gio from 'gi://Gio';

// --------------- Types ---------------

export interface MenuItem {
  id: string;
  label: string;
  disabled?: boolean;
}

// --------------- Props ---------------

export interface MenuProps {
  triggerLabel?: string;
  items?: MenuItem[];
  onSelect?: (id: string) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 menu button with a popover menu displaying
 * action items.
 */
export function createMenu(props: MenuProps = {}): Gtk.Widget {
  const {
    triggerLabel = 'Menu',
    items = [],
    onSelect,
  } = props;

  const gioMenu = new Gio.Menu();
  items.forEach((item) => {
    gioMenu.append(item.label, `menu.${item.id}`);
  });

  const menuButton = new Gtk.MenuButton({
    label: triggerLabel,
    menuModel: gioMenu,
  });

  // Action group
  const actionGroup = new Gio.SimpleActionGroup();
  items.forEach((item) => {
    const action = new Gio.SimpleAction({ name: item.id });
    action.set_enabled(!item.disabled);
    action.connect('activate', () => onSelect?.(item.id));
    actionGroup.add_action(action);
  });
  menuButton.insert_action_group('menu', actionGroup);

  return menuButton;
}
