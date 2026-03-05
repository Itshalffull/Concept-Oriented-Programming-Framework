import AppKit

class GenerationIndicatorView: NSView {
    enum State: String { case idle; case generating; case complete; case error }
    private var state: State = .idle

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Status indicator for LLM generation in p")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, spinner, statusText, modelBadge, tokenCounter, elapsed
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
