// ============================================================
// Clef Surface WatchKit Widget - CanvasNode
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct CanvasNodeView: View {
    var title: String = "Node"; var type: String = "default"
    var body: some View {
        VStack(spacing: 2) {
            Text(title).font(.caption2.bold())
            Text(type).font(.system(size: 8)).foregroundColor(.secondary)
        }.padding(6).background(Color.gray.opacity(0.15)).cornerRadius(6).overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.accentColor, lineWidth: 1))
    }
}
