// ============================================================
// Clef Surface WatchKit Widget - DragHandle
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct DragHandleView: View {
    var body: some View {
        Image(systemName: "line.3.horizontal").font(.caption).foregroundColor(.secondary).frame(width: 24, height: 24)
    }
}
