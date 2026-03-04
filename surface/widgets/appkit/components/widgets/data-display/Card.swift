// ============================================================
// Clef Surface AppKit Widget — Card
//
// Bordered container with optional header, body, and footer
// sections. Supports elevation shadow and click actions.
// ============================================================

import AppKit

public class ClefCardView: NSView {
    public var cardTitle: String = "" { didSet { titleLabel.stringValue = cardTitle } }
    public var subtitle: String = "" { didSet { subtitleLabel.stringValue = subtitle } }
    public var elevation: Int = 1 { didSet { updateShadow() } }
    public var onClick: (() -> Void)?

    private let titleLabel = NSTextField(labelWithString: "")
    private let subtitleLabel = NSTextField(labelWithString: "")
    private let bodyContainer = NSView()

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        wantsLayer = true
        layer?.cornerRadius = 8
        layer?.borderWidth = 1
        layer?.borderColor = NSColor.separatorColor.cgColor
        layer?.backgroundColor = NSColor.controlBackgroundColor.cgColor

        titleLabel.font = NSFont.systemFont(ofSize: 15, weight: .semibold)
        titleLabel.isEditable = false
        titleLabel.isBezeled = false
        titleLabel.drawsBackground = false
        addSubview(titleLabel)

        subtitleLabel.font = NSFont.systemFont(ofSize: 12)
        subtitleLabel.textColor = .secondaryLabelColor
        subtitleLabel.isEditable = false
        subtitleLabel.isBezeled = false
        subtitleLabel.drawsBackground = false
        addSubview(subtitleLabel)

        addSubview(bodyContainer)
        updateShadow()

        let click = NSClickGestureRecognizer(target: self, action: #selector(handleClick))
        addGestureRecognizer(click)
    }

    @objc private func handleClick() { onClick?() }

    public func setBody(_ view: NSView) {
        bodyContainer.subviews.forEach { $0.removeFromSuperview() }
        bodyContainer.addSubview(view)
        view.frame = bodyContainer.bounds
    }

    private func updateShadow() {
        layer?.shadowColor = NSColor.black.cgColor
        layer?.shadowOpacity = Float(elevation) * 0.05
        layer?.shadowRadius = CGFloat(elevation) * 3
        layer?.shadowOffset = NSSize(width: 0, height: -CGFloat(elevation))
    }

    public override func layout() {
        super.layout()
        let pad: CGFloat = 16
        titleLabel.frame = NSRect(x: pad, y: bounds.height - 32, width: bounds.width - pad * 2, height: 20)
        subtitleLabel.frame = NSRect(x: pad, y: bounds.height - 50, width: bounds.width - pad * 2, height: 16)
        bodyContainer.frame = NSRect(x: pad, y: pad, width: bounds.width - pad * 2, height: bounds.height - 70)
    }
}
