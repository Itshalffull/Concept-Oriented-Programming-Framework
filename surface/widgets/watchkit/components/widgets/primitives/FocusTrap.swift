// ============================================================
// Clef Surface WatchKit Widget — FocusTrap
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct FocusTrapView<Content: View>: View {
    var active: Bool = true
    @ViewBuilder var content: () -> Content
    var body: some View { content() }
}
