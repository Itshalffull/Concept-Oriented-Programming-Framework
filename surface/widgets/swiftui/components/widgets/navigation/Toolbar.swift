// ============================================================
// Clef Surface SwiftUI Widget — Toolbar
//
// Horizontal action bar with buttons, toggles, and separators.
// Uses HStack with configurable spacing and alignment.
// ============================================================

import SwiftUI

// --------------- Types ---------------

struct ToolbarItemData: Identifiable {
    let id = UUID()
    let label: String
    var icon: String? = nil
    var disabled: Bool = false
    var active: Bool = false
}

// --------------- Component ---------------

/// Toolbar view for horizontal action bars.
///
/// - Parameters:
///   - items: Toolbar action items.
///   - onAction: Callback when an item is activated (by index).
struct ToolbarView: View {
    var items: [ToolbarItemData]
    var onAction: ((Int) -> Void)? = nil

    var body: some View {
        HStack(spacing: 4) {
            ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                SwiftUI.Button(action: {
                    guard !item.disabled else { return }
                    onAction?(index)
                }) {
                    HStack(spacing: 4) {
                        if let icon = item.icon {
                            Image(systemName: icon)
                        }
                        Text(item.label)
                            .font(.subheadline)
                    }
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(item.active ? Color.accentColor.opacity(0.1) : Color.clear)
                    .foregroundColor(item.disabled ? .gray : (item.active ? .accentColor : .primary))
                    .clipShape(RoundedRectangle(cornerRadius: 6))
                }
                .buttonStyle(.plain)
                .disabled(item.disabled)
                .accessibilityLabel(item.label)
            }
        }
        .padding(.horizontal, 8)
        .padding(.vertical, 4)
        .background(Color(.systemBackground))
    }
}
