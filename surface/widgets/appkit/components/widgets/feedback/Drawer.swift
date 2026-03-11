// ============================================================
// Clef Surface AppKit Widget — Drawer
//
// Slide-in panel from screen edge. Supports left, right, top,
// and bottom placement with overlay backdrop.
// ============================================================

import AppKit

public class ClefDrawerView: NSView {
    public enum Edge { case left, right, top, bottom }

    public var edge: Edge = .right
    public var drawerWidth: CGFloat = 320
    public var isOpen: Bool = false { didSet { animateDrawer() } }
    public var onClose: (() -> Void)?

    private let backdrop = NSView()
    private let panel = NSView()

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        isHidden = true
        backdrop.wantsLayer = true
        backdrop.layer?.backgroundColor = NSColor.black.withAlphaComponent(0.3).cgColor
        addSubview(backdrop)

        let click = NSClickGestureRecognizer(target: self, action: #selector(handleBackdropClick))
        backdrop.addGestureRecognizer(click)

        panel.wantsLayer = true
        panel.layer?.backgroundColor = NSColor.windowBackgroundColor.cgColor
        addSubview(panel)
    }

    @objc private func handleBackdropClick() { onClose?() }

    public func setContent(_ view: NSView) {
        panel.subviews.forEach { $0.removeFromSuperview() }
        panel.addSubview(view)
        view.frame = panel.bounds
    }

    private func animateDrawer() {
        isHidden = false
        let offscreen: NSRect
        let onscreen: NSRect

        switch edge {
        case .right:
            offscreen = NSRect(x: bounds.width, y: 0, width: drawerWidth, height: bounds.height)
            onscreen = NSRect(x: bounds.width - drawerWidth, y: 0, width: drawerWidth, height: bounds.height)
        case .left:
            offscreen = NSRect(x: -drawerWidth, y: 0, width: drawerWidth, height: bounds.height)
            onscreen = NSRect(x: 0, y: 0, width: drawerWidth, height: bounds.height)
        case .bottom:
            offscreen = NSRect(x: 0, y: -drawerWidth, width: bounds.width, height: drawerWidth)
            onscreen = NSRect(x: 0, y: 0, width: bounds.width, height: drawerWidth)
        case .top:
            offscreen = NSRect(x: 0, y: bounds.height, width: bounds.width, height: drawerWidth)
            onscreen = NSRect(x: 0, y: bounds.height - drawerWidth, width: bounds.width, height: drawerWidth)
        }

        backdrop.frame = bounds
        panel.frame = isOpen ? offscreen : onscreen

        NSAnimationContext.runAnimationGroup({ ctx in
            ctx.duration = 0.25
            ctx.allowsImplicitAnimation = true
            backdrop.animator().alphaValue = isOpen ? 1.0 : 0.0
            panel.animator().frame = isOpen ? onscreen : offscreen
        }, completionHandler: { [weak self] in
            if !(self?.isOpen ?? false) { self?.isHidden = true }
        })
    }
}
