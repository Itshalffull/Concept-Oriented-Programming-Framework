// ============================================================
// Clef Surface AppKit Widget — Combobox
//
// Editable text field with a dropdown list of suggestions.
// Wraps NSComboBox for native macOS autocomplete behavior.
// ============================================================

import AppKit

public class ClefCombobox: NSComboBox {
    public var options: [String] = [] { didSet { reloadData() } }
    public var onSelectionChange: ((String) -> Void)?

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        usesDataSource = false
        completes = true
        target = self
        action = #selector(handleSelection)
    }

    public func setOptions(_ items: [String]) {
        removeAllItems()
        addItems(withObjectValues: items)
        options = items
    }

    @objc private func handleSelection() {
        onSelectionChange?(stringValue)
    }
}
