// ============================================================
// Clef Surface WatchKit Widget - PolicyEditor
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct PolicyEditorView: View {
    var policies: [(name: String, effect: String)] = []
    var body: some View {
        ScrollView { VStack(alignment: .leading, spacing: 4) {
            Text("Policies").font(.caption.bold())
            ForEach(0..<policies.count, id: \.self) { i in
                HStack { Text(policies[i].name).font(.caption2); Spacer(); Text(policies[i].effect).font(.caption2).foregroundColor(policies[i].effect == "allow" ? .green : .red) }
                    .padding(3).background(Color.gray.opacity(0.1)).cornerRadius(4)
            }
        } }
    }
}
