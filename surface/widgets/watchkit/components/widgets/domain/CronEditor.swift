// ============================================================
// Clef Surface WatchKit Widget - CronEditor
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct CronEditorView: View {
    @Binding var expression: String
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Cron").font(.caption.bold())
            TextField("* * * * *", text: $expression).font(.system(.caption2, design: .monospaced))
        }
    }
}
