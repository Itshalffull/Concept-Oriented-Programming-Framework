import AppKit

class TraceTimelineViewerView: NSView {

    enum State: String { case idle; case playing; case cellSelected }

    private(set) var state: State = .idle
    private var steps: [[String: String]] = []
    private var stepLabels: [String] = []
    private var stepErrors: [Bool] = []
    private var variables: [String] = []
    private var activeStep: Int = 0
    private var focusedLane: Int = 0
    private var selectedCell: (step: Int, variable: String)? = nil
    private var playbackSpeed: Double = 1.0
    private var showChangesOnly: Bool = false
    private var playTimer: Timer?
    private var trackingArea: NSTrackingArea?

    var onStepChange: ((Int) -> Void)?

    private let rootStack = NSStackView()
    private let timeAxisStack = NSStackView()
    private let lanesScroll = NSScrollView()
    private let lanesContainer = NSStackView()
    private let controlsStack = NSStackView()
    private let stepCounterLabel = NSTextField(labelWithString: "0 / 0")
    private let detailPanel = NSStackView()
    private let detailTitleLabel = NSTextField(labelWithString: "")
    private let detailTimestampLabel = NSTextField(labelWithString: "")
    private let detailStateContainer = NSStackView()

    // MARK: - State machine

    func reduce(_ event: String) {
        switch state {
        case .idle:
            if event == "PLAY" { state = .playing; startPlayback() }
            if event == "STEP_FORWARD" { advanceStep(1) }
            if event == "STEP_BACKWARD" { advanceStep(-1) }
            if event == "SELECT_CELL" { state = .cellSelected }
            if event == "ZOOM" { /* handled externally */ }
        case .playing:
            if event == "PAUSE" { state = .idle; stopPlayback() }
            if event == "STEP_END" { state = .idle; stopPlayback() }
        case .cellSelected:
            if event == "DESELECT" { state = .idle; selectedCell = nil }
            if event == "SELECT_CELL" { state = .cellSelected }
        }
        updateUI()
    }

    // MARK: - Init

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Trace timeline grid for navigating verification trace steps")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    // MARK: - Setup

    private func setupSubviews() {
        wantsLayer = true

        rootStack.orientation = .vertical
        rootStack.spacing = 6
        rootStack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(rootStack)
        NSLayoutConstraint.activate([
            rootStack.topAnchor.constraint(equalTo: topAnchor, constant: 8),
            rootStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
            rootStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
            rootStack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -8),
        ])

        // Time axis
        timeAxisStack.orientation = .horizontal
        timeAxisStack.spacing = 2
        timeAxisStack.setAccessibilityRole(.group)
        timeAxisStack.setAccessibilityLabel("Step headers")
        rootStack.addArrangedSubview(timeAxisStack)

        // Lanes scroll view
        lanesScroll.hasVerticalScroller = true
        lanesScroll.hasHorizontalScroller = true
        lanesScroll.drawsBackground = false
        lanesContainer.orientation = .vertical
        lanesContainer.spacing = 2
        lanesScroll.documentView = lanesContainer
        rootStack.addArrangedSubview(lanesScroll)

        // Playback controls
        controlsStack.orientation = .horizontal
        controlsStack.spacing = 6

