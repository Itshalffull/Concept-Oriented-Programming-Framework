// ============================================================
// Clef Surface GTK Widget — ImageGallery
//
// Image gallery with grid thumbnails and lightbox preview.
// Uses Gtk.FlowBox for thumbnail grid layout.
//
// Adapts the image-gallery.widget spec to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Types ---------------

export interface GalleryImage { id: string; src: string; alt?: string; }

// --------------- Props ---------------

export interface ImageGalleryProps {
  images?: GalleryImage[];
  columns?: number;
  onImageClick?: (id: string) => void;
}

// --------------- Component ---------------

export function createImageGallery(props: ImageGalleryProps = {}): Gtk.Widget {
  const { images = [], columns = 3, onImageClick } = props;

  const flowBox = new Gtk.FlowBox({
    selectionMode: Gtk.SelectionMode.NONE,
    maxChildrenPerLine: columns,
    homogeneous: true,
  });

  images.forEach((img) => {
    const thumb = new Gtk.Box({
      orientation: Gtk.Orientation.VERTICAL,
      spacing: 4,
      widthRequest: 120,
      heightRequest: 120,
    });
    thumb.get_style_context().add_class('card');

    const icon = new Gtk.Image({ iconName: 'image-x-generic-symbolic', pixelSize: 64 });
    thumb.append(icon);

    if (img.alt) {
      const altLabel = new Gtk.Label({ label: img.alt, ellipsize: 3 });
      altLabel.get_style_context().add_class('dim-label');
      thumb.append(altLabel);
    }

    const gesture = new Gtk.GestureClick();
    gesture.connect('released', () => onImageClick?.(img.id));
    thumb.add_controller(gesture);

    flowBox.insert(thumb, -1);
  });

  return flowBox;
}
