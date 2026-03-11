// ============================================================
// Clef Surface SwiftUI Widget — ContextMenu
//
// Contextual action menu anchored to a trigger element. Supports
// item labels, optional keyboard shortcut hints, disabled items,
// and destructive (danger) styling.
//
// Adapts the context-menu.widget spec to SwiftUI rendering.
// ============================================================

import SwiftUI

// --------------- Types ---------------

struct ContextMenuItemData: Identifiable {
    let id = UUID()
    let label: String
    var shortcut: String? = nil
    var disabled: Bool = false
    var danger: Bool = false
}

// --------------- Component ---------------

/// ContextMenu view anchored to a trigger element.
///
/// - Parameters:
///   - items: List of menu items.
///   - onSelect: Callback when an item is selected (by index).
///   - trigger: Trigger content that anchors the menu.
struct ClefContextMenuView<Trigger: View>: View {
    var items: [ContextMenuItemData]
    var onSelect: ((Int) -> Void)? = nil
    @ViewBuilder var trigger: Trigger

    var body: some View {
        trigger
            .contextMenu {
                ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                    SwiftUI.Button(role: item.danger ? .destructive : nil, action: {
                        guard !item.disabled else { return }
                        onSelect?(index)
                    }) {
                        HStack {
                            Text(item.label)
                            if let shortcut = item.shortcut {
                                Spacer()
                                Text(shortcut)
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                    }
                    .disabled(item.disabled)
                }
            }
    }
}
