// ============================================================
// Clef Surface AppKit Widget — Toolbar
//
// Horizontal toolbar with icon buttons, separators, and
// grouped actions. Wraps NSToolbar items for window toolbars.
// ============================================================

import AppKit

public class ClefToolbarView: NSView {
    public struct ToolbarItem {
        public let id: String
        public let icon: String
        public let label: String
        public let action: () -> Void
        public init(id: String, icon: String, label: String, action: @escaping () -> Void) {
            self.id = id; self.icon = icon; self.label = label; self.action = action
        }
    }

    public var items: [ToolbarItem] = [] { didSet { rebuild() } }

    private let stackView = NSStackView()
    private var actionMap: [Int: () -> Void] = [:]

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

        stackView.orientation = .horizontal
        stackView.spacing = 4
        stackView.edgeInsets = NSEdgeInsets(top: 4, left: 8, bottom: 4, right: 8)
        addSubview(stackView)
    }

    private func rebuild() {
        stackView.arrangedSubviews.forEach { stackView.removeArrangedSubview($0); $0.removeFromSuperview() }
        actionMap.removeAll()
        for (i, item) in items.enumerated() {
            let btn = NSButton()
            btn.bezelStyle = .texturedRounded
            btn.image = NSImage(systemSymbolName: item.icon, accessibilityDescription: item.label)
            btn.toolTip = item.label
            btn.tag = i
            btn.target = self
            btn.action = #selector(handleAction(_:))
            stackView.addArrangedSubview(btn)
            actionMap[i] = item.action
        }
    }

    @objc private func handleAction(_ sender: NSButton) {
        actionMap[sender.tag]?()
    }

    public override func layout() {
        super.layout()
        stackView.frame = bounds
    }
}
