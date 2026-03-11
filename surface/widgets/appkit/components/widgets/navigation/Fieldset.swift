// ============================================================
// Clef Surface AppKit Widget — Fieldset
//
// Groups related form controls with a legend/title and an
// optional border. Provides semantic grouping for forms.
// ============================================================

import AppKit

public class ClefFieldsetView: NSBox {
    public var legend: String = "" { didSet { title = legend } }
    public var disabled: Bool = false { didSet { updateDisabled() } }

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        boxType = .primary
        titlePosition = .atTop
        contentViewMargins = NSSize(width: 12, height: 12)
    }

    private func updateDisabled() {
        alphaValue = disabled ? 0.5 : 1.0
        contentView?.subviews.forEach { view in
            if let control = view as? NSControl { control.isEnabled = !disabled }
        }
    }

    public func addField(_ view: NSView) {
        contentView?.addSubview(view)
    }
}
