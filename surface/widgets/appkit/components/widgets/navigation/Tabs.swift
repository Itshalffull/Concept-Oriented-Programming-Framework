// ============================================================
// Clef Surface AppKit Widget — Tabs
//
// Tabbed content switcher with horizontal tab bar. Manages
// visibility of associated content views per tab.
// ============================================================

import AppKit

public class ClefTabsView: NSView {
    public struct Tab {
        public let id: String
        public let label: String
        public let icon: String?
        public let content: NSView
        public init(id: String, label: String, icon: String? = nil, content: NSView) {
            self.id = id; self.label = label; self.icon = icon; self.content = content
        }
    }

    public var tabs: [Tab] = [] { didSet { rebuild() } }
    public var selectedTabId: String? { didSet { updateSelection() } }
    public var onTabChange: ((String) -> Void)?

    private let tabBar = NSStackView()
    private let contentArea = NSView()

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        tabBar.orientation = .horizontal
        tabBar.spacing = 0
        addSubview(tabBar)
        addSubview(contentArea)
    }

    private func rebuild() {
        tabBar.arrangedSubviews.forEach { tabBar.removeArrangedSubview($0); $0.removeFromSuperview() }
        contentArea.subviews.forEach { $0.removeFromSuperview() }
        for (i, tab) in tabs.enumerated() {
            let btn = NSButton(title: tab.label, target: self, action: #selector(tabClicked(_:)))
            btn.tag = i
            btn.bezelStyle = .smallSquare
            btn.isBordered = false
            tabBar.addArrangedSubview(btn)
            contentArea.addSubview(tab.content)
        }
        if selectedTabId == nil && !tabs.isEmpty { selectedTabId = tabs[0].id }
        updateSelection()
    }

    private func updateSelection() {
        for tab in tabs { tab.content.isHidden = tab.id != selectedTabId }
    }

    @objc private func tabClicked(_ sender: NSButton) {
        guard sender.tag < tabs.count else { return }
        selectedTabId = tabs[sender.tag].id
        onTabChange?(tabs[sender.tag].id)
    }

    public override func layout() {
        super.layout()
        tabBar.frame = NSRect(x: 0, y: bounds.height - 32, width: bounds.width, height: 32)
        contentArea.frame = NSRect(x: 0, y: 0, width: bounds.width, height: bounds.height - 36)
        tabs.forEach { $0.content.frame = contentArea.bounds }
    }
}
