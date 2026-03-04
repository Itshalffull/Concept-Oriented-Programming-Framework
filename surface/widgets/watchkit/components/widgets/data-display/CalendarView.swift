// ============================================================
// Clef Surface WatchKit Widget — CalendarView
//
// watchOS SwiftUI implementation. Simplified for compact
// round-screen display with minimal interaction patterns.
// ============================================================

import SwiftUI

struct CalendarGridView: View {
    var selectedDate: Date?
    var body: some View {
        Text(selectedDate?.formatted(.dateTime.month().day()) ?? "No date")
            .font(.caption)
    }
}
