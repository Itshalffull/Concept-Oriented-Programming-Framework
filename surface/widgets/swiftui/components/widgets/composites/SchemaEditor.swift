// ============================================================
// Clef Surface SwiftUI Widget — SchemaEditor
//
// Visual schema/model editor for defining fields, types,
// and relationships. Supports adding and removing fields.
// ============================================================

import SwiftUI

struct SchemaField: Identifiable {
    let id: String
    var name: String
    var type: String
    var required: Bool = false
}

struct SchemaEditorView: View {
    var title: String = "Schema"
    @Binding var fields: [SchemaField]
    var types: [String] = ["String", "Number", "Boolean", "Date", "Array", "Object"]
    var onSave: (([SchemaField]) -> Void)? = nil

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack { Text(title).font(.headline).fontWeight(.bold); Spacer() }
            ForEach(Array(fields.enumerated()), id: \.element.id) { index, field in
                HStack(spacing: 8) {
                    TextField("Name", text: Binding(get: { field.name }, set: { fields[index].name = $0 })).textFieldStyle(.roundedBorder).frame(maxWidth: 140)
                    Picker("", selection: Binding(get: { field.type }, set: { fields[index].type = $0 })) {
                        ForEach(types, id: \.self) { t in Text(t).tag(t) }
                    }.frame(maxWidth: 120)
                    Toggle("Required", isOn: Binding(get: { field.required }, set: { fields[index].required = $0 })).toggleStyle(.switch).labelsHidden()
                    SwiftUI.Button(action: { fields.remove(at: index) }) {
                        Image(systemName: "trash").foregroundColor(.red)
                    }.buttonStyle(.plain)
                }
            }
            HStack {
                SwiftUI.Button(action: { fields.append(SchemaField(id: UUID().uuidString, name: "", type: "String")) }) {
                    HStack { Image(systemName: "plus"); Text("Add Field") }
                }
                Spacer()
                if let onSave = onSave { SwiftUI.Button("Save", action: { onSave(fields) }).buttonStyle(.borderedProminent) }
            }
        }.padding(12)
    }
}
