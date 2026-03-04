// ============================================================
// Clef Surface AppKit Widget — ContextMenu
//
// Right-click context menu with nested items and separators.
// Wraps NSMenu for native context menu behavior.
// ============================================================

import AppKit

public class ClefContextMenu {
    public struct MenuItem {
        public let title: String
        public let icon: String?
        public let shortcut: String
        public let disabled: Bool
        public let children: [MenuItem]
        public let action: (() -> Void)?

        public init(title: String, icon: String? = nil, shortcut: String = "", disabled: Bool = false, children: [MenuItem] = [], action: (() -> Void)? = nil) {
            self.title = title
            self.icon = icon
            self.shortcut = shortcut
            self.disabled = disabled
            self.children = children
            self.action = action
        }
    }

    private let menu = NSMenu()
    private var actions: [ObjectIdentifier: () -> Void] = [:]

    public func setItems(_ items: [MenuItem]) {
        menu.removeAllItems()
        for item in items {
            menu.addItem(createMenuItem(item))
        }
    }

    public func addSeparator() {
        menu.addItem(.separator())
    }

    private func createMenuItem(_ item: MenuItem) -> NSMenuItem {
        if item.title == "-" { return .separator() }
        let menuItem = NSMenuItem(title: item.title, action: #selector(handleAction(_:)), keyEquivalent: item.shortcut)
        menuItem.target = self
        menuItem.isEnabled = !item.disabled
        if let iconName = item.icon {
            menuItem.image = NSImage(systemSymbolName: iconName, accessibilityDescription: nil)
        }
        if !item.children.isEmpty {
            let submenu = NSMenu()
            for child in item.children { submenu.addItem(createMenuItem(child)) }
            menuItem.submenu = submenu
        }
        if let action = item.action {
            actions[ObjectIdentifier(menuItem)] = action
        }
        return menuItem
    }

    @objc private func handleAction(_ sender: NSMenuItem) {
        actions[ObjectIdentifier(sender)]?()
    }

    public func show(for view: NSView, at point: NSPoint) {
        menu.popUp(positioning: nil, at: point, in: view)
    }
}
