// ============================================================
// Clef Surface AppKit Widget — AutomationBuilder
//
// Visual builder for automation rules with trigger, condition,
// and action configuration steps.
// ============================================================

import AppKit

public class ClefAutomationBuilderView: NSView {
    public struct Step {
        public let type: String // "trigger", "condition", "action"
        public let label: String
        public var config: [String: String]
        public init(type: String, label: String, config: [String: String] = [:]) {
            self.type = type; self.label = label; self.config = config
        }
    }

    public var steps: [Step] = [] { didSet { rebuild() } }
    public var onStepsChange: (([Step]) -> Void)?

    private let scrollView = NSScrollView()
    private let stackView = NSStackView()
    private let addButton = NSButton(title: "+ Add Step", target: nil, action: nil)

    public override init(frame frameRect: NSRect) { super.init(frame: frameRect); setup() }
    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        stackView.orientation = .vertical; stackView.spacing = 12; stackView.alignment = .leading
        scrollView.documentView = stackView; scrollView.hasVerticalScroller = true; scrollView.drawsBackground = false
        addSubview(scrollView)
        addButton.target = self; addButton.action = #selector(addStep); addButton.bezelStyle = .rounded
        addSubview(addButton)
    }

    @objc private func addStep() {
        steps.append(Step(type: "action", label: "New Action"))
        onStepsChange?(steps)
    }

    private func rebuild() {
        stackView.arrangedSubviews.forEach { stackView.removeArrangedSubview($0); $0.removeFromSuperview() }
        for (i, step) in steps.enumerated() {
            let card = NSView(); card.wantsLayer = true
            card.layer?.cornerRadius = 6; card.layer?.borderWidth = 1; card.layer?.borderColor = NSColor.separatorColor.cgColor
            let typeLabel = NSTextField(labelWithString: step.type.uppercased())
            typeLabel.font = NSFont.systemFont(ofSize: 10, weight: .bold); typeLabel.textColor = .controlAccentColor
            card.addSubview(typeLabel); typeLabel.frame = NSRect(x: 8, y: 32, width: 80, height: 14)
            let nameLabel = NSTextField(labelWithString: step.label)
            nameLabel.font = NSFont.systemFont(ofSize: 13); card.addSubview(nameLabel)
            nameLabel.frame = NSRect(x: 8, y: 10, width: 200, height: 18)
            card.frame = NSRect(x: 0, y: 0, width: bounds.width - 20, height: 56)
            stackView.addArrangedSubview(card)
        }
    }

    public override func layout() {
        super.layout()
        scrollView.frame = NSRect(x: 0, y: 36, width: bounds.width, height: bounds.height - 36)
        addButton.frame = NSRect(x: 8, y: 4, width: 100, height: 28)
    }
}
