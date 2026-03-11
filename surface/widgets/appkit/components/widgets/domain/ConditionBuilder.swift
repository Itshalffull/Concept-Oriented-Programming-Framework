// ============================================================
// Clef Surface AppKit Widget — ConditionBuilder
//
// Visual builder for logical condition trees with AND/OR
// groups and nested condition rules.
// ============================================================

import AppKit

public class ClefConditionBuilderView: NSView {
    public indirect enum Condition {
        case rule(field: String, op: String, value: String)
        case group(logic: String, children: [Condition]) // "AND" or "OR"
    }

    public var root: Condition = .group(logic: "AND", children: [])  { didSet { rebuild() } }
    public var fields: [String] = []
    public var onConditionChange: ((Condition) -> Void)?

    private let scrollView = NSScrollView()
    private let stackView = NSStackView()

    public override init(frame frameRect: NSRect) { super.init(frame: frameRect); setup() }
    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        stackView.orientation = .vertical; stackView.spacing = 8; stackView.alignment = .leading
        scrollView.documentView = stackView; scrollView.hasVerticalScroller = true; scrollView.drawsBackground = false
        addSubview(scrollView)
    }

    private func rebuild() {
        stackView.arrangedSubviews.forEach { stackView.removeArrangedSubview($0); $0.removeFromSuperview() }
        renderCondition(root, indent: 0)
    }

    private func renderCondition(_ condition: Condition, indent: Int) {
        let padding = CGFloat(indent) * 20
        switch condition {
        case .rule(let field, let op, let value):
            let row = NSStackView()
            row.orientation = .horizontal; row.spacing = 4
            let spacer = NSView(); spacer.widthAnchor.constraint(equalToConstant: padding).isActive = true
            row.addArrangedSubview(spacer)
            row.addArrangedSubview(NSTextField(labelWithString: "\(field) \(op) \(value)"))
            stackView.addArrangedSubview(row)
        case .group(let logic, let children):
            let header = NSTextField(labelWithString: logic)
            header.font = NSFont.systemFont(ofSize: 12, weight: .bold)
            header.textColor = .controlAccentColor
            stackView.addArrangedSubview(header)
            for child in children { renderCondition(child, indent: indent + 1) }
        }
    }

    public override func layout() {
        super.layout()
        scrollView.frame = bounds
    }
}
