import AppKit

class RunListTableView: NSView {
    enum State: String { case idle; case rowSelected }
    private var state: State = .idle

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Table listing process runs with columns ")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, filterBar, table, headerRow, dataRow, statusCell, nameCell, startCell, durationCell, outcomeCell, pagination
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
