// ============================================================
// Clef Surface WatchKit Widget - CodeBlock
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct CodeBlockView: View {
    var code: String = ""; var language: String = ""
    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            if !language.isEmpty { Text(language).font(.system(size: 8)).foregroundColor(.secondary) }
            ScrollView(.horizontal) { Text(code).font(.system(size: 9, design: .monospaced)).padding(4) }
                .background(Color.black.opacity(0.3)).cornerRadius(4)
        }
    }
}
