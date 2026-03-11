import AppKit

class TraceStepControlsView: NSView {

    enum State: String { case paused; case playing }

    private(set) var state: State = .paused
    private var currentStep: Int = 0
    private var totalSteps: Int = 0
    private var speed: Int = 1
    private var showSpeed: Bool = true
    private var playTimer: Timer?
    private var trackingArea: NSTrackingArea?

    var onStepForward: (() -> Void)?
    var onStepBack: (() -> Void)?
    var onPlay: (() -> Void)?
    var onPause: (() -> Void)?
    var onSeek: ((Int) -> Void)?
    var onFirst: (() -> Void)?
    var onLast: (() -> Void)?
    var onSpeedChange: ((Int) -> Void)?

    private let rootStack = NSStackView()
    private let transportStack = NSStackView()
    private let stepCounterLabel = NSTextField(labelWithString: "")
    private let progressBar = NSProgressIndicator()
    private let speedStack = NSStackView()

    // MARK: - State machine

    func reduce(_ event: String) {
        switch state {
        case .paused:
            if event == "PLAY" { state = .playing; startPlayback() }
            if event == "STEP_FWD" { onStepForward?() }
            if event == "STEP_BACK" { onStepBack?() }
            if event == "JUMP_START" { onFirst?() }
            if event == "JUMP_END" { onLast?() }
        case .playing:
            if event == "PAUSE" { state = .paused; stopPlayback() }
            if event == "REACH_END" { state = .paused; stopPlayback(); onPause?() }
        }
        updateUI()
    }

    // MARK: - Init

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Playback control toolbar for navigating trace steps")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    // MARK: - Setup

    private func setupSubviews() {
        wantsLayer = true

        rootStack.orientation = .vertical
        rootStack.spacing = 8
        rootStack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(rootStack)
        NSLayoutConstraint.activate([
            rootStack.topAnchor.constraint(equalTo: topAnchor, constant: 8),
            rootStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
            rootStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
            rootStack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -8),
        ])

        // Transport buttons
        transportStack.orientation = .horizontal
        transportStack.spacing = 4
        transportStack.distribution = .fillEqually

