// ============================================================
// Clef Surface WatchKit Widget - MarkdownPreview
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct MarkdownPreviewView: View {
    var markdown: String = ""
    var body: some View {
        ScrollView { Text(markdown).font(.caption2) }
    }
}
