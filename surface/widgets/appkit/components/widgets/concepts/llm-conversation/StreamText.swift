import AppKit

class StreamTextView: NSView {

    enum State: String { case idle; case streaming; case complete; case stopped }

    private(set) var state: State = .idle
    private var text: String = ""
    private var cursorVisible: Bool = true
    private var cursorTimer: Timer?
    private var trackingArea: NSTrackingArea?

    var onStop: (() -> Void)?

    private let rootStack = NSStackView()
    private let textLabel = NSTextField(wrappingLabelWithString: "")
    private let cursorView = NSView()
    private let stopBtn = NSButton(title: "Stop", target: nil, action: nil)

    // MARK: - State machine

    func reduce(_ event: String) {
        switch state {
        case .idle:
            if event == "STREAM_START" { state = .streaming; startCursor() }
        case .streaming:
            if event == "STREAM_END" { state = .complete; stopCursor() }
            if event == "STOP" { state = .stopped; stopCursor(); onStop?() }
        case .complete:
            break
        case .stopped:
            break
        }
        updateUI()
    }

    // MARK: - Init

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Token-by-token text renderer for streaming LLM output")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    // MARK: - Setup

    private func setupSubviews() {
        wantsLayer = true

        rootStack.orientation = .vertical
        rootStack.spacing = 4
        rootStack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(rootStack)
        NSLayoutConstraint.activate([
            rootStack.topAnchor.constraint(equalTo: topAnchor, constant: 4),
            rootStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
            rootStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
            rootStack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -4),
        ])

        textLabel.font = .systemFont(ofSize: 14)
        textLabel.isSelectable = true
        rootStack.addArrangedSubview(textLabel)

        // Cursor
        cursorView.wantsLayer = true
        cursorView.layer?.backgroundColor = NSColor.labelColor.cgColor
        cursorView.widthAnchor.constraint(equalToConstant: 2).isActive = true
        cursorView.heightAnchor.constraint(equalToConstant: 16).isActive = true
        cursorView.isHidden = true
        rootStack.addArrangedSubview(cursorView)

        // Stop button
        stopBtn.bezelStyle = .roundRect
        stopBtn.target = self
        stopBtn.action = #selector(handleStop(_:))
        stopBtn.setAccessibilityLabel("Stop generation")
        stopBtn.isHidden = true
        rootStack.addArrangedSubview(stopBtn)

        updateUI()
    }

    // MARK: - Configure

    func configure(text: String = "", streaming: Bool = false) {
        self.text = text
        textLabel.stringValue = text
        if streaming && state == .idle { reduce("STREAM_START") }
        else if !streaming && state == .streaming { reduce("STREAM_END") }
    }

    func appendToken(_ token: String) {
        text += token
        textLabel.stringValue = text
    }

    private func startCursor() {
        cursorView.isHidden = false
        cursorTimer = Timer.scheduledTimer(withTimeInterval: 0.5, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            self.cursorVisible.toggle()
            self.cursorView.isHidden = !self.cursorVisible
        }
    }

    private func stopCursor() {
        cursorTimer?.invalidate()
        cursorTimer = nil
        cursorView.isHidden = true
    }

    private func updateUI() {
        stopBtn.isHidden = state != .streaming
        cursorView.isHidden = state != .streaming || !cursorVisible

        setAccessibilityValue("Stream text: \(state.rawValue), \(text.count) characters")
    }

    // MARK: - Actions

    @objc private func handleStop(_ sender: NSButton) { reduce("STOP") }

    // MARK: - Keyboard

    override var acceptsFirstResponder: Bool { true }

    override func keyDown(with event: NSEvent) {
        if event.keyCode == 53 && state == .streaming { reduce("STOP") } // Escape
        else { super.keyDown(with: event) }
    }

    deinit { cursorTimer?.invalidate() }
}
