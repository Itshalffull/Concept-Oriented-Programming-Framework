// ============================================================
// Clef Surface WatchKit Widget — Popover
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct PopoverView<Content: View>: View {
    @Binding var isPresented: Bool
    @ViewBuilder var content: () -> Content
    var body: some View {
        if isPresented { content().padding(8).background(Color(.darkGray)).cornerRadius(8) }
    }
}
