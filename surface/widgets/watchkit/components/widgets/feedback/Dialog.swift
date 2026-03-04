// ============================================================
// Clef Surface WatchKit Widget — Dialog
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct DialogView<Content: View>: View {
    @Binding var isPresented: Bool
    @ViewBuilder var content: () -> Content
    var body: some View {
        if isPresented {
            ScrollView { content().padding() }
                .background(Color(.black).opacity(0.3))
                .onTapGesture { isPresented = false }
        }
    }
}
