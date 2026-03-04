// ============================================================
// Clef Surface WatchKit Widget - ConditionBuilder
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct ConditionBuilderView: View {
    var conditions: [(field: String, op: String, value: String)] = []
    var body: some View {
        ScrollView { VStack(alignment: .leading, spacing: 4) {
            Text("Conditions").font(.caption.bold())
            ForEach(0..<conditions.count, id: \.self) { i in
                HStack { Text(conditions[i].field).font(.caption2); Text(conditions[i].op).font(.caption2); Text(conditions[i].value).font(.caption2.bold()) }
                    .padding(3).background(Color.gray.opacity(0.1)).cornerRadius(4)
                if i < conditions.count - 1 { Text("AND").font(.system(size: 8)).foregroundColor(.secondary) }
            }
        } }
    }
}
