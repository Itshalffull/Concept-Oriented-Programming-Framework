// ============================================================
// Clef Surface SwiftUI Widget — MasterDetail
//
// Two-pane layout with a list (master) and detail view.
// Selecting an item in the list shows its detail.
// ============================================================

import SwiftUI

struct MasterItem: Identifiable {
    let id: String
    let title: String
    var subtitle: String? = nil
}

struct MasterDetailView<Detail: View>: View {
    var items: [MasterItem]
    @Binding var selectedId: String?
    @ViewBuilder var detail: Detail

    var body: some View {
        HStack(spacing: 0) {
            // Master list
            VStack(alignment: .leading, spacing: 0) {
                ForEach(items) { item in
                    SwiftUI.Button(action: { selectedId = item.id }) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.title).font(.subheadline).fontWeight(item.id == selectedId ? .bold : .regular).foregroundColor(.primary)
                            if let subtitle = item.subtitle {
                                Text(subtitle).font(.caption).foregroundColor(.secondary)
                            }
                        }
                        .padding(.horizontal, 12).padding(.vertical, 8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(item.id == selectedId ? Color.accentColor.opacity(0.1) : Color.clear)
                    }.buttonStyle(.plain)
                }
                Spacer()
            }.frame(width: 240).background(Color(.systemGray6))

            Divider()

            // Detail pane
            detail.frame(maxWidth: .infinity, maxHeight: .infinity)
        }
    }
}
