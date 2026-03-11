// ============================================================
// Clef Surface GTK Widget — FileBrowser
//
// File system browser with tree navigation and file list.
// Renders directories as expandable rows and files as selectable
// items in a ListBox.
//
// Adapts the file-browser.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export type FileEntryType = 'file' | 'directory';
export interface FileEntry { name: string; type: FileEntryType; size?: string; modified?: string; children?: FileEntry[]; }

// --------------- Props ---------------

export interface FileBrowserProps {
  entries?: FileEntry[];
  onFileSelect?: (path: string) => void;
  onNavigate?: (path: string) => void;
}

// --------------- Component ---------------

export function createFileBrowser(props: FileBrowserProps = {}): Gtk.Widget {
  const { entries = [], onFileSelect, onNavigate } = props;

  const box = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 0 });

  function buildEntries(items: FileEntry[], depth: number): void {
    items.forEach((entry) => {
      const iconName = entry.type === 'directory' ? 'folder-symbolic' : 'text-x-generic-symbolic';
      const row = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8, marginStart: depth * 16 });
      row.append(new Gtk.Image({ iconName, pixelSize: 16 }));

      if (entry.type === 'directory') {
        const btn = new Gtk.Button({ label: entry.name });
        btn.get_style_context().add_class('flat');
        btn.connect('clicked', () => onNavigate?.(entry.name));
        row.append(btn);
      } else {
        const btn = new Gtk.Button({ label: entry.name });
        btn.get_style_context().add_class('flat');
        btn.connect('clicked', () => onFileSelect?.(entry.name));
        row.append(btn);
        if (entry.size) {
          const sizeLabel = new Gtk.Label({ label: entry.size });
          sizeLabel.get_style_context().add_class('dim-label');
          row.append(sizeLabel);
        }
      }
      box.append(row);

      if (entry.children) buildEntries(entry.children, depth + 1);
    });
  }

  buildEntries(entries, 0);
  return box;
}
