import AppKit

class TraceTreeView: NSView {
    enum State: String { case idle; case spanSelected; case ready; case fetching }
    private var state: State = .idle

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Hierarchical execution trace viewer disp")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, header, filterBar, tree, spanNode, spanIcon, spanLabel, spanDuration, spanTokens, spanStatus, spanChildren, detailPanel
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
