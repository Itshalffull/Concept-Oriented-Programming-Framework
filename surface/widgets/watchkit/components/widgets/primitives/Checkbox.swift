// ============================================================
// Clef Surface WatchKit Widget — Checkbox
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct CheckboxView: View {
    var label: String = ""
    @Binding var isChecked: Bool
    var body: some View {
        Toggle(label, isOn: $isChecked).toggleStyle(.switch).font(.caption2)
    }
}
