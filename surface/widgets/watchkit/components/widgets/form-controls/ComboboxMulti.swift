// ============================================================
// Clef Surface WatchKit Widget — ComboboxMulti
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct ComboboxMultiView: View {
    var options: [String]
    @Binding var selectedValues: Set<String>
    var body: some View {
        List { ForEach(options, id: \.self) { opt in Button(action: { if selectedValues.contains(opt) { selectedValues.remove(opt) } else { selectedValues.insert(opt) } }) { HStack { Text(opt).font(.caption2); Spacer(); if selectedValues.contains(opt) { Image(systemName: "checkmark").font(.caption2) } } } } }
    }
}
