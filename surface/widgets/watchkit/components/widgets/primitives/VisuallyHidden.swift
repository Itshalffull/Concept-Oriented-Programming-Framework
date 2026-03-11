// ============================================================
// Clef Surface WatchKit Widget — VisuallyHidden
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct VisuallyHiddenView<Content: View>: View {
    @ViewBuilder var content: () -> Content
    var body: some View { content().frame(width: 1, height: 1).opacity(0).accessibilityHidden(false) }
}
