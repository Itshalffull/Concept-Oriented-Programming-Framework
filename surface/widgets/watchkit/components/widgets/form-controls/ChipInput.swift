// ============================================================
// Clef Surface WatchKit Widget — ChipInput
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct ChipInputView: View {
    @Binding var chips: [String]
    @State private var newChip: String = ""
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            ScrollView(.horizontal) { HStack(spacing: 4) { ForEach(chips, id: \.self) { chip in ChipView(label: chip) } } }
            TextField("Add...", text: $newChip).font(.caption2).onSubmit { if !newChip.isEmpty { chips.append(newChip); newChip = "" } }
        }
    }
}
