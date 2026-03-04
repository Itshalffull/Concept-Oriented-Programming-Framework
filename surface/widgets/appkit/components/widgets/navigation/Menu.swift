// ============================================================
// Clef Surface AppKit Widget — Menu
//
// Dropdown menu with items, separators, and submenus.
// Wraps NSMenu for native menu behavior.
// ============================================================

import AppKit

public class ClefMenu {
    public struct Item {
        public let title: String
        public let icon: String?
        public let shortcut: String
        public let disabled: Bool
        public let children: [Item]
        public let action: (() -> Void)?

        public init(title: String, icon: String? = nil, shortcut: String = "", disabled: Bool = false, children: [Item] = [], action: (() -> Void)? = nil) {
            self.title = title; self.icon = icon; self.shortcut = shortcut
            self.disabled = disabled; self.children = children; self.action = action
        }
    }

    private let menu = NSMenu()
    private var actionMap: [String: () -> Void] = [:]

    public func setItems(_ items: [Item]) {
        menu.removeAllItems()
        actionMap.removeAll()
        for item in items { menu.addItem(buildItem(item)) }
    }

    private func buildItem(_ item: Item) -> NSMenuItem {
        if item.title == "-" { return .separator() }
        let mi = NSMenuItem(title: item.title, action: #selector(handleAction(_:)), keyEquivalent: item.shortcut)
        mi.target = self
        mi.isEnabled = !item.disabled
        mi.identifier = NSUserInterfaceItemIdentifier(UUID().uuidString)
        if let iconName = item.icon {
            mi.image = NSImage(systemSymbolName: iconName, accessibilityDescription: nil)
        }
        if let action = item.action { actionMap[mi.identifier!.rawValue] = action }
        if !item.children.isEmpty {
            let sub = NSMenu()
            item.children.forEach { sub.addItem(buildItem($0)) }
            mi.submenu = sub
        }
        return mi
    }

    @objc private func handleAction(_ sender: NSMenuItem) {
        guard let id = sender.identifier?.rawValue else { return }
        actionMap[id]?()
    }

    public func popUp(in view: NSView, at point: NSPoint) {
        menu.popUp(positioning: nil, at: point, in: view)
    }
}
