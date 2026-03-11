// ============================================================
// Clef Surface WatchKit Widget — MentionInput
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct MentionInputView: View {
    @Binding var text: String
    var body: some View { TextField("Type @mention...", text: $text).font(.caption2) }
}
