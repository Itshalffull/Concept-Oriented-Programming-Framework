// ============================================================
// Clef Surface AppKit Widget — FocusTrap
//
// Container that constrains keyboard focus to its children,
// cycling Tab/Shift-Tab within the trap boundary. Useful for
// modal dialogs and popovers.
// ============================================================

import AppKit

public class ClefFocusTrapView: NSView {
    public var active: Bool = true

    public override func keyDown(with event: NSEvent) {
        guard active else { super.keyDown(with: event); return }

        if event.keyCode == 48 { // Tab key
            let focusable = collectFocusableViews(in: self)
            guard !focusable.isEmpty else { return }

            let current = window?.firstResponder as? NSView
            let currentIndex = focusable.firstIndex(where: { $0 === current }) ?? -1

            if event.modifierFlags.contains(.shift) {
                let prev = currentIndex <= 0 ? focusable.count - 1 : currentIndex - 1
                window?.makeFirstResponder(focusable[prev])
            } else {
                let next = (currentIndex + 1) % focusable.count
                window?.makeFirstResponder(focusable[next])
            }
        } else {
            super.keyDown(with: event)
        }
    }

    private func collectFocusableViews(in view: NSView) -> [NSView] {
        var result: [NSView] = []
        for child in view.subviews {
            if child.acceptsFirstResponder && !child.isHidden {
                result.append(child)
            }
            result.append(contentsOf: collectFocusableViews(in: child))
        }
        return result
    }
}
