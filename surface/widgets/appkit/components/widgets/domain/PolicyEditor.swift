// ============================================================
// Clef Surface AppKit Widget — PolicyEditor
//
// Editor for access control policies with subject, resource,
// action, and effect configuration.
// ============================================================

import AppKit

public class ClefPolicyEditorView: NSView {
    public struct PolicyRule {
        public var subject: String
        public var resource: String
        public var action: String
        public var effect: String // "allow" or "deny"
        public init(subject: String = "", resource: String = "", action: String = "", effect: String = "allow") {
            self.subject = subject; self.resource = resource; self.action = action; self.effect = effect
        }
    }

    public var rules: [PolicyRule] = [] { didSet { rebuild() } }
    public var onRulesChange: (([PolicyRule]) -> Void)?

    private let stackView = NSStackView()
    private let addButton = NSButton(title: "+ Add Rule", target: nil, action: nil)

    public override init(frame frameRect: NSRect) { super.init(frame: frameRect); setup() }
    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        stackView.orientation = .vertical; stackView.spacing = 8; stackView.alignment = .leading
        addSubview(stackView)
        addButton.target = self; addButton.action = #selector(addRule); addButton.bezelStyle = .inline
        addSubview(addButton)
    }

    @objc private func addRule() { rules.append(PolicyRule()); onRulesChange?(rules) }

    private func rebuild() {
        stackView.arrangedSubviews.forEach { stackView.removeArrangedSubview($0); $0.removeFromSuperview() }
        for (i, rule) in rules.enumerated() {
            let row = NSStackView(); row.orientation = .horizontal; row.spacing = 4
            let effectPop = NSPopUpButton(); effectPop.addItems(withTitles: ["allow", "deny"])
            if rule.effect == "deny" { effectPop.selectItem(at: 1) }
            let subTF = NSTextField(); subTF.stringValue = rule.subject; subTF.placeholderString = "Subject"
            let resTF = NSTextField(); resTF.stringValue = rule.resource; resTF.placeholderString = "Resource"
            let actTF = NSTextField(); actTF.stringValue = rule.action; actTF.placeholderString = "Action"
            let removeBtn = NSButton(title: "x", target: self, action: #selector(removeRule(_:)))
            removeBtn.tag = i; removeBtn.bezelStyle = .inline
            row.addArrangedSubview(effectPop); row.addArrangedSubview(subTF)
            row.addArrangedSubview(resTF); row.addArrangedSubview(actTF); row.addArrangedSubview(removeBtn)
            stackView.addArrangedSubview(row)
        }
    }

    @objc private func removeRule(_ sender: NSButton) {
        guard sender.tag < rules.count else { return }
        rules.remove(at: sender.tag); onRulesChange?(rules)
    }

    public override func layout() {
        super.layout()
        stackView.frame = NSRect(x: 0, y: 32, width: bounds.width, height: bounds.height - 32)
        addButton.frame = NSRect(x: 0, y: 4, width: 100, height: 24)
    }
}
