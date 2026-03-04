// ============================================================
// Clef Surface SwiftUI Widget — FilterBuilder
//
// Visual filter rule builder for constructing query conditions.
// Supports adding, removing, and configuring filter rules.
// ============================================================

import SwiftUI

struct FilterRule: Identifiable {
    let id: String
    var field: String
    var operator_: String
    var value: String
}

struct FilterBuilderView: View {
    @Binding var rules: [FilterRule]
    var fields: [String] = []
    var operators: [String] = ["equals", "contains", "starts with", "greater than", "less than"]
    var onApply: (([FilterRule]) -> Void)? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Filters").font(.headline).fontWeight(.bold)
            ForEach(Array(rules.enumerated()), id: \.element.id) { index, rule in
                HStack(spacing: 8) {
                    TextField("Field", text: Binding(get: { rule.field }, set: { rules[index].field = $0 }))
                        .textFieldStyle(.roundedBorder).frame(maxWidth: 120)
                    Picker("", selection: Binding(get: { rule.operator_ }, set: { rules[index].operator_ = $0 })) {
                        ForEach(operators, id: \.self) { op in Text(op).tag(op) }
                    }.frame(maxWidth: 140)
                    TextField("Value", text: Binding(get: { rule.value }, set: { rules[index].value = $0 }))
                        .textFieldStyle(.roundedBorder)
                    SwiftUI.Button(action: { rules.remove(at: index) }) {
                        Image(systemName: "xmark").foregroundColor(.secondary)
                    }.buttonStyle(.plain)
                }
            }
            HStack {
                SwiftUI.Button(action: { rules.append(FilterRule(id: UUID().uuidString, field: "", operator_: "equals", value: "")) }) {
                    HStack { Image(systemName: "plus"); Text("Add Rule") }
                }
                Spacer()
                if let onApply = onApply {
                    SwiftUI.Button("Apply", action: { onApply(rules) }).buttonStyle(.borderedProminent)
                }
            }
        }.padding(12)
    }
}
