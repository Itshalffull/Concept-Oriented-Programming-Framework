// ============================================================
// Clef Surface AppKit Widget — Select
//
// Single-value dropdown selector using NSPopUpButton.
// Supports grouped options and placeholder text.
// ============================================================

import AppKit

public class ClefSelect: NSPopUpButton {
    public var options: [(label: String, value: String)] = [] { didSet { rebuild() } }
    public var placeholder: String = "Select..." { didSet { rebuild() } }
    public var onSelectionChange: ((String) -> Void)?

    public override init(frame frameRect: NSRect, pullsDown: Bool = false) {
        super.init(frame: frameRect, pullsDown: false)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        target = self
        action = #selector(handleChange)
    }

    private func rebuild() {
        removeAllItems()
        addItem(withTitle: placeholder)
        for opt in options {
            addItem(withTitle: opt.label)
            lastItem?.representedObject = opt.value
        }
    }

    @objc private func handleChange() {
        guard let val = selectedItem?.representedObject as? String else { return }
        onSelectionChange?(val)
    }
}
