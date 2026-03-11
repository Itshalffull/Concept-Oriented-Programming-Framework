// ============================================================
// Clef Surface WatchKit Widget — Portal
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct PortalView<Content: View>: View {
    @ViewBuilder var content: () -> Content
    var body: some View { content() }
}
