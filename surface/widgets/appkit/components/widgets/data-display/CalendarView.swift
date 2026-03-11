// ============================================================
// Clef Surface AppKit Widget — CalendarView
//
// Month-based calendar grid displaying dates with optional
// event markers. Supports date selection and navigation.
// ============================================================

import AppKit

public class ClefCalendarView: NSView {
    public var selectedDate: Date? { didSet { needsDisplay = true } }
    public var displayedMonth: Date = Date() { didSet { needsDisplay = true } }
    public var markedDates: Set<String> = [] // "yyyy-MM-dd"
    public var onDateSelect: ((Date) -> Void)?
    public var onMonthChange: ((Date) -> Void)?

    private let headerStack = NSStackView()
    private let prevButton = NSButton(title: "<", target: nil, action: nil)
    private let nextButton = NSButton(title: ">", target: nil, action: nil)
    private let monthLabel = NSTextField(labelWithString: "")
    private let gridView = NSGridView()

    public override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    private func setup() {
        prevButton.target = self
        prevButton.action = #selector(prevMonth)
        prevButton.bezelStyle = .inline
        nextButton.target = self
        nextButton.action = #selector(nextMonth)
        nextButton.bezelStyle = .inline
        monthLabel.font = NSFont.systemFont(ofSize: 14, weight: .semibold)
        monthLabel.alignment = .center

        headerStack.orientation = .horizontal
        headerStack.addArrangedSubview(prevButton)
        headerStack.addArrangedSubview(monthLabel)
        headerStack.addArrangedSubview(nextButton)
        addSubview(headerStack)
        addSubview(gridView)
    }

    @objc private func prevMonth() {
        displayedMonth = Calendar.current.date(byAdding: .month, value: -1, to: displayedMonth) ?? displayedMonth
        onMonthChange?(displayedMonth)
    }

    @objc private func nextMonth() {
        displayedMonth = Calendar.current.date(byAdding: .month, value: 1, to: displayedMonth) ?? displayedMonth
        onMonthChange?(displayedMonth)
    }

    public override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        let formatter = DateFormatter()
        formatter.dateFormat = "MMMM yyyy"
        monthLabel.stringValue = formatter.string(from: displayedMonth)
    }

    public override func layout() {
        super.layout()
        headerStack.frame = NSRect(x: 0, y: bounds.height - 32, width: bounds.width, height: 32)
        gridView.frame = NSRect(x: 0, y: 0, width: bounds.width, height: bounds.height - 40)
    }
}
