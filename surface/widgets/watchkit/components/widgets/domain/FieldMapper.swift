// ============================================================
// Clef Surface WatchKit Widget - FieldMapper
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct FieldMapperView: View {
    var mappings: [(source: String, target: String)] = []
    var body: some View {
        ScrollView { VStack(alignment: .leading, spacing: 2) {
            Text("Field Mapping").font(.caption.bold())
            ForEach(0..<mappings.count, id: \.self) { i in
                HStack { Text(mappings[i].source).font(.caption2); Image(systemName: "arrow.right").font(.caption2); Text(mappings[i].target).font(.caption2) }
            }
        } }
    }
}
