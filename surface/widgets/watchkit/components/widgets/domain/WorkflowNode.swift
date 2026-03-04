// ============================================================
// Clef Surface WatchKit Widget - WorkflowNode
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct WorkflowNodeView: View {
    var label: String = "Node"; var type: String = "action"; var isActive: Bool = false
    var body: some View {
        VStack(spacing: 2) {
            Image(systemName: type == "action" ? "bolt.fill" : type == "condition" ? "questionmark.diamond" : "circle.fill")
                .font(.caption).foregroundColor(isActive ? .accentColor : .secondary)
            Text(label).font(.caption2)
        }.padding(6).background(isActive ? Color.accentColor.opacity(0.15) : Color.gray.opacity(0.1)).cornerRadius(6)
    }
}
