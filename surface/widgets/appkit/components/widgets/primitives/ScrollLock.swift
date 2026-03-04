// ============================================================
// Clef Surface AppKit Widget — ScrollLock
//
// Prevents or restores scrolling on a parent NSScrollView.
// Useful when modals or overlays are active to prevent
// background content from scrolling.
// ============================================================

import AppKit

public class ClefScrollLock {
    private weak var scrollView: NSScrollView?
    private var savedHasVertical: Bool = true
    private var savedHasHorizontal: Bool = true

    public var locked: Bool = false {
        didSet { locked ? lock() : unlock() }
    }

    public init(scrollView: NSScrollView? = nil) {
        self.scrollView = scrollView
    }

    public func attach(to scrollView: NSScrollView) {
        self.scrollView = scrollView
    }

    private func lock() {
        guard let sv = scrollView else { return }
        savedHasVertical = sv.hasVerticalScroller
        savedHasHorizontal = sv.hasHorizontalScroller
        sv.hasVerticalScroller = false
        sv.hasHorizontalScroller = false
    }

    private func unlock() {
        guard let sv = scrollView else { return }
        sv.hasVerticalScroller = savedHasVertical
        sv.hasHorizontalScroller = savedHasHorizontal
    }
}
