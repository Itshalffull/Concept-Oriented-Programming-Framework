// ============================================================
// Clef Surface WatchKit Widget — Presence
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct PresenceView<Content: View>: View {
    var present: Bool = true
    @ViewBuilder var content: () -> Content
    var body: some View {
        if present { content().transition(.opacity).animation(.easeInOut(duration: 0.2), value: present) }
    }
}
