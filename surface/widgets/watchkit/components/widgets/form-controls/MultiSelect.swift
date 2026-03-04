// ============================================================
// Clef Surface WatchKit Widget — MultiSelect
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct MultiSelectView: View {
    var options: [(label: String, value: String)]
    @Binding var selectedValues: Set<String>
    var body: some View {
        List { ForEach(options, id: \.value) { opt in Button(action: { if selectedValues.contains(opt.value) { selectedValues.remove(opt.value) } else { selectedValues.insert(opt.value) } }) { HStack { Text(opt.label).font(.caption2); Spacer(); if selectedValues.contains(opt.value) { Image(systemName: "checkmark") } } } } }
    }
}
