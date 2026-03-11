// ============================================================
// Clef Surface AppKit Widget — Toast
//
// Temporary notification message displayed at screen edge.
// Auto-dismisses after a configurable duration.
// ============================================================

import AppKit

public class ClefToastView: NSView {
    public var message: String = "" { didSet { label.stringValue = message } }
    public var variant: String = "info" { didSet { needsDisplay = true } }
    public var duration: TimeInterval = 3.0

    private let label = NSTextField(labelWithString: "")
    private var dismissTimer: Timer?

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
        layer?.shadowColor = NSColor.black.cgColor
        layer?.shadowOpacity = 0.15
        layer?.shadowRadius = 8
        layer?.shadowOffset = NSSize(width: 0, height: -2)

        label.font = NSFont.systemFont(ofSize: 13)
        label.textColor = .labelColor
        label.lineBreakMode = .byTruncatingTail
        addSubview(label)
    }

    public func show(in parentView: NSView) {
        alphaValue = 0
        parentView.addSubview(self)
        frame = NSRect(x: (parentView.bounds.width - 300) / 2, y: parentView.bounds.height - 60, width: 300, height: 44)
        label.frame = bounds.insetBy(dx: 16, dy: 12)

        let bgColor: NSColor
        switch variant {
        case "success": bgColor = .systemGreen
        case "warning": bgColor = .systemOrange
        case "error": bgColor = .systemRed
        default: bgColor = .controlBackgroundColor
        }
        layer?.backgroundColor = bgColor.withAlphaComponent(0.95).cgColor

        NSAnimationContext.runAnimationGroup { ctx in
            ctx.duration = 0.2
            animator().alphaValue = 1.0
        }

        dismissTimer = Timer.scheduledTimer(withTimeInterval: duration, repeats: false) { [weak self] _ in
            self?.dismiss()
        }
    }

    public func dismiss() {
        dismissTimer?.invalidate()
        NSAnimationContext.runAnimationGroup({ ctx in
            ctx.duration = 0.2
            animator().alphaValue = 0.0
        }, completionHandler: { [weak self] in
            self?.removeFromSuperview()
        })
    }
}
