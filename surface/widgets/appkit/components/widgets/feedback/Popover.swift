// ============================================================
// Clef Surface AppKit Widget — Popover
//
// Floating content panel anchored to a trigger view. Wraps
// NSPopover with configurable edge and behavior.
// ============================================================

import AppKit

public class ClefPopover {
    public var preferredEdge: NSRectEdge = .maxY
    public var behavior: NSPopover.Behavior = .transient
    public var onOpen: (() -> Void)?
    public var onClose: (() -> Void)?

    private let popover = NSPopover()

    public init() {
        popover.delegate = self
    }

    public func setContent(_ viewController: NSViewController) {
        popover.contentViewController = viewController
        popover.behavior = behavior
    }

    public func show(relativeTo rect: NSRect, of view: NSView) {
        popover.show(relativeTo: rect, of: view, preferredEdge: preferredEdge)
        onOpen?()
    }

    public func close() {
        popover.close()
    }
}

extension ClefPopover: NSPopoverDelegate {
    public func popoverDidClose(_ notification: Notification) {
        onClose?()
    }
}
