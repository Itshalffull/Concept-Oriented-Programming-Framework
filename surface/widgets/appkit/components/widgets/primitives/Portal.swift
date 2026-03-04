// ============================================================
// Clef Surface AppKit Widget — Portal
//
// Renders child views into a detached window or a different
// location in the view hierarchy. Useful for modals, popovers,
// and overlay content that must escape clipping bounds.
// ============================================================

import AppKit

public class ClefPortalView: NSView {
    public var targetView: NSView?

    private var portalledViews: [NSView] = []

    public func portalSubview(_ view: NSView) {
        if let target = targetView {
            target.addSubview(view)
        } else if let contentView = window?.contentView {
            contentView.addSubview(view)
        }
        portalledViews.append(view)
    }

    public func removeAllPortalled() {
        portalledViews.forEach { $0.removeFromSuperview() }
        portalledViews.removeAll()
    }

    deinit {
        removeAllPortalled()
    }
}
