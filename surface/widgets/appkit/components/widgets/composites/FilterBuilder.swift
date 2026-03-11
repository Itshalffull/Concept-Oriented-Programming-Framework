// ============================================================
// Clef Surface AppKit Widget — FilterBuilder
//
// Dynamic filter rule builder with add/remove rows and
// configurable field, operator, and value selectors.
// ============================================================

import AppKit

public class ClefFilterBuilderView: NSView {
    public struct FilterRule {
        public var field: String
        public var op: String
        public var value: String
        public init(field: String = "", op: String = "equals", value: String = "") {
            self.field = field; self.op = op; self.value = value
        }
    }

    public var fields: [String] = []
    public var operators: [String] = ["equals", "contains", "starts with", "greater than", "less than"]
    public var rules: [FilterRule] = [] { didSet { rebuild() } }
    public var onRulesChange: (([FilterRule]) -> Void)?

    private let stackView = NSStackView()
    private let addButton = NSButton(title: "+ Add Filter", target: nil, action: nil)

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        stackView.orientation = .vertical
        stackView.spacing = 8
        stackView.alignment = .leading
        addSubview(stackView)
        addButton.target = self
        addButton.action = #selector(addRule)
        addButton.bezelStyle = .inline
        addSubview(addButton)
    }

    @objc private func addRule() {
        rules.append(FilterRule())
        onRulesChange?(rules)
    }

    private func rebuild() {
        stackView.arrangedSubviews.forEach { stackView.removeArrangedSubview($0); $0.removeFromSuperview() }
        for (i, rule) in rules.enumerated() {
            let row = NSStackView()
            row.orientation = .horizontal
            row.spacing = 4

            let fieldPop = NSPopUpButton()
            fieldPop.addItems(withTitles: fields)
            if let idx = fields.firstIndex(of: rule.field) { fieldPop.selectItem(at: idx) }
            row.addArrangedSubview(fieldPop)

            let opPop = NSPopUpButton()
            opPop.addItems(withTitles: operators)
            if let idx = operators.firstIndex(of: rule.op) { opPop.selectItem(at: idx) }
            row.addArrangedSubview(opPop)

            let valueTF = NSTextField()
            valueTF.stringValue = rule.value
            valueTF.placeholderString = "Value"
            row.addArrangedSubview(valueTF)

            let removeBtn = NSButton(title: "x", target: self, action: #selector(removeRule(_:)))
            removeBtn.tag = i
            removeBtn.bezelStyle = .inline
            row.addArrangedSubview(removeBtn)

            stackView.addArrangedSubview(row)
        }
    }

    @objc private func removeRule(_ sender: NSButton) {
        guard sender.tag < rules.count else { return }
        rules.remove(at: sender.tag)
        onRulesChange?(rules)
    }

    public override func layout() {
        super.layout()
        stackView.frame = NSRect(x: 0, y: 32, width: bounds.width, height: bounds.height - 32)
        addButton.frame = NSRect(x: 0, y: 0, width: 120, height: 24)
    }
}
