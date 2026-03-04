// ============================================================
// Clef Surface AppKit Widget — ToastManager
//
// Manages a queue of toast notifications, stacking them
// vertically and auto-dismissing in order.
// ============================================================

import AppKit

public class ClefToastManager {
    public static let shared = ClefToastManager()

    public var maxVisible: Int = 5
    public var position: String = "top-right"

    private var toasts: [ClefToastView] = []
    private weak var parentView: NSView?

    public func configure(parentView: NSView) {
        self.parentView = parentView
    }

    public func show(message: String, variant: String = "info", duration: TimeInterval = 3.0) {
        guard let parent = parentView else { return }

        let toast = ClefToastView()
        toast.message = message
        toast.variant = variant
        toast.duration = duration

        toasts.append(toast)
        if toasts.count > maxVisible {
            toasts.first?.dismiss()
            toasts.removeFirst()
        }

        toast.show(in: parent)
        layoutToasts()

        Timer.scheduledTimer(withTimeInterval: duration + 0.3, repeats: false) { [weak self] _ in
            self?.toasts.removeAll { $0 === toast }
            self?.layoutToasts()
        }
    }

    private func layoutToasts() {
        guard let parent = parentView else { return }
        for (i, toast) in toasts.enumerated() {
            let y = parent.bounds.height - CGFloat(60 + i * 52)
            NSAnimationContext.runAnimationGroup { ctx in
                ctx.duration = 0.15
                toast.animator().frame.origin.y = y
            }
        }
    }

    public func dismissAll() {
        toasts.forEach { $0.dismiss() }
        toasts.removeAll()
    }
}
