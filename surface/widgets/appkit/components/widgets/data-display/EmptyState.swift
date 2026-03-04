// ============================================================
// Clef Surface AppKit Widget — EmptyState
//
// Placeholder view for empty data states. Shows an icon,
// title, description, and optional action button.
// ============================================================

import AppKit

public class ClefEmptyStateView: NSView {
    public var icon: String = "tray" { didSet { needsDisplay = true } }
    public var title: String = "No data" { didSet { needsDisplay = true } }
    public var message: String = "" { didSet { needsDisplay = true } }
    public var actionLabel: String? = nil { didSet { actionButton.isHidden = actionLabel == nil } }
    public var onAction: (() -> Void)?

    private let actionButton = NSButton()

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        actionButton.bezelStyle = .rounded
        actionButton.target = self
        actionButton.action = #selector(handleAction)
        actionButton.isHidden = true
        addSubview(actionButton)
    }

    @objc private func handleAction() { onAction?() }

    public override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        let centerX = bounds.midX
        var y = bounds.midY + 40

        if let img = NSImage(systemSymbolName: icon, accessibilityDescription: nil) {
            let config = NSImage.SymbolConfiguration(pointSize: 40, weight: .light)
            let sized = img.withSymbolConfiguration(config) ?? img
            let imgRect = NSRect(x: centerX - 24, y: y - 8, width: 48, height: 48)
            sized.draw(in: imgRect)
            y -= 56
        }

        let titleAttrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 16, weight: .semibold),
            .foregroundColor: NSColor.labelColor,
        ]
        let titleSize = (title as NSString).size(withAttributes: titleAttrs)
        (title as NSString).draw(at: NSPoint(x: centerX - titleSize.width / 2, y: y), withAttributes: titleAttrs)
        y -= 24

        let msgAttrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 13),
            .foregroundColor: NSColor.secondaryLabelColor,
        ]
        let msgSize = (message as NSString).size(withAttributes: msgAttrs)
        (message as NSString).draw(at: NSPoint(x: centerX - msgSize.width / 2, y: y), withAttributes: msgAttrs)
    }

    public override func layout() {
        super.layout()
        if let label = actionLabel {
            actionButton.title = label
            actionButton.sizeToFit()
            actionButton.frame.origin = NSPoint(x: (bounds.width - actionButton.frame.width) / 2, y: bounds.midY - 60)
        }
    }
}
