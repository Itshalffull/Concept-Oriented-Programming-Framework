import AppKit

class StreamTextView: NSView {
    enum State: String { case idle; case complete; case stopped }
    private var state: State = .idle

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Token-by-token text renderer for streami")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, textBlock, cursor, stopButton
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
