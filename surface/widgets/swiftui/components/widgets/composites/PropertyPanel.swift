// ============================================================
// Clef Surface SwiftUI Widget — PropertyPanel
//
// Editable property inspector panel displaying key-value pairs
// for a selected entity. Supports text, toggle, and select.
// ============================================================

import SwiftUI

struct PropertyField: Identifiable {
    let id: String
    let label: String
    var value: String
    var type: PropertyFieldType = .text
    var options: [String] = []
}

enum PropertyFieldType { case text, toggle, select }

struct PropertyPanelView: View {
    var title: String = "Properties"
    @Binding var fields: [PropertyField]

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title).font(.headline).fontWeight(.bold)
            Divider()
            ForEach(Array(fields.enumerated()), id: \.element.id) { index, field in
                HStack {
                    Text(field.label).font(.subheadline).foregroundColor(.secondary).frame(width: 100, alignment: .leading)
                    switch field.type {
                    case .text:
                        TextField("", text: Binding(get: { field.value }, set: { fields[index].value = $0 })).textFieldStyle(.roundedBorder)
                    case .toggle:
                        Toggle("", isOn: Binding(get: { field.value == "true" }, set: { fields[index].value = $0 ? "true" : "false" })).toggleStyle(.switch)
                    case .select:
                        Picker("", selection: Binding(get: { field.value }, set: { fields[index].value = $0 })) {
                            ForEach(field.options, id: \.self) { opt in Text(opt).tag(opt) }
                        }
                    }
                }
            }
        }.padding(12)
    }
}
