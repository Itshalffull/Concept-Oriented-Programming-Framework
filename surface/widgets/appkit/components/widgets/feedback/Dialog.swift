// ============================================================
// Clef Surface AppKit Widget — Dialog
//
// Modal dialog window with title bar, content area, and footer
// actions. Presents as a sheet or floating panel.
// ============================================================

import AppKit

public class ClefDialog: NSPanel {
    public var dialogTitle: String = "" { didSet { title = dialogTitle } }
    public var onDismiss: (() -> Void)?

    private let contentStack = NSStackView()
    private let footerStack = NSStackView()

    public convenience init(width: CGFloat = 480, height: CGFloat = 320) {
        let rect = NSRect(x: 0, y: 0, width: width, height: height)
        self.init(contentRect: rect, styleMask: [.titled, .closable], backing: .buffered, defer: true)
        setup()
    }

    private func setup() {
        isFloatingPanel = true
        becomesKeyOnlyIfNeeded = false
        level = .modalPanel

        contentStack.orientation = .vertical
        contentStack.spacing = 12
        contentStack.edgeInsets = NSEdgeInsets(top: 16, left: 16, bottom: 0, right: 16)

        footerStack.orientation = .horizontal
        footerStack.spacing = 8
        footerStack.alignment = .centerY

        let wrapper = NSStackView()
        wrapper.orientation = .vertical
        wrapper.spacing = 0
        wrapper.addArrangedSubview(contentStack)
        wrapper.addArrangedSubview(footerStack)
        contentView = wrapper
    }

    public func setBody(_ view: NSView) {
        contentStack.arrangedSubviews.forEach { contentStack.removeArrangedSubview($0); $0.removeFromSuperview() }
        contentStack.addArrangedSubview(view)
    }

    public func setFooter(_ views: [NSView]) {
        footerStack.arrangedSubviews.forEach { footerStack.removeArrangedSubview($0); $0.removeFromSuperview() }
        views.forEach { footerStack.addArrangedSubview($0) }
    }

    public func present(from parent: NSWindow) {
        parent.beginSheet(self) { [weak self] _ in
            self?.onDismiss?()
        }
    }

    public func dismiss() {
        if let parent = sheetParent {
            parent.endSheet(self)
        } else {
            close()
        }
    }
}
