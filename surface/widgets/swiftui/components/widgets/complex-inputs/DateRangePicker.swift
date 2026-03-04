// ============================================================
// Clef Surface SwiftUI Widget — DateRangePicker
//
// Date range selection with start and end date pickers.
// Validates that end date is not before start date.
// ============================================================

import SwiftUI

// --------------- Component ---------------

/// DateRangePicker view for selecting a date range.
///
/// - Parameters:
///   - startDate: Binding to the start date.
///   - endDate: Binding to the end date.
///   - label: Optional label text.
///   - enabled: Whether the picker is enabled.
struct DateRangePickerView: View {
    @Binding var startDate: Date
    @Binding var endDate: Date
    var label: String? = nil
    var enabled: Bool = true

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let label = label {
                Text(label)
                    .font(.headline)
            }

            SwiftUI.DatePicker("Start", selection: $startDate, displayedComponents: [.date])
                .disabled(!enabled)

            SwiftUI.DatePicker("End", selection: $endDate, in: startDate..., displayedComponents: [.date])
                .disabled(!enabled)
        }
    }
}
