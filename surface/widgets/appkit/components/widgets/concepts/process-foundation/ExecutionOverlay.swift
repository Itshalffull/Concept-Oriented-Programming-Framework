import AppKit

class ExecutionOverlayView: NSView {

    enum State: String { case idle; case live; case suspended; case completed; case failed; case cancelled; case replay }

    private(set) var state: State = .idle
    private var activeNodeId: String? = nil
    private var elapsedMs: Int = 0
    private var errorMessage: String? = nil
    private var elapsedTimer: Timer?

    var onSuspend: (() -> Void)?
    var onResume: (() -> Void)?
    var onCancel: (() -> Void)?
    var onReplay: (() -> Void)?

    private let rootStack = NSStackView()
    private let statusBar = NSStackView()
    private let statusLabel = NSTextField(labelWithString: "Idle")
    private let elapsedLabel = NSTextField(labelWithString: "")
    private let activeNodeLabel = NSTextField(labelWithString: "")
    private let controlStack = NSStackView()
    private let suspendBtn = NSButton(title: "Suspend", target: nil, action: nil)
    private let resumeBtn = NSButton(title: "Resume", target: nil, action: nil)
    private let cancelBtn = NSButton(title: "Cancel", target: nil, action: nil)
    private let replayBtn = NSButton(title: "Replay", target: nil, action: nil)
    private let errorBanner = NSTextField(wrappingLabelWithString: "")

    func reduce(_ event: String) {
        switch state {
        case .idle:
            if event == "START" { state = .live; startTimer() }
        case .live:
            if event == "SUSPEND" { state = .suspended; stopTimer(); onSuspend?() }
            if event == "COMPLETE" { state = .completed; stopTimer() }
            if event == "FAIL" { state = .failed; stopTimer() }
            if event == "CANCEL" { state = .cancelled; stopTimer(); onCancel?() }
        case .suspended:
            if event == "RESUME" { state = .live; startTimer(); onResume?() }
            if event == "CANCEL" { state = .cancelled; onCancel?() }
        case .completed:
            if event == "REPLAY" { state = .replay; onReplay?() }
            if event == "RESET" { state = .idle; elapsedMs = 0 }
        case .failed:
            if event == "REPLAY" { state = .replay; onReplay?() }
            if event == "RESET" { state = .idle; elapsedMs = 0; errorMessage = nil }
        case .cancelled:
            if event == "RESET" { state = .idle; elapsedMs = 0 }
        case .replay:
            if event == "REPLAY_END" { state = .completed }
        }
        updateUI()
    }

    override init(frame: NSRect) {
        super.init(frame: frame); setupSubviews()
        setAccessibilityRole(.group); setAccessibilityLabel("Runtime state overlay for process execution")
    }
    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        wantsLayer = true; layer?.cornerRadius = 8
        rootStack.orientation = .vertical; rootStack.spacing = 6
        rootStack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(rootStack)
        NSLayoutConstraint.activate([
            rootStack.topAnchor.constraint(equalTo: topAnchor, constant: 8),
            rootStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
            rootStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
            rootStack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -8),
        ])

        statusBar.orientation = .horizontal; statusBar.spacing = 8
        statusLabel.font = .boldSystemFont(ofSize: 13)
        elapsedLabel.font = .monospacedDigitSystemFont(ofSize: 12, weight: .regular); elapsedLabel.textColor = .secondaryLabelColor
        activeNodeLabel.font = .systemFont(ofSize: 12); activeNodeLabel.textColor = .tertiaryLabelColor
        statusBar.addArrangedSubview(statusLabel); statusBar.addArrangedSubview(elapsedLabel); statusBar.addArrangedSubview(activeNodeLabel)
        rootStack.addArrangedSubview(statusBar)

        controlStack.orientation = .horizontal; controlStack.spacing = 6
        suspendBtn.bezelStyle = .roundRect; suspendBtn.target = self; suspendBtn.action = #selector(handleSuspend(_:))
        resumeBtn.bezelStyle = .roundRect; resumeBtn.target = self; resumeBtn.action = #selector(handleResume(_:))
        cancelBtn.bezelStyle = .roundRect; cancelBtn.target = self; cancelBtn.action = #selector(handleCancel(_:))
        replayBtn.bezelStyle = .roundRect; replayBtn.target = self; replayBtn.action = #selector(handleReplay(_:))
        controlStack.addArrangedSubview(suspendBtn); controlStack.addArrangedSubview(resumeBtn)
        controlStack.addArrangedSubview(cancelBtn); controlStack.addArrangedSubview(replayBtn)
        rootStack.addArrangedSubview(controlStack)

        errorBanner.font = .systemFont(ofSize: 12); errorBanner.textColor = .systemRed; errorBanner.isHidden = true
        rootStack.addArrangedSubview(errorBanner)
        updateUI()
    }

    func configure(activeNode: String? = nil, error: String? = nil) {
        activeNodeId = activeNode; errorMessage = error; updateUI()
    }

    private func startTimer() {
        elapsedTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            self?.elapsedMs += 1000; self?.updateUI()
        }
    }
    private func stopTimer() { elapsedTimer?.invalidate(); elapsedTimer = nil }

    private func updateUI() {
        statusLabel.stringValue = state.rawValue.capitalized
        switch state {
        case .idle: statusLabel.textColor = .secondaryLabelColor
        case .live: statusLabel.textColor = .systemGreen
        case .suspended: statusLabel.textColor = .systemOrange
        case .completed: statusLabel.textColor = .systemBlue
        case .failed: statusLabel.textColor = .systemRed
        case .cancelled: statusLabel.textColor = .secondaryLabelColor
        case .replay: statusLabel.textColor = .systemPurple
        }
        let sec = elapsedMs / 1000
        elapsedLabel.stringValue = String(format: "%02d:%02d", sec / 60, sec % 60)
        activeNodeLabel.stringValue = activeNodeId ?? ""
        suspendBtn.isHidden = state != .live; resumeBtn.isHidden = state != .suspended
        cancelBtn.isHidden = state != .live && state != .suspended
        replayBtn.isHidden = state != .completed && state != .failed
        errorBanner.isHidden = errorMessage == nil; errorBanner.stringValue = errorMessage ?? ""
        setAccessibilityValue("\(state.rawValue), elapsed \(sec)s")
    }

    @objc private func handleSuspend(_ sender: NSButton) { reduce("SUSPEND") }
    @objc private func handleResume(_ sender: NSButton) { reduce("RESUME") }
    @objc private func handleCancel(_ sender: NSButton) { reduce("CANCEL") }
    @objc private func handleReplay(_ sender: NSButton) { reduce("REPLAY") }

    override var acceptsFirstResponder: Bool { true }
    deinit { elapsedTimer?.invalidate() }
}
