// ============================================================
// Clef Surface WatchKit Widget — RichTextEditor
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct RichTextEditorView: View {
    @Binding var text: String
    var body: some View { TextField("Edit text...", text: $text, axis: .vertical).lineLimit(5...10).font(.caption2) }
}
