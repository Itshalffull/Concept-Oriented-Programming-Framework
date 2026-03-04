// ============================================================
// Clef Surface AppKit Widget — Form
//
// Structured form container that manages field layout,
// validation state, and submit/reset actions.
// ============================================================

import AppKit

public class ClefFormView: NSView {
    public var onSubmit: (([String: Any]) -> Void)?
    public var onReset: (() -> Void)?

    private let stackView = NSStackView()
    private var fields: [(name: String, control: NSControl)] = []

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        stackView.orientation = .vertical
        stackView.spacing = 12
        stackView.alignment = .leading
        addSubview(stackView)
    }

    public func addField(name: String, label: String, control: NSControl) {
        let lbl = NSTextField(labelWithString: label)
        lbl.font = NSFont.systemFont(ofSize: 12, weight: .medium)

        let row = NSStackView(views: [lbl, control])
        row.orientation = .vertical
        row.alignment = .leading
        row.spacing = 4
        stackView.addArrangedSubview(row)
        fields.append((name: name, control: control))
    }

    public func addActions(submitLabel: String = "Submit", resetLabel: String = "Reset") {
        let submitBtn = NSButton(title: submitLabel, target: self, action: #selector(handleSubmit))
        let resetBtn = NSButton(title: resetLabel, target: self, action: #selector(handleReset))
        resetBtn.bezelStyle = .rounded
        let row = NSStackView(views: [resetBtn, submitBtn])
        row.orientation = .horizontal
        row.spacing = 8
        stackView.addArrangedSubview(row)
    }

    @objc private func handleSubmit() {
        var values: [String: Any] = [:]
        for field in fields {
            if let tf = field.control as? NSTextField { values[field.name] = tf.stringValue }
            else if let btn = field.control as? NSButton { values[field.name] = btn.state == .on }
            else if let popup = field.control as? NSPopUpButton { values[field.name] = popup.selectedItem?.title ?? "" }
        }
        onSubmit?(values)
    }

    @objc private func handleReset() { onReset?() }

    public override func layout() {
        super.layout()
        stackView.frame = bounds
    }
}
