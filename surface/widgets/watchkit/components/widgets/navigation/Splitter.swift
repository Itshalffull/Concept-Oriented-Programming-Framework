// ============================================================
// Clef Surface WatchKit Widget — Splitter
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct SplitterView<Top: View, Bottom: View>: View {
    @ViewBuilder var top: () -> Top; @ViewBuilder var bottom: () -> Bottom
    var body: some View { VStack(spacing: 1) { top(); Divider(); bottom() } }
}
