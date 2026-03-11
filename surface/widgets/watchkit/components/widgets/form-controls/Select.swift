// ============================================================
// Clef Surface WatchKit Widget — Select
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct SelectView: View {
    var options: [(label: String, value: String)]; @Binding var selectedValue: String
    var body: some View { Picker("", selection: $selectedValue) { ForEach(options, id: \.value) { opt in Text(opt.label).tag(opt.value) } }.font(.caption2) }
}
