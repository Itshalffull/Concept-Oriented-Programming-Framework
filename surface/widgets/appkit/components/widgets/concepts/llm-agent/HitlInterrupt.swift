import AppKit

class HitlInterruptView: NSView {
    enum State: String { case pending; case editing; case approving; case rejecting; case forking }
    private var state: State = .pending

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Human-in-the-loop interrupt banner for a")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, header, reasonText, stateEditor, contextInput, actionBar, approveButton, rejectButton, modifyButton, forkButton
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
