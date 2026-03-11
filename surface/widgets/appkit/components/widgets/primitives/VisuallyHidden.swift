// ============================================================
// Clef Surface AppKit Widget — VisuallyHidden
//
// Hides content visually while keeping it accessible to
// screen readers and VoiceOver. Positions content off-screen
// with a 1x1 clip rect.
// ============================================================

import AppKit

public class ClefVisuallyHiddenView: NSView {
    public override init(frame frameRect: NSRect) {
        super.init(frame: NSRect(x: -9999, y: -9999, width: 1, height: 1))
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        setAccessibilityElement(true)
    }

    public func setContent(_ view: NSView) {
        subviews.forEach { $0.removeFromSuperview() }
        addSubview(view)
        view.frame = bounds
    }

    public override var intrinsicContentSize: NSSize {
        return NSSize(width: 1, height: 1)
    }
}
