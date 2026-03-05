import AppKit

class ArtifactPanelView: NSView {
    enum State: String { case open; case copied; case fullscreen; case closed }
    private var state: State = .open

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Side panel for displaying and interactin")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, header, titleText, typeBadge, toolbar, contentArea, versionBar, copyButton, downloadButton, closeButton
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
