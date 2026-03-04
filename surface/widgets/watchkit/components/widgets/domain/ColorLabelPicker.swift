// ============================================================
// Clef Surface WatchKit Widget - ColorLabelPicker
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct ColorLabelPickerView: View {
    var colors: [(name: String, color: Color)] = [(.init("Red"), .red), (.init("Blue"), .blue), (.init("Green"), .green)]
    @Binding var selectedName: String
    var body: some View {
        HStack(spacing: 4) { ForEach(colors, id: \.name) { c in
            Button(action: { selectedName = c.name }) {
                Circle().fill(c.color).frame(width: 20, height: 20)
                    .overlay(selectedName == c.name ? Image(systemName: "checkmark").font(.system(size: 8)).foregroundColor(.white) : nil)
            }.buttonStyle(.plain)
        } }
    }
}
