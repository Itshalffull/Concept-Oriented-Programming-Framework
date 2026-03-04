// ============================================================
// Clef Surface WatchKit Widget — ColorPicker
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct ColorPickerView: View {
    var label: String = "Color"; @Binding var selectedColor: Color
    var body: some View { ColorPicker(label, selection: $selectedColor).font(.caption2) }
}
