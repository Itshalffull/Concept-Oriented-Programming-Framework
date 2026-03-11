// ============================================================
// Clef Surface WatchKit Widget — Form
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct FormView<Content: View>: View {
    @ViewBuilder var content: () -> Content
    var body: some View { ScrollView { VStack(alignment: .leading, spacing: 8) { content() }.padding(.horizontal, 4) } }
}
