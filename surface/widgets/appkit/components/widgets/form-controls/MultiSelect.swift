// ============================================================
// Clef Surface AppKit Widget — MultiSelect
//
// Dropdown that allows selecting multiple options with
// checkmarks. Displays selected count or tags.
// ============================================================

import AppKit

public class ClefMultiSelectView: NSView {
    public var options: [(label: String, value: String)] = [] { didSet { needsDisplay = true } }
    public var selectedValues: Set<String> = [] { didSet { updateDisplay() } }
    public var placeholder: String = "Select..." { didSet { updateDisplay() } }
    public var onSelectionChange: ((Set<String>) -> Void)?

    private let button = NSPopUpButton()
    private let menu = NSMenu()

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        addSubview(button)
        button.pullsDown = true
        updateDisplay()
    }

    private func updateDisplay() {
        menu.removeAllItems()
        let title = selectedValues.isEmpty ? placeholder : "\(selectedValues.count) selected"
        menu.addItem(NSMenuItem(title: title, action: nil, keyEquivalent: ""))
        for opt in options {
            let item = NSMenuItem(title: opt.label, action: #selector(toggleOption(_:)), keyEquivalent: "")
            item.target = self
            item.representedObject = opt.value
            item.state = selectedValues.contains(opt.value) ? .on : .off
            menu.addItem(item)
        }
        button.menu = menu
    }

    @objc private func toggleOption(_ sender: NSMenuItem) {
        guard let val = sender.representedObject as? String else { return }
        if selectedValues.contains(val) { selectedValues.remove(val) } else { selectedValues.insert(val) }
        onSelectionChange?(selectedValues)
    }

    public override func layout() {
        super.layout()
        button.frame = bounds
    }
}
