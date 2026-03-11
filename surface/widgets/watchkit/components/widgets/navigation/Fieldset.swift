// ============================================================
// Clef Surface WatchKit Widget — Fieldset
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct FieldsetView<Content: View>: View {
    var legend: String; var disabled: Bool = false; @ViewBuilder var content: () -> Content
    var body: some View {
        VStack(alignment: .leading, spacing: 4) { Text(legend).font(.caption.bold()); content() }.disabled(disabled).opacity(disabled ? 0.5 : 1)
    }
}
