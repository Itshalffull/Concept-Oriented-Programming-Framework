// ============================================================
// Clef Surface WatchKit Widget — RadioGroup
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct RadioGroupView: View {
    var label: String = ""; var options: [(label: String, value: String)]; @Binding var selectedValue: String
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if !label.isEmpty { Text(label).font(.caption.bold()) }
            ForEach(options, id: \.value) { opt in
                Button(action: { selectedValue = opt.value }) { HStack { Image(systemName: selectedValue == opt.value ? "largecircle.fill.circle" : "circle").foregroundColor(.accentColor).font(.caption); Text(opt.label).font(.caption2) } }.buttonStyle(.plain)
            }
        }
    }
}
