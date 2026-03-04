// ============================================================
// Clef Surface WatchKit Widget - TokenInput
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct TokenInputView: View {
    @Binding var tokens: [String]; @State private var text = ""
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            ScrollView(.horizontal) { HStack(spacing: 4) { ForEach(tokens, id: \.self) { t in
                HStack(spacing: 2) { Text(t).font(.caption2)
                    Button(action: { tokens.removeAll { $0 == t } }) { Image(systemName: "xmark").font(.system(size: 8)) }.buttonStyle(.plain)
                }.padding(.horizontal, 4).padding(.vertical, 2).background(Color.gray.opacity(0.2)).cornerRadius(4)
            } } }
            TextField("Add...", text: $text).font(.caption2).onSubmit { if !text.isEmpty { tokens.append(text); text = "" } }
        }
    }
}
