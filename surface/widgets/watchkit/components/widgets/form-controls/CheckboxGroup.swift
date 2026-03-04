// ============================================================
// Clef Surface WatchKit Widget — CheckboxGroup
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct CheckboxGroupView: View {
    var label: String = ""
    var options: [(label: String, value: String)]
    @Binding var selectedValues: Set<String>
    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            if !label.isEmpty { Text(label).font(.caption.bold()) }
            ForEach(options, id: \.value) { opt in
                Toggle(opt.label, isOn: Binding(get: { selectedValues.contains(opt.value) }, set: { if $0 { selectedValues.insert(opt.value) } else { selectedValues.remove(opt.value) } })).font(.caption2)
            }
        }
    }
}
