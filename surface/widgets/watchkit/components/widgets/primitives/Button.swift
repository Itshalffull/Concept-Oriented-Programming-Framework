// ============================================================
// Clef Surface WatchKit Widget — Button
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct ClefButtonView: View {
    var label: String = "Button"
    var loading: Bool = false
    var disabled: Bool = false
    var action: () -> Void = {}
    var body: some View {
        Button(action: { if !loading { action() } }) {
            HStack(spacing: 4) {
                if loading { ProgressView().scaleEffect(0.6) }
                Text(label).font(.footnote)
            }
        }
        .disabled(disabled || loading)
    }
}
