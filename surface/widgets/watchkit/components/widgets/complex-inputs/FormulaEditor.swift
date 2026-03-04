// ============================================================
// Clef Surface WatchKit Widget — FormulaEditor
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct FormulaEditorView: View {
    @Binding var formula: String
    var body: some View { TextField("Formula", text: $formula).font(.system(.caption2, design: .monospaced)) }
}
