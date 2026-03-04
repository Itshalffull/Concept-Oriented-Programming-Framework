// ============================================================
// Clef Surface AppKit Widget — SortBuilder
//
// Dynamic sort rule builder with draggable field ordering
// and ascending/descending toggles.
// ============================================================

import AppKit

public class ClefSortBuilderView: NSView {
    public struct SortRule {
        public var field: String
        public var ascending: Bool
        public init(field: String, ascending: Bool = true) { self.field = field; self.ascending = ascending }
    }

    public var fields: [String] = []
    public var rules: [SortRule] = [] { didSet { rebuild() } }
    public var onRulesChange: (([SortRule]) -> Void)?

    private let stackView = NSStackView()
    private let addButton = NSButton(title: "+ Add Sort", target: nil, action: nil)

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        stackView.orientation = .vertical
        stackView.spacing = 6
        addSubview(stackView)
        addButton.target = self
        addButton.action = #selector(addRule)
        addButton.bezelStyle = .inline
        addSubview(addButton)
    }

    @objc private func addRule() {
        guard let firstField = fields.first else { return }
        rules.append(SortRule(field: firstField))
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

            let dirBtn = NSButton(title: rule.ascending ? "ASC" : "DESC", target: self, action: #selector(toggleDir(_:)))
            dirBtn.tag = i
            dirBtn.bezelStyle = .inline
            row.addArrangedSubview(dirBtn)

            let removeBtn = NSButton(title: "x", target: self, action: #selector(removeRule(_:)))
            removeBtn.tag = i
            removeBtn.bezelStyle = .inline
            row.addArrangedSubview(removeBtn)

            stackView.addArrangedSubview(row)
        }
    }

    @objc private func toggleDir(_ sender: NSButton) {
        guard sender.tag < rules.count else { return }
        rules[sender.tag].ascending.toggle()
        onRulesChange?(rules)
    }

    @objc private func removeRule(_ sender: NSButton) {
        guard sender.tag < rules.count else { return }
        rules.remove(at: sender.tag)
        onRulesChange?(rules)
    }

    public override func layout() {
        super.layout()
        stackView.frame = NSRect(x: 0, y: 32, width: bounds.width, height: bounds.height - 32)
        addButton.frame = NSRect(x: 0, y: 4, width: 100, height: 24)
    }
}