        let stepBackBtn = NSButton(title: "\u{25C4}", target: self, action: #selector(handleStepBack(_:)))
        stepBackBtn.bezelStyle = .roundRect
        stepBackBtn.setAccessibilityLabel("Step backward")
        controlsStack.addArrangedSubview(stepBackBtn)

        let playPauseBtn = NSButton(title: "\u{25B6}", target: self, action: #selector(handlePlayPause(_:)))
        playPauseBtn.bezelStyle = .roundRect
        playPauseBtn.tag = 100
        playPauseBtn.setAccessibilityLabel("Play")
        controlsStack.addArrangedSubview(playPauseBtn)

        let stepFwdBtn = NSButton(title: "\u{25BA}", target: self, action: #selector(handleStepFwd(_:)))
        stepFwdBtn.bezelStyle = .roundRect
        stepFwdBtn.setAccessibilityLabel("Step forward")
        controlsStack.addArrangedSubview(stepFwdBtn)

        stepCounterLabel.font = .monospacedDigitSystemFont(ofSize: 12, weight: .regular)
        stepCounterLabel.setAccessibilityRole(.staticText)
        controlsStack.addArrangedSubview(stepCounterLabel)

        rootStack.addArrangedSubview(controlsStack)

        // Detail panel (hidden initially)
        detailPanel.orientation = .vertical
        detailPanel.spacing = 4
        detailPanel.isHidden = true
        detailTitleLabel.font = .boldSystemFont(ofSize: 13)
        detailTimestampLabel.font = .systemFont(ofSize: 11)
        detailTimestampLabel.textColor = .secondaryLabelColor
        detailStateContainer.orientation = .vertical
        detailStateContainer.spacing = 2
        detailPanel.addArrangedSubview(detailTitleLabel)
        detailPanel.addArrangedSubview(detailTimestampLabel)
        detailPanel.addArrangedSubview(detailStateContainer)
        rootStack.addArrangedSubview(detailPanel)

        updateUI()
    }

    // MARK: - Configure

    func configure(steps: [[String: String]], labels: [String], errors: [Bool], variables: [String]? = nil, currentStep: Int = 0, speed: Double = 1.0, changesOnly: Bool = false) {
        self.steps = steps
        self.stepLabels = labels
        self.stepErrors = errors
        self.playbackSpeed = speed
        self.showChangesOnly = changesOnly
        self.activeStep = min(currentStep, max(0, steps.count - 1))

        if let vars = variables {
            self.variables = vars
        } else {
            var keys = Set<String>()
            for step in steps { for k in step.keys { keys.insert(k) } }
            self.variables = keys.sorted()
        }

        rebuildGrid()
        updateUI()
    }

    private func rebuildGrid() {
        timeAxisStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
        lanesContainer.arrangedSubviews.forEach { $0.removeFromSuperview() }

        // Corner cell
        let corner = NSTextField(labelWithString: "")
        corner.widthAnchor.constraint(equalToConstant: 80).isActive = true
        timeAxisStack.addArrangedSubview(corner)

        // Step headers
        for i in 0..<steps.count {
            let lbl = NSTextField(labelWithString: "\(i)")
            lbl.font = .monospacedDigitSystemFont(ofSize: 11, weight: .regular)
            lbl.alignment = .center
            lbl.widthAnchor.constraint(equalToConstant: 60).isActive = true
            if i < stepErrors.count && stepErrors[i] {
                lbl.textColor = .systemRed
            }
            lbl.setAccessibilityLabel("Step \(i)\(i < stepErrors.count && stepErrors[i] ? " (error)" : "")")
            timeAxisStack.addArrangedSubview(lbl)
        }

        // Variable lanes
        for (laneIdx, variable) in variables.enumerated() {
            let laneStack = NSStackView()
            laneStack.orientation = .horizontal
            laneStack.spacing = 2
            laneStack.tag = laneIdx

            let laneLabel = NSTextField(labelWithString: variable)
            laneLabel.font = .systemFont(ofSize: 12, weight: .medium)
            laneLabel.widthAnchor.constraint(equalToConstant: 80).isActive = true
            laneStack.addArrangedSubview(laneLabel)

            for stepIdx in 0..<steps.count {
                let value = steps[stepIdx][variable] ?? ""
                let changed = didValueChange(stepIdx, variable: variable)

                if showChangesOnly && !changed && stepIdx != 0 {
                    let spacer = NSView()
                    spacer.widthAnchor.constraint(equalToConstant: 60).isActive = true
                    laneStack.addArrangedSubview(spacer)
                    continue
                }

                let cellBtn = NSButton(title: value, target: self, action: #selector(handleCellClick(_:)))
                cellBtn.bezelStyle = .roundRect
                cellBtn.widthAnchor.constraint(equalToConstant: 60).isActive = true
                cellBtn.tag = laneIdx * 10000 + stepIdx
                cellBtn.font = changed ? .boldSystemFont(ofSize: 11) : .systemFont(ofSize: 11)
                cellBtn.setAccessibilityLabel("\(variable) at step \(stepIdx): \(value)")

                if stepIdx < stepErrors.count && stepErrors[stepIdx] {
                    cellBtn.contentTintColor = .systemRed
                }

                laneStack.addArrangedSubview(cellBtn)
            }

            lanesContainer.addArrangedSubview(laneStack)
        }
    }

    private func didValueChange(_ stepIdx: Int, variable: String) -> Bool {
        guard stepIdx > 0 else { return false }
        let prev = steps[stepIdx - 1][variable]
        let curr = steps[stepIdx][variable]
        return prev != curr
    }

    private func advanceStep(_ delta: Int) {
        let newStep = max(0, min(activeStep + delta, steps.count - 1))
        guard newStep != activeStep else { return }
        activeStep = newStep
        onStepChange?(activeStep)
    }

    private func updateUI() {
        let total = steps.count
        stepCounterLabel.stringValue = total > 0 ? "\(activeStep + 1) / \(total)" : "0 / 0"

        // Update play/pause button
        for view in controlsStack.arrangedSubviews {
            guard let btn = view as? NSButton, btn.tag == 100 else { continue }
            btn.title = state == .playing ? "\u{23F8}" : "\u{25B6}"
            btn.setAccessibilityLabel(state == .playing ? "Pause" : "Play")
        }

        // Detail panel
        detailPanel.isHidden = state != .cellSelected
        if state == .cellSelected, activeStep < steps.count {
            let label = activeStep < stepLabels.count ? stepLabels[activeStep] : ""
            let isError = activeStep < stepErrors.count && stepErrors[activeStep]
            detailTitleLabel.stringValue = "Step \(activeStep): \(label)\(isError ? " (error)" : "")"
            detailTitleLabel.textColor = isError ? .systemRed : .labelColor

            detailStateContainer.arrangedSubviews.forEach { $0.removeFromSuperview() }
            for (key, value) in steps[activeStep] {
                let changed = didValueChange(activeStep, variable: key)
                let entry = NSTextField(labelWithString: "\(key): \(value)")
                entry.font = changed ? .boldSystemFont(ofSize: 12) : .systemFont(ofSize: 12)
                detailStateContainer.addArrangedSubview(entry)
            }
        }

        setAccessibilityValue("Step \(activeStep + 1) of \(steps.count), \(state.rawValue)")

        // Auto-stop at end
        if state == .playing && activeStep >= steps.count - 1 {
            reduce("STEP_END")
        }
    }

    // MARK: - Playback

    private func startPlayback() {
        stopPlayback()
        let interval = max(0.1, 1.0 / playbackSpeed)
        playTimer = Timer.scheduledTimer(withTimeInterval: interval, repeats: true) { [weak self] _ in
            guard let self = self else { return }
            if self.activeStep >= self.steps.count - 1 {
                self.reduce("STEP_END")
            } else {
                self.activeStep += 1
                self.onStepChange?(self.activeStep)
                self.updateUI()
            }
        }
    }

    private func stopPlayback() {
        playTimer?.invalidate()
        playTimer = nil
    }

    // MARK: - Actions

    @objc private func handleStepBack(_ sender: NSButton) { reduce("STEP_BACKWARD") }
    @objc private func handleStepFwd(_ sender: NSButton) { reduce("STEP_FORWARD") }
    @objc private func handlePlayPause(_ sender: NSButton) {
        if state == .playing { reduce("PAUSE") } else { reduce("PLAY") }
    }
    @objc private func handleCellClick(_ sender: NSButton) {
        let laneIdx = sender.tag / 10000
        let stepIdx = sender.tag % 10000
        if laneIdx < variables.count {
            selectedCell = (step: stepIdx, variable: variables[laneIdx])
            activeStep = stepIdx
            onStepChange?(stepIdx)
            reduce("SELECT_CELL")
        }
    }

    // MARK: - Keyboard

    override var acceptsFirstResponder: Bool { true }

    override func keyDown(with event: NSEvent) {
        switch event.keyCode {
        case 124: reduce("STEP_FORWARD")    // Right
        case 123: reduce("STEP_BACKWARD")   // Left
        case 126:                             // Up
            focusedLane = max(0, focusedLane - 1)
        case 125:                             // Down
            focusedLane = min(variables.count - 1, focusedLane + 1)
        case 49:                              // Space
            if state == .playing { reduce("PAUSE") } else { reduce("PLAY") }
        case 36:                              // Enter
            if focusedLane < variables.count {
                selectedCell = (step: activeStep, variable: variables[focusedLane])
                reduce("SELECT_CELL")
            }
        case 53: reduce("DESELECT")          // Escape
        default: super.keyDown(with: event)
        }
    }

    // MARK: - Mouse tracking

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        if let area = trackingArea { removeTrackingArea(area) }
        trackingArea = NSTrackingArea(rect: bounds, options: [.mouseEnteredAndExited, .activeInKeyWindow], owner: self, userInfo: nil)
        addTrackingArea(trackingArea!)
    }

    // MARK: - Cleanup

    deinit { playTimer?.invalidate() }
}
