// ============================================================
// Clef Surface AppKit Widget — Tooltip
//
// Small informational popup on hover. Uses the native
// NSView toolTip property or a custom styled overlay.
// ============================================================

import AppKit

public class ClefTooltip {
    public var text: String = ""
    public var position: String = "top"
    public var delay: TimeInterval = 0.5

    private var tooltipWindow: NSWindow?
    private var hoverTimer: Timer?

    public func attach(to view: NSView) {
        // Native tooltip for simple cases
        view.toolTip = text

        // For custom positioning, use tracking area
        let area = NSTrackingArea(rect: view.bounds, options: [.mouseEnteredAndExited, .activeInActiveApp], owner: self, userInfo: ["view": view])
        view.addTrackingArea(area)
    }

    @objc func mouseEntered(with event: NSEvent) {
        guard let view = event.trackingArea?.userInfo?["view"] as? NSView else { return }
        hoverTimer = Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { [weak self] _ in
            self?.showCustomTooltip(for: view)
        }
    }

    @objc func mouseExited(with event: NSEvent) {
        hoverTimer?.invalidate()
        tooltipWindow?.orderOut(nil)
        tooltipWindow = nil
    }

    private func showCustomTooltip(for view: NSView) {
        guard let window = view.window else { return }
        let viewRect = view.convert(view.bounds, to: nil)
        let screenRect = window.convertToScreen(viewRect)

        let label = NSTextField(labelWithString: text)
        label.font = NSFont.systemFont(ofSize: 11)
        label.sizeToFit()

        let size = NSSize(width: label.frame.width + 16, height: label.frame.height + 8)
        let origin = NSPoint(x: screenRect.midX - size.width / 2, y: screenRect.maxY + 4)

        let tipWindow = NSWindow(contentRect: NSRect(origin: origin, size: size), styleMask: .borderless, backing: .buffered, defer: false)
        tipWindow.backgroundColor = .windowBackgroundColor
        tipWindow.level = .floating
        tipWindow.isOpaque = false
        tipWindow.contentView = label
        label.frame.origin = NSPoint(x: 8, y: 4)
        tipWindow.orderFront(nil)
        tooltipWindow = tipWindow
    }
}
