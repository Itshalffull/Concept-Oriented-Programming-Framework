// ============================================================
// Clef Surface WatchKit Widget — DateRangePicker
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct DateRangePickerView: View {
    @Binding var startDate: Date; @Binding var endDate: Date
    var body: some View { VStack { DatePicker("Start", selection: $startDate, displayedComponents: .date).font(.caption2); DatePicker("End", selection: $endDate, displayedComponents: .date).font(.caption2) } }
}
