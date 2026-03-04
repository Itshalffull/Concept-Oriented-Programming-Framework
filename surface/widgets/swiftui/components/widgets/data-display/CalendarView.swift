// ============================================================
// Clef Surface SwiftUI Widget — CalendarView
//
// Calendar display with date selection. Renders a monthly
// grid using SwiftUI DatePicker or custom grid layout.
// ============================================================

import SwiftUI

// --------------- Component ---------------

/// CalendarView for date display and selection.
///
/// - Parameters:
///   - selectedDate: Binding to the selected date.
///   - displayedMonth: The month/year being displayed.
///   - onDateSelect: Callback when a date is selected.
struct CalendarWidgetView: View {
    @Binding var selectedDate: Date?
    var displayedMonth: Date = Date()
    var onDateSelect: ((Date) -> Void)? = nil

    var body: some View {
        DatePicker(
            "Select Date",
            selection: Binding(
                get: { selectedDate ?? Date() },
                set: { newDate in
                    selectedDate = newDate
                    onDateSelect?(newDate)
                }
            ),
            displayedComponents: [.date]
        )
        .datePickerStyle(.graphical)
        .accessibilityLabel("Calendar")
    }
}
