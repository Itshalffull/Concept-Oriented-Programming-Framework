// ============================================================
// Clef Surface GTK Widget — DragHandle
//
// Grip handle for drag-and-drop reordering. Renders as a
// visual grip icon that can initiate drag operations.
//
// Adapts the drag-handle.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface DragHandleProps {
  orientation?: 'vertical' | 'horizontal';
}

// --------------- Component ---------------

export function createDragHandle(props: DragHandleProps = {}): Gtk.Widget {
  const { orientation = 'vertical' } = props;

  const handle = new Gtk.Image({
    iconName: orientation === 'horizontal' ? 'drag-handle-horizontal-symbolic' : 'list-drag-handle-symbolic',
    pixelSize: 16,
  });
  handle.set_cursor_from_name('grab');
  handle.set_tooltip_text('Drag to reorder');

  return handle;
}
