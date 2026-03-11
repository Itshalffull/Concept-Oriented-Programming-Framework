// ============================================================
// Clef Surface SwiftUI Widget — Tabs
//
// Tabbed content switcher. Renders a tab strip with selection
// indicators and content panel below.
// ============================================================

import SwiftUI

// --------------- Types ---------------

struct TabItem: Identifiable {
    let id: String
    let label: String
    var disabled: Bool = false
}

// --------------- Component ---------------

/// Tabs view for tabbed content switching.
///
/// - Parameters:
///   - tabs: Tab definitions.
///   - activeId: Binding to the ID of the active tab.
///   - content: Content panel rendered below the tab strip.
struct TabsView<Content: View>: View {
    var tabs: [TabItem]
    @Binding var activeId: String?
    @ViewBuilder var content: Content

    private var selectedIndex: Int {
        tabs.firstIndex(where: { $0.id == activeId }) ?? 0
    }

    var body: some View {
        VStack(spacing: 0) {
            // Tab strip
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 0) {
                    ForEach(tabs) { tab in
                        SwiftUI.Button(action: {
                            guard !tab.disabled else { return }
                            activeId = tab.id
                        }) {
                            VStack(spacing: 4) {
                                Text(tab.label)
                                    .font(.subheadline)
                                    .foregroundColor(
                                        tab.disabled ? .gray :
                                        tab.id == activeId ? .accentColor : .primary
                                    )
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 8)

                                Rectangle()
                                    .fill(tab.id == activeId ? Color.accentColor : Color.clear)
                                    .frame(height: 2)
                            }
                        }
                        .buttonStyle(.plain)
                        .disabled(tab.disabled)
                        .accessibilityAddTraits(tab.id == activeId ? .isSelected : [])
                    }
                }
            }

            Divider()

            // Content panel
            content
                .padding(.top, 16)
        }
    }
}
