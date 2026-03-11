// ============================================================
// Clef Surface SwiftUI Widget — SortBuilder
//
// Visual sort rule builder for constructing sort orders.
// Supports multiple sort fields with direction toggles.
// ============================================================

import SwiftUI

struct SortRule: Identifiable {
    let id: String
    var field: String
    var direction: String = "ascending"
}

struct SortBuilderView: View {
    @Binding var rules: [SortRule]
    var fields: [String] = []
    var onApply: (([SortRule]) -> Void)? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Sort").font(.headline).fontWeight(.bold)
            ForEach(Array(rules.enumerated()), id: \.element.id) { index, rule in
                HStack(spacing: 8) {
                    Picker("", selection: Binding(get: { rule.field }, set: { rules[index].field = $0 })) {
                        ForEach(fields, id: \.self) { f in Text(f).tag(f) }
                    }.frame(maxWidth: 160)
                    Picker("", selection: Binding(get: { rule.direction }, set: { rules[index].direction = $0 })) {
                        Text("Ascending").tag("ascending")
                        Text("Descending").tag("descending")
                    }.frame(maxWidth: 120)
                    SwiftUI.Button(action: { rules.remove(at: index) }) {
                        Image(systemName: "xmark").foregroundColor(.secondary)
                    }.buttonStyle(.plain)
                }
            }
            HStack {
                SwiftUI.Button(action: { rules.append(SortRule(id: UUID().uuidString, field: fields.first ?? "", direction: "ascending")) }) {
                    HStack { Image(systemName: "plus"); Text("Add Sort") }
                }
                Spacer()
                if let onApply = onApply { SwiftUI.Button("Apply", action: { onApply(rules) }).buttonStyle(.borderedProminent) }
            }
        }.padding(12)
    }
}
