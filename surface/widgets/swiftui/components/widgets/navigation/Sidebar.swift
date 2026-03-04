// ============================================================
// Clef Surface SwiftUI Widget — Sidebar
//
// Collapsible sidebar navigation panel with items and sections.
// Uses SwiftUI NavigationSplitView patterns.
// ============================================================

import SwiftUI

// --------------- Types ---------------

struct SidebarItem: Identifiable {
    let id: String
    let label: String
    var icon: String? = nil
    var active: Bool = false
    var badge: String? = nil
}

// --------------- Component ---------------

/// Sidebar view for navigation panel with collapsible items.
///
/// - Parameters:
///   - items: Sidebar navigation items.
///   - collapsed: Whether the sidebar is collapsed.
///   - title: Optional sidebar title.
///   - onSelect: Callback when an item is selected.
///   - onToggle: Callback when collapse state changes.
struct SidebarView: View {
    var items: [SidebarItem]
    @Binding var collapsed: Bool
    var title: String? = nil
    var onSelect: ((SidebarItem) -> Void)? = nil
    var onToggle: (() -> Void)? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Header
            HStack {
                if !collapsed, let title = title {
                    Text(title)
                        .font(.headline)
                        .fontWeight(.semibold)
                }
                Spacer()
                SwiftUI.Button(action: {
                    collapsed.toggle()
                    onToggle?()
                }) {
                    Image(systemName: collapsed ? "sidebar.left" : "sidebar.left")
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(collapsed ? "Expand sidebar" : "Collapse sidebar")
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)

            Divider()

            // Items
            ForEach(items) { item in
                SwiftUI.Button(action: {
                    onSelect?(item)
                }) {
                    HStack(spacing: 8) {
                        if let icon = item.icon {
                            Image(systemName: icon)
                                .frame(width: 24)
                                .foregroundColor(item.active ? .accentColor : .secondary)
                        }

                        if !collapsed {
                            Text(item.label)
                                .font(.body)
                                .foregroundColor(item.active ? .accentColor : .primary)

                            Spacer()

                            if let badge = item.badge {
                                Text(badge)
                                    .font(.caption2)
                                    .padding(.horizontal, 6)
                                    .padding(.vertical, 2)
                                    .background(Color.accentColor.opacity(0.1))
                                    .clipShape(Capsule())
                            }
                        }
                    }
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(item.active ? Color.accentColor.opacity(0.08) : Color.clear)
                }
                .buttonStyle(.plain)
            }

            Spacer()
        }
        .frame(width: collapsed ? 48 : 220)
        .background(Color(.systemBackground))
        .animation(.easeInOut(duration: 0.2), value: collapsed)
    }
}
