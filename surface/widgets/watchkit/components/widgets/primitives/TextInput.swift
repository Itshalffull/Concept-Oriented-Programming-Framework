// ============================================================
// Clef Surface WatchKit Widget — TextInput
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct TextInputView: View {
    var placeholder: String = ""
    @Binding var text: String
    var body: some View { TextField(placeholder, text: $text).font(.caption2) }
}
