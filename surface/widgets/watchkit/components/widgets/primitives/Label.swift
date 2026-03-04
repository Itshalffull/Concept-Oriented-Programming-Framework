// ============================================================
// Clef Surface WatchKit Widget — Label
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct ClefLabelView: View {
    var text: String
    var required: Bool = false
    var body: some View {
        HStack(spacing: 2) {
            Text(text).font(.caption)
            if required { Text("*").foregroundColor(.red).font(.caption) }
        }
    }
}
