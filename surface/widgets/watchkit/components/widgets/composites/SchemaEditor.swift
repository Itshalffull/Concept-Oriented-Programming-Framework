// ============================================================
// Clef Surface WatchKit Widget - SchemaEditor
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct SchemaEditorView: View {
    var fields: [(name: String, type: String, required: Bool)] = []
    var body: some View {
        ScrollView { VStack(alignment: .leading, spacing: 2) {
            Text("Schema").font(.caption.bold())
            ForEach(0..<fields.count, id: \.self) { i in
                HStack { Text(fields[i].name).font(.caption2); Spacer(); Text(fields[i].type).font(.caption2).foregroundColor(.accentColor); if fields[i].required { Text("*").foregroundColor(.red) } }
                    .padding(.vertical, 1)
            }
        } }
    }
}
