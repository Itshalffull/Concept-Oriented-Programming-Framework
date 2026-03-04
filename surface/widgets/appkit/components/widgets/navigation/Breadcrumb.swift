// ============================================================
// Clef Surface AppKit Widget — Breadcrumb
//
// Horizontal navigation trail showing the current location
// hierarchy. Each crumb is clickable except the last.
// ============================================================

import AppKit

public class ClefBreadcrumbView: NSView {
    public struct Crumb {
        public let label: String
        public let action: (() -> Void)?
        public init(label: String, action: (() -> Void)? = nil) {
            self.label = label
            self.action = action
        }
    }

    public var crumbs: [Crumb] = [] { didSet { rebuild() } }
    public var separator: String = "/"

    private let stackView = NSStackView()

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        stackView.orientation = .horizontal
        stackView.spacing = 4
        addSubview(stackView)
    }

    private func rebuild() {
        stackView.arrangedSubviews.forEach { stackView.removeArrangedSubview($0); $0.removeFromSuperview() }
        for (i, crumb) in crumbs.enumerated() {
            if i > 0 {
                let sep = NSTextField(labelWithString: separator)
                sep.font = NSFont.systemFont(ofSize: 12)
                sep.textColor = .tertiaryLabelColor
                stackView.addArrangedSubview(sep)
            }
            let isLast = i == crumbs.count - 1
            if isLast {
                let label = NSTextField(labelWithString: crumb.label)
                label.font = NSFont.systemFont(ofSize: 12, weight: .medium)
                label.textColor = .labelColor
                label.isEditable = false
                label.isBezeled = false
                label.drawsBackground = false
                stackView.addArrangedSubview(label)
            } else {
                let btn = NSButton(title: crumb.label, target: self, action: #selector(crumbClicked(_:)))
                btn.tag = i
                btn.bezelStyle = .inline
                btn.isBordered = false
                btn.font = NSFont.systemFont(ofSize: 12)
                btn.contentTintColor = .controlAccentColor
                stackView.addArrangedSubview(btn)
            }
        }
    }

    @objc private func crumbClicked(_ sender: NSButton) {
        guard sender.tag < crumbs.count else { return }
        crumbs[sender.tag].action?()
    }

    public override func layout() {
        super.layout()
        stackView.frame = bounds
    }
}
