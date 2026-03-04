// ============================================================
// Clef Surface AppKit Widget — DateRangePicker
//
// Paired date pickers for selecting a start and end date
// range with validation that start precedes end.
// ============================================================

import AppKit

public class ClefDateRangePickerView: NSView {
    public var startDate: Date = Date() { didSet { startPicker.dateValue = startDate } }
    public var endDate: Date = Date() { didSet { endPicker.dateValue = endDate } }
    public var onRangeChange: ((Date, Date) -> Void)?

    private let startPicker = NSDatePicker()
    private let endPicker = NSDatePicker()
    private let dashLabel = NSTextField(labelWithString: "to")

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        for picker in [startPicker, endPicker] {
            picker.datePickerStyle = .textFieldAndStepper
            picker.datePickerElements = [.yearMonthDay]
            picker.target = self
            picker.action = #selector(handleChange)
        }
        dashLabel.font = NSFont.systemFont(ofSize: 13)
        dashLabel.alignment = .center

        addSubview(startPicker)
        addSubview(dashLabel)
        addSubview(endPicker)
    }

    @objc private func handleChange() {
        startDate = startPicker.dateValue
        endDate = endPicker.dateValue
        if endDate < startDate { endDate = startDate; endPicker.dateValue = endDate }
        onRangeChange?(startDate, endDate)
    }

    public override func layout() {
        super.layout()
        let pickerWidth = (bounds.width - 40) / 2
        startPicker.frame = NSRect(x: 0, y: 0, width: pickerWidth, height: bounds.height)
        dashLabel.frame = NSRect(x: pickerWidth, y: 0, width: 40, height: bounds.height)
        endPicker.frame = NSRect(x: pickerWidth + 40, y: 0, width: pickerWidth, height: bounds.height)
    }
}
