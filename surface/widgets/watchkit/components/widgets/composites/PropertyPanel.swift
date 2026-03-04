// ============================================================
// Clef Surface WatchKit Widget - PropertyPanel
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct PropertyPanelView: View {
    var properties: [(label: String, value: String)] = []
    var body: some View {
        ScrollView { VStack(spacing: 0) {
            Text("Properties").font(.caption.bold()).frame(maxWidth: .infinity, alignment: .leading)
            ForEach(0..<properties.count, id: \.self) { i in
                HStack { Text(properties[i].label).font(.caption2).foregroundColor(.secondary); Spacer(); Text(properties[i].value).font(.caption2) }
                    .padding(.vertical, 2)
                Divider()
            }
        } }
    }
}
