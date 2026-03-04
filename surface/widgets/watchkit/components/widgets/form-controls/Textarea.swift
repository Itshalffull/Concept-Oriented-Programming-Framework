// ============================================================
// Clef Surface WatchKit Widget — Textarea
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct TextareaView: View {
    var placeholder: String = ""; @Binding var text: String
    var body: some View { TextField(placeholder, text: $text, axis: .vertical).lineLimit(3...6).font(.caption2) }
}
