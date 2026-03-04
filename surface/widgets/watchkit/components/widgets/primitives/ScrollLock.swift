// ============================================================
// Clef Surface WatchKit Widget — ScrollLock
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct ScrollLockView<Content: View>: View {
    var locked: Bool = false
    @ViewBuilder var content: () -> Content
    var body: some View { ScrollView { content() }.disabled(locked) }
}
