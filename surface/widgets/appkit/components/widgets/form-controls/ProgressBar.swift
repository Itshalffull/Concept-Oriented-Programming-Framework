// ============================================================
// Clef Surface AppKit Widget — ProgressBar
//
// Determinate or indeterminate progress indicator displayed
// as a horizontal bar. Wraps NSProgressIndicator bar style.
// ============================================================

import AppKit

public class ClefProgressBar: NSProgressIndicator {
    public var progress: Double = 0 { didSet { doubleValue = progress * 100 } }

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        style = .bar
        isIndeterminate = false
        minValue = 0
        maxValue = 100
    }

    public func setIndeterminate(_ flag: Bool) {
        isIndeterminate = flag
        if flag { startAnimation(nil) } else { stopAnimation(nil) }
    }
}
