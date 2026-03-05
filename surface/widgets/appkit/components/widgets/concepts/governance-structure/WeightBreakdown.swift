import AppKit

class WeightBreakdownView: NSView {
    enum State: String { case idle; case segmentHovered }
    private var state: State = .idle

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Stacked bar or donut chart showing the c")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, chart, segment, legend, legendItem, totalDisplay, tooltip
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
