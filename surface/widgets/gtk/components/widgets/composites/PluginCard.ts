// ============================================================
// Clef Surface GTK Widget — PluginCard
//
// Card displaying plugin/extension information with install,
// enable/disable, and settings actions.
//
// Adapts the plugin-card.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface PluginCardProps {
  name?: string;
  description?: string;
  version?: string;
  enabled?: boolean;
  installed?: boolean;
  onToggle?: (enabled: boolean) => void;
  onInstall?: () => void;
  onSettings?: () => void;
}

// --------------- Component ---------------

export function createPluginCard(props: PluginCardProps = {}): Gtk.Widget {
  const { name = '', description = '', version = '', enabled = false, installed = true, onToggle, onInstall, onSettings } = props;

  const card = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 });
  card.get_style_context().add_class('card');

  const header = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
  const titleLabel = new Gtk.Label({ label: name, xalign: 0, hexpand: true });
  titleLabel.get_style_context().add_class('title-4');
  header.append(titleLabel);
  if (version) header.append(new Gtk.Label({ label: `v${version}` }));
  card.append(header);

  if (description) {
    const desc = new Gtk.Label({ label: description, xalign: 0, wrap: true });
    desc.get_style_context().add_class('dim-label');
    card.append(desc);
  }

  const actions = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });

  if (installed) {
    const toggle = new Gtk.Switch({ active: enabled });
    toggle.connect('notify::active', () => onToggle?.(toggle.get_active()));
    actions.append(toggle);

    if (onSettings) {
      const settingsBtn = new Gtk.Button({ iconName: 'emblem-system-symbolic', tooltipText: 'Settings' });
      settingsBtn.get_style_context().add_class('flat');
      settingsBtn.connect('clicked', onSettings);
      actions.append(settingsBtn);
    }
  } else {
    const installBtn = new Gtk.Button({ label: 'Install' });
    installBtn.get_style_context().add_class('suggested-action');
    if (onInstall) installBtn.connect('clicked', onInstall);
    actions.append(installBtn);
  }

  card.append(actions);
  return card;
}