        let jumpStartBtn = NSButton(title: "\u{25C4}\u{2502}", target: self, action: #selector(handleJumpStart(_:)))
        jumpStartBtn.bezelStyle = .roundRect
        jumpStartBtn.setAccessibilityLabel("Jump to start")
        transportStack.addArrangedSubview(jumpStartBtn)

        let stepBackBtn = NSButton(title: "\u{25C4}", target: self, action: #selector(handleStepBack(_:)))
        stepBackBtn.bezelStyle = .roundRect
        stepBackBtn.setAccessibilityLabel("Step backward")
        transportStack.addArrangedSubview(stepBackBtn)

        let playPauseBtn = NSButton(title: "\u{25B6}", target: self, action: #selector(handlePlayPause(_:)))
        playPauseBtn.bezelStyle = .roundRect
        playPauseBtn.tag = 100
        playPauseBtn.setAccessibilityLabel("Play")
        transportStack.addArrangedSubview(playPauseBtn)

        let stepFwdBtn = NSButton(title: "\u{25BA}", target: self, action: #selector(handleStepFwd(_:)))
        stepFwdBtn.bezelStyle = .roundRect
        stepFwdBtn.setAccessibilityLabel("Step forward")
        transportStack.addArrangedSubview(stepFwdBtn)

        let jumpEndBtn = NSButton(title: "\u{2502}\u{25BA}", target: self, action: #selector(handleJumpEnd(_:)))
        jumpEndBtn.bezelStyle = .roundRect
        jumpEndBtn.setAccessibilityLabel("Jump to end")
        transportStack.addArrangedSubview(jumpEndBtn)

        rootStack.addArrangedSubview(transportStack)

        // Step counter
        stepCounterLabel.font = .systemFont(ofSize: 13)
        stepCounterLabel.alignment = .center
        stepCounterLabel.setAccessibilityRole(.staticText)
        rootStack.addArrangedSubview(stepCounterLabel)

        // Progress bar
        progressBar.style = .bar
        progressBar.minValue = 0
        progressBar.maxValue = 100
        progressBar.doubleValue = 0
        progressBar.setAccessibilityLabel("Trace progress")
        rootStack.addArrangedSubview(progressBar)

        // Speed control
        speedStack.orientation = .horizontal
        speedStack.spacing = 4
        for s in [1, 2, 4] {
            let btn = NSButton(title: "\(s)x", target: self, action: #selector(handleSpeedClick(_:)))
            btn.bezelStyle = .roundRect
            btn.tag = s
            btn.setAccessibilityLabel("Playback speed \(s)x")
            speedStack.addArrangedSubview(btn)
        }
        rootStack.addArrangedSubview(speedStack)

        updateUI()
    }

    // MARK: - Configure

    func configure(currentStep: Int, totalSteps: Int, playing: Bool, speed: Int = 1, showSpeed: Bool = true) {
        self.currentStep = currentStep
        self.totalSteps = totalSteps
        self.speed = speed
        self.showSpeed = showSpeed
        if playing && state == .paused { reduce("PLAY") }
        else if !playing && state == .playing { reduce("PAUSE") }
        updateUI()
    }

    private func updateUI() {
        let atFirst = currentStep <= 0
        let atLast = currentStep >= totalSteps - 1
        let progressPct = totalSteps > 0 ? Double(currentStep + 1) / Double(totalSteps) * 100.0 : 0

        stepCounterLabel.stringValue = "Step \(currentStep + 1) of \(totalSteps)"
        progressBar.doubleValue = progressPct
        speedStack.isHidden = !showSpeed

        // Update play/pause button
        for view in transportStack.arrangedSubviews {
            guard let btn = view as? NSButton else { continue }
            if btn.tag == 100 {
                btn.title = state == .playing ? "\u{23F8}" : "\u{25B6}"
                btn.setAccessibilityLabel(state == .playing ? "Pause" : "Play")
            }
        }

        // Disable buttons at boundaries
        if let btns = transportStack.arrangedSubviews as? [NSButton], btns.count >= 5 {
            btns[0].isEnabled = !atFirst
            btns[1].isEnabled = !atFirst
            btns[3].isEnabled = !atLast
            btns[4].isEnabled = !atLast
        }

        setAccessibilityValue("Step \(currentStep + 1) of \(totalSteps), \(state.rawValue)")

        // Auto-pause at end
        if state == .playing && atLast {
            reduce("REACH_END")
        }
    }

    // MARK: - Playback

    private func startPlayback() {
        stopPlayback()
        let interval = 1.0 / Double(speed)
        playTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
            self?.onStepForward?()
        }
        onPlay?()
    }

    private func stopPlayback() {
        playTimer?.invalidate()
        playTimer = nil
    }

    // MARK: - Actions

    @objc private func handleJumpStart(_ sender: NSButton) { reduce("JUMP_START") }
    @objc private func handleStepBack(_ sender: NSButton) { reduce("STEP_BACK") }
    @objc private func handlePlayPause(_ sender: NSButton) {
        if state == .playing { reduce("PAUSE"); onPause?() }
        else { reduce("PLAY") }
    }
    @objc private func handleStepFwd(_ sender: NSButton) { reduce("STEP_FWD") }
    @objc private func handleJumpEnd(_ sender: NSButton) { reduce("JUMP_END") }
    @objc private func handleSpeedClick(_ sender: NSButton) {
        speed = sender.tag
        onSpeedChange?(speed)
        if state == .playing { startPlayback() }
    }

    // MARK: - Keyboard

    override var acceptsFirstResponder: Bool { true }

    override func keyDown(with event: NSEvent) {
        switch event.keyCode {
        case 123: reduce("STEP_BACK") // Left
        case 124: reduce("STEP_FWD") // Right
        case 49: // Space
            if state == .playing { reduce("PAUSE"); onPause?() }
            else { reduce("PLAY") }
        default: super.keyDown(with: event)
        }
    }

    // MARK: - Cleanup

    deinit { playTimer?.invalidate() }
}
