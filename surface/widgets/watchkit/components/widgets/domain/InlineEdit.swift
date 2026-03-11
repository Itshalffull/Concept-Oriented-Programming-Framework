// ============================================================
// Clef Surface WatchKit Widget - InlineEdit
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct InlineEditView: View {
    @Binding var value: String; @State private var editing = false; @State private var draft = ""
    var body: some View {
        if editing {
            TextField("", text: $draft).font(.caption2).onSubmit { value = draft; editing = false }
        } else {
            Text(value).font(.caption2).onTapGesture { draft = value; editing = true }
        }
    }
}
