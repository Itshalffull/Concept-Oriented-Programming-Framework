// ============================================================
// Clef Surface AppKit Widget — DatePicker
//
// Date selection control wrapping NSDatePicker. Supports
// textual and graphical date selection modes.
// ============================================================

import AppKit

public class ClefDatePicker: NSDatePicker {
    public var onDateChange: ((Date) -> Void)?

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        datePickerStyle = .textFieldAndStepper
        datePickerElements = [.yearMonthDay]
        target = self
        action = #selector(handleChange)
    }

    @objc private func handleChange() {
        onDateChange?(dateValue)
    }

    public func setGraphicalStyle() {
        datePickerStyle = .clockAndCalendar
    }
}
