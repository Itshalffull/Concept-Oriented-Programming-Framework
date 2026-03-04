// ============================================================
// Clef Surface AppKit Widget — SchemaEditor
//
// Visual editor for data schemas/models. Allows adding,
// removing, and editing fields with type selectors.
// ============================================================

import AppKit

public class ClefSchemaEditorView: NSView {
    public struct SchemaField {
        public var name: String
        public var type: String
        public var required: Bool
        public init(name: String, type: String, required: Bool = false) {
            self.name = name; self.type = type; self.required = required
        }
    }

    public var fields: [SchemaField] = [] { didSet { rebuild() } }
    public var availableTypes: [String] = ["String", "Int", "Float", "Bool", "Date", "Array", "Object"]
    public var onFieldsChange: (([SchemaField]) -> Void)?

    private let stackView = NSStackView()
    private let addButton = NSButton(title: "+ Add Field", target: nil, action: nil)

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        stackView.orientation = .vertical
        stackView.spacing = 6
        stackView.alignment = .leading
        addSubview(stackView)
        addButton.target = self
        addButton.action = #selector(addField)
        addButton.bezelStyle = .inline
        addSubview(addButton)
    }

    @objc private func addField() {
        fields.append(SchemaField(name: "newField", type: "String"))
        onFieldsChange?(fields)
    }

    private func rebuild() {
        stackView.arrangedSubviews.forEach { stackView.removeArrangedSubview($0); $0.removeFromSuperview() }
        for (i, field) in fields.enumerated() {
            let row = NSStackView()
            row.orientation = .horizontal
            row.spacing = 4

            let nameTF = NSTextField()
            nameTF.stringValue = field.name
            nameTF.placeholderString = "Field name"
            nameTF.widthAnchor.constraint(equalToConstant: 120).isActive = true
            row.addArrangedSubview(nameTF)

            let typePop = NSPopUpButton()
            typePop.addItems(withTitles: availableTypes)
            if let idx = availableTypes.firstIndex(of: field.type) { typePop.selectItem(at: idx) }
            row.addArrangedSubview(typePop)

            let reqCb = NSButton(checkboxWithTitle: "Required", target: nil, action: nil)
            reqCb.state = field.required ? .on : .off
            row.addArrangedSubview(reqCb)

            let removeBtn = NSButton(title: "x", target: self, action: #selector(removeField(_:)))
            removeBtn.tag = i
            removeBtn.bezelStyle = .inline
            row.addArrangedSubview(removeBtn)

            stackView.addArrangedSubview(row)
        }
    }

    @objc private func removeField(_ sender: NSButton) {
        guard sender.tag < fields.count else { return }
        fields.remove(at: sender.tag)
        onFieldsChange?(fields)
    }

    public override func layout() {
        super.layout()
        stackView.frame = NSRect(x: 0, y: 32, width: bounds.width, height: bounds.height - 32)
        addButton.frame = NSRect(x: 0, y: 4, width: 100, height: 24)
    }
}
