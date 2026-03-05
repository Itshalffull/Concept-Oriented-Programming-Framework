import AppKit

class EvalResultsTableView: NSView {
    enum State: String { case idle; case rowSelected }
    private var state: State = .idle

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Results table for LLM evaluation runs sh")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, summaryBar, scoreDisplay, passFailBar, table, headerRow, dataRow, statusCell, inputCell, outputCell, expectedCell, scoreCell, detailPanel
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
