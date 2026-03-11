// ============================================================
// Clef Surface WatchKit Widget - AutomationBuilder
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct AutomationBuilderView: View {
    var steps: [(name: String, type: String)] = []
    var body: some View {
        ScrollView { VStack(alignment: .leading, spacing: 4) {
            Text("Automation").font(.caption.bold())
            ForEach(0..<steps.count, id: \.self) { i in
                HStack { Text("\(i+1).").font(.caption2); Text(steps[i].name).font(.caption2); Spacer(); Text(steps[i].type).font(.caption2).foregroundColor(.secondary) }
                    .padding(3).background(Color.gray.opacity(0.1)).cornerRadius(4)
            }
        } }
    }
}
