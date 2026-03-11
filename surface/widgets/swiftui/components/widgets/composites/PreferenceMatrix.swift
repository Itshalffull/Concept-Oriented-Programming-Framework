// ============================================================
// Clef Surface SwiftUI Widget — PreferenceMatrix
//
// Grid of preference settings organized by category and item.
// Each cell is a toggle or multi-option selector.
// ============================================================

import SwiftUI

struct PreferenceCategory: Identifiable {
    let id: String
    let label: String
    var items: [PreferenceItem]
}

struct PreferenceItem: Identifiable {
    let id: String
    let label: String
    var enabled: Bool = true
}

struct PreferenceMatrixView: View {
    var categories: [PreferenceCategory]
    @Binding var selections: [String: Bool]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(categories) { category in
                VStack(alignment: .leading, spacing: 4) {
                    Text(category.label).font(.subheadline).fontWeight(.semibold)
                    ForEach(category.items) { item in
                        HStack {
                            Text(item.label).font(.body)
                            Spacer()
                            Toggle("", isOn: Binding(
                                get: { selections[item.id] ?? false },
                                set: { selections[item.id] = $0 }
                            ))
                            .toggleStyle(.switch)
                            .disabled(!item.enabled)
                        }
                    }
                }
                Divider()
            }
        }
    }
}
