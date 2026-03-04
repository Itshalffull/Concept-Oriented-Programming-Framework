// ============================================================
// Clef Surface AppKit Widget — Checkbox
//
// Boolean toggle control rendered with NSButton checkbox style.
// Supports checked, unchecked, and indeterminate states with
// an optional label.
//
// Adapts the checkbox.widget spec to AppKit rendering.
// ============================================================

import AppKit

public class ClefCheckbox: NSButton {
    public var label: String? { didSet { title = label ?? "" } }
    public var checked: Bool = false { didSet { state = checked ? .on : .off } }
    public var indeterminate: Bool = false { didSet { if indeterminate { allowsMixedState = true; state = .mixed } } }
    public var onCheckedChange: ((Bool) -> Void)?

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        setButtonType(.switch)
        target = self
        action = #selector(handleChange)
    }

    @objc private func handleChange() {
        let isNowChecked = (state == .on)
        checked = isNowChecked
        onCheckedChange?(isNowChecked)
    }
}
