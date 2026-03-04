// ============================================================
// Clef Surface AppKit Widget — RadioGroup
//
// Mutually exclusive option group using NSButton radio style.
// Manages single selection across a vertical list of options.
// ============================================================

import AppKit

public class ClefRadioGroupView: NSView {
    public var options: [(label: String, value: String)] = [] { didSet { rebuild() } }
    public var selectedValue: String? { didSet { syncState() } }
    public var label: String = "" { didSet { labelField.stringValue = label } }
    public var onSelectionChange: ((String) -> Void)?

    private let labelField = NSTextField(labelWithString: "")
    private let stackView = NSStackView()
    private var radioButtons: [NSButton] = []

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
        radioButtons.forEach { stackView.removeArrangedSubview($0); $0.removeFromSuperview() }
        radioButtons = options.map { opt in
            let btn = NSButton(radioButtonWithTitle: opt.label, target: self, action: #selector(handleChange(_:)))
            btn.identifier = NSUserInterfaceItemIdentifier(opt.value)
            return btn
        }
        radioButtons.forEach { stackView.addArrangedSubview($0) }
        syncState()
    }

    private func syncState() {
        for btn in radioButtons {
            btn.state = btn.identifier?.rawValue == selectedValue ? .on : .off
        }
    }

    @objc private func handleChange(_ sender: NSButton) {
        guard let val = sender.identifier?.rawValue else { return }
        selectedValue = val
        onSelectionChange?(val)
    }

    public override func layout() {
        super.layout()
        labelField.frame = NSRect(x: 0, y: bounds.height - 20, width: bounds.width, height: 20)
        stackView.frame = NSRect(x: 0, y: 0, width: bounds.width, height: bounds.height - 26)
    }
}
