// ============================================================
// Clef Surface AppKit Widget — Skeleton
//
// Placeholder loading animation for content. Renders animated
// shimmer rectangles matching expected layout dimensions.
// ============================================================

import AppKit

public class ClefSkeletonView: NSView {
    public var variant: String = "text" { didSet { needsDisplay = true } }
    public var animated: Bool = true { didSet { toggleAnimation() } }

    private var animationTimer: Timer?

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
        layer?.cornerRadius = variant == "circle" ? bounds.height / 2 : 4
        layer?.backgroundColor = NSColor.separatorColor.cgColor
        toggleAnimation()
    }

    private func toggleAnimation() {
        animationTimer?.invalidate()
        guard animated else { return }
        animationTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            NSAnimationContext.runAnimationGroup({ ctx in
                ctx.duration = 0.5
                self.animator().alphaValue = 0.4
            }, completionHandler: {
                NSAnimationContext.runAnimationGroup { ctx in
                    ctx.duration = 0.5
                    self.animator().alphaValue = 1.0
                }
            })
        }
    }

    public override var intrinsicContentSize: NSSize {
        switch variant {
        case "circle": return NSSize(width: 40, height: 40)
        case "card": return NSSize(width: 240, height: 160)
        default: return NSSize(width: 200, height: 16)
        }
    }

    deinit { animationTimer?.invalidate() }
}
