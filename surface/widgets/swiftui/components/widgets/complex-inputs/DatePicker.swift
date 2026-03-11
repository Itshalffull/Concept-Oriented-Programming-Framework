// ============================================================
// Clef Surface SwiftUI Widget — DatePicker
//
// Date selection control using SwiftUI DatePicker with
// optional label and date range constraints.
// ============================================================

import SwiftUI

// --------------- Component ---------------

/// DatePicker view for date selection.
///
/// - Parameters:
///   - value: Binding to the selected date.
///   - label: Optional label text.
///   - minDate: Optional minimum selectable date.
///   - maxDate: Optional maximum selectable date.
///   - enabled: Whether the picker is enabled.
struct DatePickerView: View {
    @Binding var value: Date
    var label: String = "Select Date"
    var minDate: Date? = nil
    var maxDate: Date? = nil
    var enabled: Bool = true

    var body: some View {
        Group {
            if let minDate = minDate, let maxDate = maxDate {
                SwiftUI.DatePicker(label, selection: $value, in: minDate...maxDate, displayedComponents: [.date])
            } else if let minDate = minDate {
                SwiftUI.DatePicker(label, selection: $value, in: minDate..., displayedComponents: [.date])
            } else if let maxDate = maxDate {
                SwiftUI.DatePicker(label, selection: $value, in: ...maxDate, displayedComponents: [.date])
            } else {
                SwiftUI.DatePicker(label, selection: $value, displayedComponents: [.date])
            }
        }
        .disabled(!enabled)
        .accessibilityLabel(label)
    }
}
