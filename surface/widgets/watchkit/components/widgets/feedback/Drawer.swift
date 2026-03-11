// ============================================================
// Clef Surface WatchKit Widget — Drawer
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct DrawerView<Content: View>: View {
    @Binding var isOpen: Bool
    @ViewBuilder var content: () -> Content
    var body: some View {
        if isOpen {
            VStack { Spacer(); content().padding().background(Color(.darkGray)).cornerRadius(12) }
                .transition(.move(edge: .bottom))
                .animation(.easeInOut, value: isOpen)
        }
    }
}
