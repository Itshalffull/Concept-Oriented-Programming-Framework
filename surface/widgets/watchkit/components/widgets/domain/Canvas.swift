// ============================================================
// Clef Surface WatchKit Widget - Canvas
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct CanvasView: View {
    var width: CGFloat = 150; var height: CGFloat = 100
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 8).stroke(Color.gray.opacity(0.3), lineWidth: 1)
            Text("Canvas").font(.caption2).foregroundColor(.secondary)
        }.frame(width: width, height: height)
    }
}
