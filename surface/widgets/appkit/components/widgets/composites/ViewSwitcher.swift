// ============================================================
// Clef Surface AppKit Widget — ViewSwitcher
//
// Container that switches between multiple named child views
// with transition animations.
// ============================================================

import AppKit

public class ClefViewSwitcherView: NSView {
    public var views: [(id: String, view: NSView)] = []
    public var currentViewId: String? { didSet { switchView() } }
    public var animated: Bool = true

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    public func addView(id: String, view: NSView) {
        views.append((id, view))
        addSubview(view)
        view.frame = bounds
        view.isHidden = true
    }

    private func switchView() {
        for (id, view) in views {
            let shouldShow = id == currentViewId
            if animated {
                NSAnimationContext.runAnimationGroup { ctx in
                    ctx.duration = 0.2
                    view.animator().alphaValue = shouldShow ? 1.0 : 0.0
                }
            }
            view.isHidden = !shouldShow
        }
    }

    public override func layout() {
        super.layout()
        views.forEach { $0.view.frame = bounds }
    }
}
