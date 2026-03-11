// ============================================================
// Clef Surface WatchKit Widget — Combobox
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct ComboboxView: View {
    var options: [String]
    @Binding var selected: String
    var body: some View { Picker("", selection: $selected) { ForEach(options, id: \.self) { Text($0).tag($0) } }.font(.caption2) }
}
