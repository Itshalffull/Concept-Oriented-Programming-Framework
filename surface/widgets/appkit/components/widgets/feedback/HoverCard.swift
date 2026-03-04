// ============================================================
// Clef Surface AppKit Widget — HoverCard
//
// Rich content card that appears on hover over a trigger view.
// Uses NSPopover with a delay for hover-based display.
// ============================================================

import AppKit

public class ClefHoverCard {
    public var delay: TimeInterval = 0.5
    public var onOpen: (() -> Void)?
    public var onClose: (() -> Void)?

    private let popover = NSPopover()
    private var hoverTimer: Timer?
    private var trackingArea: NSTrackingArea?

    public func setContent(_ viewController: NSViewController) {
        popover.contentViewController = viewController
        popover.behavior = .transient
    }

    public func attach(to view: NSView) {
        let area = NSTrackingArea(rect: view.bounds, options: [.mouseEnteredAndExited, .activeInActiveApp], owner: self, userInfo: ["view": view])
        view.addTrackingArea(area)
        trackingArea = area
    }

    @objc func mouseEntered(with event: NSEvent) {
        guard let view = trackingArea?.userInfo?["view"] as? NSView else { return }
        hoverTimer = Timer.scheduledTimer(withTimeInterval: delay, repeats: false) { [weak self] _ in
            self?.popover.show(relativeTo: view.bounds, of: view, preferredEdge: .maxY)
            self?.onOpen?()
        }
    }

    @objc func mouseExited(with event: NSEvent) {
        hoverTimer?.invalidate()
        popover.close()
        onClose?()
    }
}
