// ============================================================
// Clef Surface AppKit Widget — FloatingToolbar
//
// Detached toolbar that floats above content. Appears on
// text selection or context-specific actions.
// ============================================================

import AppKit

public class ClefFloatingToolbarView: NSView {
    public var items: [NSView] = [] { didSet { rebuild() } }
    public var visible: Bool = false { didSet { animateVisibility() } }

    private let stackView = NSStackView()

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
        layer?.backgroundColor = NSColor.windowBackgroundColor.cgColor
        layer?.cornerRadius = 8
        layer?.shadowColor = NSColor.black.cgColor
        layer?.shadowOpacity = 0.15
        layer?.shadowRadius = 8
        layer?.shadowOffset = NSSize(width: 0, height: -2)

        stackView.orientation = .horizontal
        stackView.spacing = 2
        stackView.edgeInsets = NSEdgeInsets(top: 4, left: 8, bottom: 4, right: 8)
        addSubview(stackView)

        alphaValue = 0
        isHidden = true
    }

    private func rebuild() {
        stackView.arrangedSubviews.forEach { stackView.removeArrangedSubview($0); $0.removeFromSuperview() }
        items.forEach { stackView.addArrangedSubview($0) }
    }

    private func animateVisibility() {
        if visible { isHidden = false }
        NSAnimationContext.runAnimationGroup({ ctx in
            ctx.duration = 0.15
            animator().alphaValue = visible ? 1.0 : 0.0
        }, completionHandler: { [weak self] in
            if !(self?.visible ?? false) { self?.isHidden = true }
        })
    }

    public override func layout() {
        super.layout()
        stackView.frame = bounds
    }
}
