// ============================================================
// Clef Surface WatchKit Widget — Icon
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct IconView: View {
    var name: String = "star"
    var size: CGFloat = 16
    var color: Color = .primary
    var body: some View {
        Image(systemName: name).font(.system(size: size)).foregroundColor(color)
    }
}
