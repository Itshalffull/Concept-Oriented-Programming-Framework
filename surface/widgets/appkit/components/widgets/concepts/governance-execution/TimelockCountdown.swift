import AppKit

class TimelockCountdownView: NSView {

    enum State: String { case running; case warning; case critical; case expired; case executing; case completed; case paused }

    private(set) var state: State = .running
    private var phase: String = ""
    private var deadline: Date = Date()
    private var warningThreshold: Double = 0.75
    private var criticalThreshold: Double = 0.9
    private var totalDuration: TimeInterval = 0
    private var countdownTimer: Timer?
    private var trackingArea: NSTrackingArea?

    var onExpire: (() -> Void)?
    var onExecute: (() -> Void)?
    var onChallenge: (() -> Void)?

    private let rootStack = NSStackView()
    private let phaseLabel = NSTextField(labelWithString: "")
    private let countdownLabel = NSTextField(labelWithString: "")
    private let targetDateLabel = NSTextField(labelWithString: "")
    private let progressBar = NSProgressIndicator()
    private let actionStack = NSStackView()
    private let executeButton = NSButton(title: "Execute", target: nil, action: nil)
    private let challengeButton = NSButton(title: "Challenge", target: nil, action: nil)

    // MARK: - State machine

    func reduce(_ event: String) {
        switch state {
        case .running:
            if event == "TICK" { /* stay */ }
            if event == "WARNING_THRESHOLD" { state = .warning }
            if event == "EXPIRE" { state = .expired; onExpire?() }
            if event == "PAUSE" { state = .paused; stopTimer() }
        case .warning:
            if event == "TICK" { /* stay */ }
            if event == "CRITICAL_THRESHOLD" { state = .critical }
            if event == "EXPIRE" { state = .expired; onExpire?() }
        case .critical:
            if event == "TICK" { /* stay */ }
            if event == "EXPIRE" { state = .expired; onExpire?() }
        case .expired:
            if event == "EXECUTE" { state = .executing; onExecute?() }
            if event == "RESET" { state = .running; startTimer() }
        case .executing:
            if event == "EXECUTE_COMPLETE" { state = .completed; stopTimer() }
            if event == "EXECUTE_ERROR" { state = .expired }
        case .completed:
            break
        case .paused:
            if event == "RESUME" { state = .running; startTimer() }
        }
        updateUI()
    }

    // MARK: - Init

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Countdown timer for governance timelock period")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    // MARK: - Setup

    private func setupSubviews() {
        wantsLayer = true

        rootStack.orientation = .vertical
        rootStack.spacing = 8
        rootStack.alignment = .centerX
        rootStack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(rootStack)
        NSLayoutConstraint.activate([
            rootStack.topAnchor.constraint(equalTo: topAnchor, constant: 12),
            rootStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            rootStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            rootStack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -12),
        ])

        // Phase label
        phaseLabel.font = .boldSystemFont(ofSize: 12)
        phaseLabel.textColor = .secondaryLabelColor
        phaseLabel.alignment = .center
        rootStack.addArrangedSubview(phaseLabel)

        // Countdown
        countdownLabel.font = .monospacedDigitSystemFont(ofSize: 36, weight: .bold)
        countdownLabel.alignment = .center
        countdownLabel.setAccessibilityRole(.staticText)
        rootStack.addArrangedSubview(countdownLabel)

        // Target date
        targetDateLabel.font = .systemFont(ofSize: 11)
        targetDateLabel.textColor = .tertiaryLabelColor
        targetDateLabel.alignment = .center
        rootStack.addArrangedSubview(targetDateLabel)

        // Progress bar
        progressBar.style = .bar
        progressBar.minValue = 0
        progressBar.maxValue = 100
        progressBar.doubleValue = 0
        progressBar.setAccessibilityLabel("Timelock progress")
        rootStack.addArrangedSubview(progressBar)

