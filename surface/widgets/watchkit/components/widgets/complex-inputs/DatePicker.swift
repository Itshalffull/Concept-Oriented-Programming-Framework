// ============================================================
// Clef Surface WatchKit Widget — DatePicker
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct DatePickerView: View {
    var label: String = "Date"; @Binding var date: Date
    var body: some View { DatePicker(label, selection: $date, displayedComponents: .date).font(.caption2) }
}
