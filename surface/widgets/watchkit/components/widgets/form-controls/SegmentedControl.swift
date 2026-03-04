// ============================================================
// Clef Surface WatchKit Widget — SegmentedControl
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct SegmentedControlView: View {
    var options: [String]; @Binding var selectedIndex: Int
    var body: some View { Picker("", selection: $selectedIndex) { ForEach(0..<options.count, id: \.self) { i in Text(options[i]).tag(i) } }.pickerStyle(.segmented) }
}
