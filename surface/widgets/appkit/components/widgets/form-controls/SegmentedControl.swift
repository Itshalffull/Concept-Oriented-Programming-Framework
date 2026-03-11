// ============================================================
// Clef Surface AppKit Widget — SegmentedControl
//
// Horizontal segmented selector for switching between views
// or modes. Wraps NSSegmentedControl.
// ============================================================

import AppKit

public class ClefSegmentedControl: NSSegmentedControl {
    public var options: [String] = [] { didSet { rebuild() } }
    public var onSelectionChange: ((Int) -> Void)?

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        segmentStyle = .rounded
        target = self
        action = #selector(handleChange)
    }

    private func rebuild() {
        segmentCount = options.count
        for (i, opt) in options.enumerated() {
            setLabel(opt, forSegment: i)
            setWidth(0, forSegment: i) // auto-size
        }
        if !options.isEmpty { selectedSegment = 0 }
    }

    @objc private func handleChange() {
        onSelectionChange?(selectedSegment)
    }
}
