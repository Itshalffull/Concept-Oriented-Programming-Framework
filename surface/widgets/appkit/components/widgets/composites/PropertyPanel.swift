// ============================================================
// Clef Surface AppKit Widget — PropertyPanel
//
// Inspector-style panel for editing object properties.
// Displays labeled fields in a vertical form layout.
// ============================================================

import AppKit

public class ClefPropertyPanelView: NSView {
    public struct Property {
        public let label: String
        public let type: String // "text", "number", "toggle", "color", "select"
        public var value: Any
        public init(label: String, type: String, value: Any) { self.label = label; self.type = type; self.value = value }
    }

    public var title: String = "Properties" { didSet { titleLabel.stringValue = title } }
    public var properties: [Property] = [] { didSet { rebuild() } }
    public var onPropertyChange: ((String, Any) -> Void)?

    private let titleLabel = NSTextField(labelWithString: "Properties")
    private let scrollView = NSScrollView()
    private let stackView = NSStackView()

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        titleLabel.font = NSFont.systemFont(ofSize: 13, weight: .semibold)
        addSubview(titleLabel)
        stackView.orientation = .vertical
        stackView.spacing = 8
        stackView.alignment = .leading
        scrollView.documentView = stackView
        scrollView.hasVerticalScroller = true
        scrollView.drawsBackground = false
        addSubview(scrollView)
    }

    private func rebuild() {
        stackView.arrangedSubviews.forEach { stackView.removeArrangedSubview($0); $0.removeFromSuperview() }
        for prop in properties {
            let row = NSStackView()
            row.orientation = .horizontal
            row.spacing = 8
            let lbl = NSTextField(labelWithString: prop.label)
            lbl.font = NSFont.systemFont(ofSize: 12)
            lbl.widthAnchor.constraint(equalToConstant: 100).isActive = true
            row.addArrangedSubview(lbl)

            switch prop.type {
            case "toggle":
                let sw = NSSwitch()
                sw.state = (prop.value as? Bool) == true ? .on : .off
                row.addArrangedSubview(sw)
            case "number":
                let tf = NSTextField()
                tf.doubleValue = prop.value as? Double ?? 0
                row.addArrangedSubview(tf)
            default:
                let tf = NSTextField()
                tf.stringValue = "\(prop.value)"
                row.addArrangedSubview(tf)
            }
            stackView.addArrangedSubview(row)
        }
    }

    public override func layout() {
        super.layout()
        titleLabel.frame = NSRect(x: 8, y: bounds.height - 24, width: bounds.width - 16, height: 20)
        scrollView.frame = NSRect(x: 0, y: 0, width: bounds.width, height: bounds.height - 28)
    }
}