        // Action buttons
        actionStack.orientation = .horizontal
        actionStack.spacing = 8
        executeButton.bezelStyle = .roundRect
        executeButton.target = self
        executeButton.action = #selector(handleExecute(_:))
        executeButton.setAccessibilityLabel("Execute governance action")
        challengeButton.bezelStyle = .roundRect
        challengeButton.target = self
        challengeButton.action = #selector(handleChallenge(_:))
        challengeButton.setAccessibilityLabel("Challenge governance action")
        actionStack.addArrangedSubview(executeButton)
        actionStack.addArrangedSubview(challengeButton)
        actionStack.isHidden = true
        rootStack.addArrangedSubview(actionStack)

        updateUI()
    }

    // MARK: - Configure

    func configure(phase: String, deadline: String, totalDuration: TimeInterval, warningThreshold: Double = 0.75, criticalThreshold: Double = 0.9) {
        self.phase = phase
        self.deadline = ISO8601DateFormatter().date(from: deadline) ?? Date()
        self.totalDuration = totalDuration
        self.warningThreshold = warningThreshold
        self.criticalThreshold = criticalThreshold

        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        targetDateLabel.stringValue = "Expires: \(formatter.string(from: self.deadline))"

        startTimer()
        updateUI()
    }

    private func startTimer() {
        stopTimer()
        countdownTimer = Timer.scheduledTimer(withTimeInterval: 1.0, repeats: true) { [weak self] _ in
            self?.tick()
        }
        tick()
    }

    private func stopTimer() {
        countdownTimer?.invalidate()
        countdownTimer = nil
    }

    private func tick() {
        let remaining = max(0, deadline.timeIntervalSinceNow)
        let elapsed = totalDuration - remaining
        let progress = totalDuration > 0 ? elapsed / totalDuration : 1.0

        reduce("TICK")

        // Check thresholds
        if remaining <= 0 {
            reduce("EXPIRE")
        } else if progress >= criticalThreshold && state == .warning {
            reduce("CRITICAL_THRESHOLD")
        } else if progress >= warningThreshold && state == .running {
            reduce("WARNING_THRESHOLD")
        }

        // Update countdown display
        let totalSec = Int(remaining)
        let days = totalSec / 86400
        let hours = (totalSec % 86400) / 3600
        let minutes = (totalSec % 3600) / 60
        let seconds = totalSec % 60

        if remaining <= 0 {
            countdownLabel.stringValue = "EXPIRED"
        } else if days > 0 {
            countdownLabel.stringValue = String(format: "%dd %02d:%02d:%02d", days, hours, minutes, seconds)
        } else {
            countdownLabel.stringValue = String(format: "%02d:%02d:%02d", hours, minutes, seconds)
        }

        progressBar.doubleValue = min(100, progress * 100)
        updateUI()
    }

    private func updateUI() {
        phaseLabel.stringValue = phase.uppercased()

        // Color by state
        switch state {
        case .running:
            countdownLabel.textColor = .labelColor
        case .warning:
            countdownLabel.textColor = .systemYellow
        case .critical:
            countdownLabel.textColor = .systemOrange
        case .expired:
            countdownLabel.textColor = .systemRed
        case .executing:
            countdownLabel.textColor = .systemBlue
            countdownLabel.stringValue = "EXECUTING..."
        case .completed:
            countdownLabel.textColor = .systemGreen
            countdownLabel.stringValue = "COMPLETED"
        case .paused:
            countdownLabel.textColor = .secondaryLabelColor
        }

        // Action buttons
        actionStack.isHidden = state != .expired

        setAccessibilityValue("\(phase), \(state.rawValue), \(countdownLabel.stringValue)")
    }

    // MARK: - Actions

    @objc private func handleExecute(_ sender: NSButton) { reduce("EXECUTE") }
    @objc private func handleChallenge(_ sender: NSButton) { onChallenge?() }

    // MARK: - Keyboard

    override var acceptsFirstResponder: Bool { true }

    override func keyDown(with event: NSEvent) {
        switch event.keyCode {
        case 49: // Space
            if state == .running || state == .warning || state == .critical { reduce("PAUSE") }
            else if state == .paused { reduce("RESUME") }
        default: super.keyDown(with: event)
        }
    }

    // MARK: - Cleanup

    deinit { countdownTimer?.invalidate() }
}
