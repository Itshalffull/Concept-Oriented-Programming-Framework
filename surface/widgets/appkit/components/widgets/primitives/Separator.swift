// ============================================================
// Clef Surface AppKit Widget — Separator
//
// Visual divider line (horizontal or vertical) for separating
// content sections. Renders as a thin NSBox separator.
// ============================================================

import AppKit

public class ClefSeparator: NSBox {
    public var orientation: NSUserInterfaceLayoutOrientation = .horizontal {
        didSet { updateOrientation() }
    }

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        boxType = .separator
        updateOrientation()
    }

    private func updateOrientation() {
        if orientation == .vertical {
            setFrameSize(NSSize(width: 1, height: frame.height))
        } else {
            setFrameSize(NSSize(width: frame.width, height: 1))
        }
    }

    public override var intrinsicContentSize: NSSize {
        return orientation == .horizontal
            ? NSSize(width: NSView.noIntrinsicMetric, height: 1)
            : NSSize(width: 1, height: NSView.noIntrinsicMetric)
    }
}
