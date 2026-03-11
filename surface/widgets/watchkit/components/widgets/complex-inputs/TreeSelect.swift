// ============================================================
// Clef Surface WatchKit Widget — TreeSelect
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct TreeSelectView: View {
    var items: [(label: String, value: String)]; @Binding var selectedValue: String
    var body: some View { Picker("", selection: $selectedValue) { ForEach(items, id: \.value) { item in Text(item.label).tag(item.value) } }.font(.caption2) }
}
