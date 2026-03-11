// ============================================================
// Clef Surface AppKit Widget — Presence
//
// Manages mount/unmount animations for child views. Tracks
// whether a child should be rendered and applies fade-in/out
// transitions during state changes.
// ============================================================

import AppKit

public class ClefPresenceView: NSView {
    public var present: Bool = true { didSet { animatePresence() } }
    public var duration: TimeInterval = 0.2

    private var contentView: NSView?

    public func setContent(_ view: NSView) {
        contentView = view
        addSubview(view)
        view.frame = bounds
        view.alphaValue = present ? 1.0 : 0.0
    }

    private func animatePresence() {
        guard let content = contentView else { return }
        NSAnimationContext.runAnimationGroup({ ctx in
            ctx.duration = duration
            ctx.allowsImplicitAnimation = true
            content.animator().alphaValue = present ? 1.0 : 0.0
        }, completionHandler: { [weak self] in
            if !(self?.present ?? true) {
                content.removeFromSuperview()
            }
        })
    }
}
