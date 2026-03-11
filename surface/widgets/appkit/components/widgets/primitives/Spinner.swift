// ============================================================
// Clef Surface AppKit Widget — Spinner
//
// Indeterminate progress indicator for loading states.
// Wraps NSProgressIndicator in spinning style.
// ============================================================

import AppKit

public class ClefSpinner: NSProgressIndicator {
    public var size: String = "md" { didSet { updateSize() } }

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        style = .spinning
        isIndeterminate = true
        startAnimation(nil)
        updateSize()
    }

    private func updateSize() {
        controlSize = size == "sm" ? .small : size == "lg" ? .large : .regular
        sizeToFit()
    }
}
