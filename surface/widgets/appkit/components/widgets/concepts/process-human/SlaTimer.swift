import AppKit

class SlaTimerView: NSView {

    enum State: String { case onTrack; case warning; case critical; case breached; case paused }

    private(set) var state: State = .onTrack
    private var dueTime: Date = Date()
    private var startTime: Date = Date()
    private var warningThreshold: Double = 0.7
    private var criticalThreshold: Double = 0.9
    private var remainingMs: Int = 0
    private var elapsedMs: Int = 0
    private var progress: Double = 0.0
    private var tickTimer: Timer?
    private var warningFired = false
    private var criticalFired = false
    private var breachFired = false

    var onBreach: (() -> Void)?
    var onWarning: (() -> Void)?
    var onCritical: (() -> Void)?

    private let rootStack = NSStackView()
    private let countdownLabel = NSTextField(labelWithString: "00:00:00")
    private let phaseLabel = NSTextField(labelWithString: "On Track")
    private let progressBar = NSProgressIndicator()
    private let elapsedLabel = NSTextField(labelWithString: "")
    private let pauseResumeBtn = NSButton(title: "Pause", target: nil, action: nil)

    func reduce(_ event: String) {
        switch state {
        case .onTrack:
            if event == "TICK" { /* stay */ }
            if event == "WARNING_THRESHOLD" { state = .warning }
            if event == "PAUSE" { state = .paused; stopTimer() }
        case .warning:
            if event == "TICK" { /* stay */ }
            if event == "CRITICAL_THRESHOLD" { state = .critical }
            if event == "PAUSE" { state = .paused; stopTimer() }
        case .critical:
            if event == "TICK" { /* stay */ }
            if event == "BREACH" { state = .breached; stopTimer() }
            if event == "PAUSE" { state = .paused; stopTimer() }
        case .breached:
            if event == "TICK" { /* stay */ }
        case .paused:
            if event == "RESUME" { state = .onTrack; startTimer() }
        }
        updateUI()
    }

    override init(frame: NSRect) {
        super.init(frame: frame); setupSubviews()
        setAccessibilityRole(.group); setAccessibilityLabel("Five-state countdown timer for service level agreement tracking")
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

        countdownLabel.font = .monospacedDigitSystemFont(ofSize: 28, weight: .bold)
        countdownLabel.alignment = .center
        countdownLabel.setAccessibilityLabel("Time remaining")
        rootStack.addArrangedSubview(countdownLabel)

        phaseLabel.font = .boldSystemFont(ofSize: 14); phaseLabel.alignment = .center
        rootStack.addArrangedSubview(phaseLabel)

        progressBar.isIndeterminate = false; progressBar.minValue = 0; progressBar.maxValue = 100
        progressBar.style = .bar
        progressBar.setAccessibilityLabel("SLA progress")
        rootStack.addArrangedSubview(progressBar)

        elapsedLabel.font = .systemFont(ofSize: 11); elapsedLabel.textColor = .secondaryLabelColor
        elapsedLabel.alignment = .center
        rootStack.addArrangedSubview(elapsedLabel)

        pauseResumeBtn.bezelStyle = .roundRect; pauseResumeBtn.target = self; pauseResumeBtn.action = #selector(handlePauseResume(_:))
        rootStack.addArrangedSubview(pauseResumeBtn)

        updateUI()
    }

    func configure(dueAt: Date, startedAt: Date? = nil, warningThreshold: Double = 0.7, criticalThreshold: Double = 0.9) {
        self.dueTime = dueAt
        self.startTime = startedAt ?? Date()
        self.warningThreshold = warningThreshold
        self.criticalThreshold = criticalThreshold
        self.warningFired = false; self.criticalFired = false; self.breachFired = false
        self.state = .onTrack
        startTimer()
    }

    private func startTimer() {
        stopTimer()
        tick()
        tickTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in self?.tick() }
    }

    private func stopTimer() { tickTimer?.invalidate(); tickTimer = nil }

    private func tick() {
        let now = Date()
        let rem = max(0, dueTime.timeIntervalSince(now))
        let elap = now.timeIntervalSince(startTime)
        let totalDuration = dueTime.timeIntervalSince(startTime)
        let prog = totalDuration > 0 ? min(1, elap / totalDuration) : 1

        remainingMs = Int(rem * 1000)
        elapsedMs = Int(elap * 1000)
        progress = prog

        reduce("TICK")

        if rem <= 0 && !breachFired {
            breachFired = true; reduce("BREACH"); onBreach?()
        } else if prog >= criticalThreshold && !criticalFired && rem > 0 {
            criticalFired = true; reduce("CRITICAL_THRESHOLD"); onCritical?()
        } else if prog >= warningThreshold && !warningFired && rem > 0 {
            warningFired = true; reduce("WARNING_THRESHOLD"); onWarning?()
        }
    }

    private func formatCountdown(_ ms: Int) -> String {
        if ms <= 0 { return "00:00:00" }
        let totalSec = ms / 1000
        let h = totalSec / 3600; let m = (totalSec % 3600) / 60; let s = totalSec % 60
        return String(format: "%02d:%02d:%02d", h, m, s)
    }

    private func formatElapsed(_ ms: Int) -> String {
        if ms <= 0 { return "0s" }
        let totalSec = ms / 1000
        let h = totalSec / 3600; let m = (totalSec % 3600) / 60; let s = totalSec % 60
        if h > 0 { return "\(h)h \(m)m \(s)s" }
        if m > 0 { return "\(m)m \(s)s" }
        return "\(s)s"
    }

    private var phaseText: String {
        switch state {
        case .onTrack: return "On Track"
        case .warning: return "Warning"
        case .critical: return "Critical"
        case .breached: return "Breached"
        case .paused: return "Paused"
        }
    }

    private var phaseColor: NSColor {
        switch state {
        case .onTrack: return .systemGreen
        case .warning: return .systemYellow
        case .critical: return .systemOrange
        case .breached: return .systemRed
        case .paused: return .secondaryLabelColor
        }
    }

    private func updateUI() {
        countdownLabel.stringValue = state == .breached ? "BREACHED" : formatCountdown(remainingMs)
        countdownLabel.textColor = phaseColor
        phaseLabel.stringValue = phaseText; phaseLabel.textColor = phaseColor
        progressBar.doubleValue = progress * 100
        elapsedLabel.stringValue = "Elapsed: \(formatElapsed(elapsedMs))"
        pauseResumeBtn.title = state == .paused ? "Resume" : "Pause"
        pauseResumeBtn.isHidden = state == .breached
        setAccessibilityValue("\(phaseText), \(formatCountdown(remainingMs)) remaining")
    }

    @objc private func handlePauseResume(_ sender: NSButton) {
        if state == .paused { reduce("RESUME") } else { reduce("PAUSE") }
    }

    override var acceptsFirstResponder: Bool { true }
    override func keyDown(with event: NSEvent) {
        if event.keyCode == 49 { // space
            handlePauseResume(pauseResumeBtn)
        } else {
            super.keyDown(with: event)
        }
    }
    deinit { tickTimer?.invalidate() }
}
