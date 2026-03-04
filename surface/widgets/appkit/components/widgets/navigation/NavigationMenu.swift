// ============================================================
// Clef Surface AppKit Widget — NavigationMenu
//
// Top-level navigation bar with dropdown sub-menus for each
// section. Renders as a horizontal row of menu triggers.
// ============================================================

import AppKit

public class ClefNavigationMenuView: NSView {
    public struct NavItem {
        public let title: String
        public let children: [NavItem]
        public let action: (() -> Void)?

        public init(title: String, children: [NavItem] = [], action: (() -> Void)? = nil) {
            self.title = title; self.children = children; self.action = action
        }
    }

    public var items: [NavItem] = [] { didSet { rebuild() } }

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
        stackView.orientation = .horizontal
        stackView.spacing = 4
        addSubview(stackView)
    }

    private func rebuild() {
        stackView.arrangedSubviews.forEach { stackView.removeArrangedSubview($0); $0.removeFromSuperview() }
        for (i, item) in items.enumerated() {
            let btn = NSButton(title: item.title, target: self, action: #selector(handleClick(_:)))
            btn.tag = i
            btn.bezelStyle = .inline
            btn.isBordered = false
            btn.font = NSFont.systemFont(ofSize: 13, weight: .medium)
            stackView.addArrangedSubview(btn)
        }
    }

    @objc private func handleClick(_ sender: NSButton) {
        guard sender.tag < items.count else { return }
        let item = items[sender.tag]
        if item.children.isEmpty {
            item.action?()
        } else {
            let menu = NSMenu()
            for child in item.children {
                let mi = NSMenuItem(title: child.title, action: nil, keyEquivalent: "")
                menu.addItem(mi)
            }
            menu.popUp(positioning: nil, at: NSPoint(x: 0, y: sender.bounds.height), in: sender)
        }
    }

    public override func layout() {
        super.layout()
        stackView.frame = bounds
    }
}
