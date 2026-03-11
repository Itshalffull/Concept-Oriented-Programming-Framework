// ============================================================
// Clef Surface AppKit Widget — NotationBadge
//
// Small badge displaying the active diagram notation on a canvas
// toolbar. Shows notation name with tooltip. Clicking opens
// notation selector.
// ============================================================

import AppKit

public class ClefNotationBadgeView: NSButton {
    public var notationId: String? = nil
    public var notationName: String? = nil { didSet { updateDisplay() } }
    public var notationIcon: String? = nil
    public var canvasId: String = ""
    public var onClick: (() -> Void)?

    private var trackingArea: NSTrackingArea?

    public override init(frame frameRect: NSRect) { super.init(frame: frameRect); setup() }
    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        wantsLayer = true
        bezelStyle = .inline
        isBordered = true
        font = NSFont.systemFont(ofSize: 11, weight: .medium)
        target = self
        action = #selector(badgeTapped(_:))
        layer?.cornerRadius = 4

        setAccessibilityRole(.button)
        updateDisplay()
    }

    public override func updateTrackingAreas() {
        super.updateTrackingAreas()
        if let existing = trackingArea { removeTrackingArea(existing) }
        trackingArea = NSTrackingArea(rect: bounds, options: [.mouseEnteredAndExited, .activeInActiveApp], owner: self, userInfo: nil)
        addTrackingArea(trackingArea!)
    }

    public override func mouseEntered(with event: NSEvent) {
        layer?.backgroundColor = NSColor.controlAccentColor.withAlphaComponent(0.15).cgColor
    }

    public override func mouseExited(with event: NSEvent) {
        layer?.backgroundColor = nil
    }

    private func updateDisplay() {
        let displayName = notationName ?? "Freeform"
        title = displayName
        toolTip = "Notation: \(displayName)"
        setAccessibilityLabel("Notation: \(displayName)")
    }

    @objc private func badgeTapped(_ sender: NSButton) {
        onClick?()
    }
}
