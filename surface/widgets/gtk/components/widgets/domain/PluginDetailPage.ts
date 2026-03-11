// ============================================================
// Clef Surface GTK Widget — PluginDetailPage
//
// Full-page plugin detail view with description, screenshots,
// reviews, and install/settings actions.
//
// Adapts the plugin-detail-page.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface PluginDetailPageProps {
  name?: string;
  version?: string;
  author?: string;
  description?: string;
  installed?: boolean;
  enabled?: boolean;
  onInstall?: () => void;
  onUninstall?: () => void;
  onToggle?: (enabled: boolean) => void;
}

// --------------- Component ---------------

export function createPluginDetailPage(props: PluginDetailPageProps = {}): Gtk.Widget {
  const { name = '', version = '', author = '', description = '', installed = false, enabled = false, onInstall, onUninstall, onToggle } = props;

  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 16 });

  // Header
  const header = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 });
  const titleLabel = new Gtk.Label({ label: name, xalign: 0 });
  titleLabel.get_style_context().add_class('title-1');
  header.append(titleLabel);

  const meta = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
  if (version) meta.append(new Gtk.Label({ label: `v${version}` }));
  if (author) { const a = new Gtk.Label({ label: `by ${author}` }); a.get_style_context().add_class('dim-label'); meta.append(a); }
  header.append(meta);
  box.append(header);

  // Description
  if (description) {
    const desc = new Gtk.Label({ label: description, xalign: 0, wrap: true });
    box.append(desc);
  }

  // Actions
  const actions = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 });
  if (installed) {
    const toggle = new Gtk.Switch({ active: enabled });
    toggle.connect('notify::active', () => onToggle?.(toggle.get_active()));
    actions.append(new Gtk.Label({ label: 'Enabled' }));
    actions.append(toggle);

    const uninstallBtn = new Gtk.Button({ label: 'Uninstall' });
    uninstallBtn.get_style_context().add_class('destructive-action');
    if (onUninstall) uninstallBtn.connect('clicked', onUninstall);
    actions.append(uninstallBtn);
  } else {
    const installBtn = new Gtk.Button({ label: 'Install' });
    installBtn.get_style_context().add_class('suggested-action');
    if (onInstall) installBtn.connect('clicked', onInstall);
    actions.append(installBtn);
  }
  box.append(actions);

  return box;
}
