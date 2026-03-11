// ============================================================
// Clef Surface SwiftUI Widget — Menu
//
// Dropdown menu with items, dividers, and optional submenus.
// Uses SwiftUI Menu for native dropdown behavior.
// ============================================================

import SwiftUI

// --------------- Types ---------------

struct MenuItemData: Identifiable {
    let id = UUID()
    let label: String
    var icon: String? = nil
    var disabled: Bool = false
    var danger: Bool = false
}

// --------------- Component ---------------

/// Menu view for dropdown action lists.
///
/// - Parameters:
///   - items: Menu items to display.
///   - label: Label for the menu trigger.
///   - onSelect: Callback when an item is selected (by index).
struct MenuView: View {
    var items: [MenuItemData]
    var label: String = "Menu"
    var onSelect: ((Int) -> Void)? = nil

    var body: some View {
        SwiftUI.Menu(label) {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                SwiftUI.Button(role: item.danger ? .destructive : nil, action: {
                    guard !item.disabled else { return }
                    onSelect?(index)
                }) {
                    SwiftUI.Label(item.label, systemImage: item.icon ?? "")
                }
                .disabled(item.disabled)
            }
        }
    }
}
