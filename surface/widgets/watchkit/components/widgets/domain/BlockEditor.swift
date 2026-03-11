// ============================================================
// Clef Surface WatchKit Widget - BlockEditor
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct BlockEditorView: View {
    var blocks: [(type: String, content: String)] = []
    var body: some View {
        ScrollView { VStack(alignment: .leading, spacing: 4) {
            ForEach(0..<blocks.count, id: \.self) { i in
                VStack(alignment: .leading) {
                    Text(blocks[i].type).font(.system(size: 8)).foregroundColor(.secondary)
                    Text(blocks[i].content).font(.caption2)
                }.padding(4).background(Color.gray.opacity(0.05)).cornerRadius(4)
            }
        } }
    }
}
