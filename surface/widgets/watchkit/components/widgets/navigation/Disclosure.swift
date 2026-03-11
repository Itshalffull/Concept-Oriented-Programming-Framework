// ============================================================
// Clef Surface WatchKit Widget — Disclosure
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct DisclosureView<Content: View>: View {
    var label: String; @State var isExpanded: Bool = false; @ViewBuilder var content: () -> Content
    var body: some View {
        DisclosureGroup(label, isExpanded: $isExpanded) { content() }.font(.caption)
    }
}
