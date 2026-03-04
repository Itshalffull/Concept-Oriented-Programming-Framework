// ============================================================
// Clef Surface AppKit Widget — CheckboxGroup
//
// Vertical group of related checkboxes with a shared label
// and value binding. Manages multiple selection state.
// ============================================================

import AppKit

public class ClefCheckboxGroupView: NSView {
    public var options: [(label: String, value: String)] = [] { didSet { rebuild() } }
    public var selectedValues: Set<String> = [] { didSet { syncState() } }
    public var label: String = "" { didSet { labelField.stringValue = label } }
    public var onSelectionChange: ((Set<String>) -> Void)?

    private let labelField = NSTextField(labelWithString: "")
    private let stackView = NSStackView()
    private var checkboxes: [NSButton] = []

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        labelField.font = NSFont.systemFont(ofSize: 13, weight: .medium)
        stackView.orientation = .vertical
        stackView.alignment = .leading
        stackView.spacing = 6
        addSubview(labelField)
        addSubview(stackView)
    }

    private func rebuild() {
        checkboxes.forEach { stackView.removeArrangedSubview($0); $0.removeFromSuperview() }
        checkboxes = options.map { opt in
            let cb = NSButton(checkboxWithTitle: opt.label, target: self, action: #selector(handleChange(_:)))
            cb.identifier = NSUserInterfaceItemIdentifier(opt.value)
            return cb
        }
        checkboxes.forEach { stackView.addArrangedSubview($0) }
        syncState()
    }

    private func syncState() {
        for cb in checkboxes {
            cb.state = selectedValues.contains(cb.identifier?.rawValue ?? "") ? .on : .off
        }
    }

    @objc private func handleChange(_ sender: NSButton) {
        guard let val = sender.identifier?.rawValue else { return }
        if sender.state == .on { selectedValues.insert(val) } else { selectedValues.remove(val) }
        onSelectionChange?(selectedValues)
    }

    public override func layout() {
        super.layout()
        labelField.frame = NSRect(x: 0, y: bounds.height - 20, width: bounds.width, height: 20)
        stackView.frame = NSRect(x: 0, y: 0, width: bounds.width, height: bounds.height - 26)
    }
}
