// ============================================================
// Clef Surface SwiftUI Widget — NavigationMenu
//
// Hierarchical navigation menu with sections and items.
// Renders using NavigationView or List with navigation links.
// ============================================================

import SwiftUI

// --------------- Types ---------------

struct NavigationMenuItem: Identifiable {
    let id: String
    let label: String
    var icon: String? = nil
    var active: Bool = false
    var disabled: Bool = false
}

struct NavigationMenuSection: Identifiable {
    let id: String
    let title: String
    var items: [NavigationMenuItem]
}

// --------------- Component ---------------

/// NavigationMenu view for hierarchical navigation.
///
/// - Parameters:
///   - sections: Menu sections with items.
///   - onSelect: Callback when an item is selected.
struct NavigationMenuView: View {
    var sections: [NavigationMenuSection]
    var onSelect: ((NavigationMenuItem) -> Void)? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ForEach(sections) { section in
                Text(section.title)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding(.horizontal, 12)
                    .padding(.top, 12)
                    .padding(.bottom, 4)

                ForEach(section.items) { item in
                    SwiftUI.Button(action: {
                        guard !item.disabled else { return }
                        onSelect?(item)
                    }) {
                        HStack(spacing: 8) {
                            if let icon = item.icon {
                                Image(systemName: icon)
                                    .frame(width: 20)
                            }
                            Text(item.label)
                                .font(.body)
                            Spacer()
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(item.active ? Color.accentColor.opacity(0.1) : Color.clear)
                        .foregroundColor(item.disabled ? .gray : (item.active ? .accentColor : .primary))
                    }
                    .buttonStyle(.plain)
                    .disabled(item.disabled)
                }
            }
        }
    }
}
