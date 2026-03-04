// ============================================================
// Clef Surface WatchKit Widget — HoverCard
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct HoverCardView<Trigger: View, Content: View>: View {
    @ViewBuilder var trigger: () -> Trigger
    @ViewBuilder var content: () -> Content
    var body: some View { trigger() }
}
