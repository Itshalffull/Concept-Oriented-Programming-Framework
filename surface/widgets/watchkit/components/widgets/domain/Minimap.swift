// ============================================================
// Clef Surface WatchKit Widget - Minimap
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct MinimapView: View {
    var viewportRatio: CGFloat = 0.3
    var body: some View {
        ZStack {
            RoundedRectangle(cornerRadius: 2).fill(Color.gray.opacity(0.15)).frame(width: 40, height: 60)
            RoundedRectangle(cornerRadius: 1).stroke(Color.accentColor, lineWidth: 1)
                .frame(width: 40 * viewportRatio, height: 60 * viewportRatio)
        }
    }
}
