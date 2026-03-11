// ============================================================
// Clef Surface GTK Widget — Pagination
//
// Page navigation control with previous/next buttons and
// numbered page indicators. Renders as a horizontal Gtk.Box
// with linked buttons.
//
// Adapts the pagination.widget spec: anatomy (root, prevButton,
// nextButton, item, ellipsis), states (first, last, idle), and
// connect attributes to GTK4 rendering.
// ============================================================

import Gtk from 'gi://Gtk?version=4.0';

// --------------- Props ---------------

export interface PaginationProps {
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
}

// --------------- Component ---------------

/**
 * Creates a GTK4 pagination control as a horizontal row of
 * page buttons with previous/next navigation.
 */
export function createPagination(props: PaginationProps = {}): Gtk.Widget {
  const {
    currentPage = 1,
    totalPages = 1,
    onPageChange,
  } = props;

  const box = new Gtk.Box({
    orientation: Gtk.Orientation.HORIZONTAL,
    spacing: 0,
  });
  box.get_style_context().add_class('linked');

  // Previous button
  const prevBtn = new Gtk.Button({ iconName: 'go-previous-symbolic' });
  prevBtn.set_sensitive(currentPage > 1);
  prevBtn.connect('clicked', () => onPageChange?.(currentPage - 1));
  box.append(prevBtn);

  // Page buttons
  for (let i = 1; i <= totalPages; i++) {
    if (totalPages > 7 && i > 3 && i < totalPages - 2 && Math.abs(i - currentPage) > 1) {
      if (i === 4 || i === totalPages - 3) {
        box.append(new Gtk.Label({ label: '...' }));
      }
      continue;
    }

    const pageBtn = new Gtk.ToggleButton({
      label: String(i),
      active: i === currentPage,
    });
    pageBtn.connect('clicked', () => onPageChange?.(i));
    box.append(pageBtn);
  }

  // Next button
  const nextBtn = new Gtk.Button({ iconName: 'go-next-symbolic' });
  nextBtn.set_sensitive(currentPage < totalPages);
  nextBtn.connect('clicked', () => onPageChange?.(currentPage + 1));
  box.append(nextBtn);

  return box;
}
