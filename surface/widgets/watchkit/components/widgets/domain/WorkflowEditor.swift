// ============================================================
// Clef Surface WatchKit Widget - WorkflowEditor
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct WorkflowEditorView: View {
    var nodes: [(id: String, label: String, type: String)] = []
    var body: some View {
        ScrollView { VStack(alignment: .leading, spacing: 4) {
            Text("Workflow").font(.caption.bold())
            ForEach(nodes, id: \.id) { node in
                HStack {
                    Image(systemName: node.type == "action" ? "bolt.fill" : node.type == "condition" ? "questionmark.diamond" : "circle.fill")
                        .font(.caption2).foregroundColor(.accentColor)
                    Text(node.label).font(.caption2)
                }.padding(4).background(Color.gray.opacity(0.1)).cornerRadius(4)
            }
        } }
    }
}
