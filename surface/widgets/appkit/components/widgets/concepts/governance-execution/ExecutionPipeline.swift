import AppKit

class ExecutionPipelineView: NSView {

    enum State: String { case idle; case stageSelected; case failed }
    enum StageStatus: String { case pending; case active; case complete; case failed; case skipped }

    struct Stage {
        let id: String
        let name: String
        let status: StageStatus
        let description: String?
        let isTimelock: Bool
    }

    private(set) var state: State = .idle
    private var stages: [Stage] = []
    private var selectedStageId: String? = nil
    private var focusIndex: Int = 0
    private var trackingArea: NSTrackingArea?

    var onStageSelect: ((String) -> Void)?
    var onRetry: (() -> Void)?
    var onReset: (() -> Void)?

    private let rootStack = NSStackView()
    private let pipelineStack = NSStackView()
    private let detailPanel = NSStackView()
    private let detailTitleLabel = NSTextField(labelWithString: "")
    private let detailDescLabel = NSTextField(wrappingLabelWithString: "")
    private let detailStatusLabel = NSTextField(labelWithString: "")
    private let actionBar = NSStackView()

    // MARK: - State machine

    func reduce(_ event: String, stageId: String? = nil) {
        switch state {
        case .idle:
            if event == "ADVANCE" { /* stay idle */ }
            if event == "SELECT_STAGE", let id = stageId { state = .stageSelected; selectedStageId = id; onStageSelect?(id) }
            if event == "FAIL" { state = .failed }
        case .stageSelected:
            if event == "DESELECT" { state = .idle; selectedStageId = nil }
        case .failed:
            if event == "RETRY" { state = .idle; onRetry?() }
            if event == "RESET" { state = .idle; onReset?() }
        }
        updateUI()
    }

    // MARK: - Init

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Horizontal pipeline visualization showing governance execution stages")
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

        // Pipeline (horizontal stage row)
        pipelineStack.orientation = .horizontal
        pipelineStack.spacing = 4
        pipelineStack.setAccessibilityRole(.list)
        pipelineStack.setAccessibilityLabel("Execution stages")
        rootStack.addArrangedSubview(pipelineStack)

        // Detail panel
        detailPanel.orientation = .vertical
        detailPanel.spacing = 4
        detailPanel.isHidden = true
        detailTitleLabel.font = .boldSystemFont(ofSize: 14)
        detailDescLabel.font = .systemFont(ofSize: 12)
        detailDescLabel.textColor = .secondaryLabelColor
        detailStatusLabel.font = .systemFont(ofSize: 12)
        detailPanel.addArrangedSubview(detailTitleLabel)
        detailPanel.addArrangedSubview(detailDescLabel)
        detailPanel.addArrangedSubview(detailStatusLabel)
        rootStack.addArrangedSubview(detailPanel)

        // Action bar (retry/reset for failed state)
        actionBar.orientation = .horizontal
        actionBar.spacing = 8
        actionBar.isHidden = true
        let retryBtn = NSButton(title: "Retry", target: self, action: #selector(handleRetry(_:)))
        retryBtn.bezelStyle = .roundRect
        retryBtn.setAccessibilityLabel("Retry failed stage")
        let resetBtn = NSButton(title: "Reset", target: self, action: #selector(handleReset(_:)))
        resetBtn.bezelStyle = .roundRect
        resetBtn.setAccessibilityLabel("Reset pipeline")
        actionBar.addArrangedSubview(retryBtn)
        actionBar.addArrangedSubview(resetBtn)
        rootStack.addArrangedSubview(actionBar)

        updateUI()
    }

    // MARK: - Configure

    func configure(stages: [Stage]) {
        self.stages = stages
        rebuildPipeline()
        updateUI()
    }

    private func rebuildPipeline() {
        pipelineStack.arrangedSubviews.forEach { $0.removeFromSuperview() }

        for (i, stage) in stages.enumerated() {
            // Stage button
            let stageBtn = NSButton(title: stageIcon(stage.status) + " " + stage.name, target: self, action: #selector(handleStageClick(_:)))
            stageBtn.bezelStyle = .roundRect
            stageBtn.tag = i
            stageBtn.setAccessibilityLabel("\(stage.name): \(stage.status.rawValue)")

            switch stage.status {
            case .complete: stageBtn.contentTintColor = .systemGreen
            case .active: stageBtn.contentTintColor = .systemBlue
            case .failed: stageBtn.contentTintColor = .systemRed
            case .skipped: stageBtn.contentTintColor = .secondaryLabelColor
            case .pending: stageBtn.contentTintColor = .tertiaryLabelColor
            }

            pipelineStack.addArrangedSubview(stageBtn)

            // Connector between stages
            if i < stages.count - 1 {
                let connector = NSTextField(labelWithString: "\u{2192}")
                connector.font = .systemFont(ofSize: 14)
                connector.textColor = .tertiaryLabelColor
                pipelineStack.addArrangedSubview(connector)
            }
        }
    }

    private func stageIcon(_ status: StageStatus) -> String {
        switch status {
        case .complete: return "\u{2713}"
        case .active: return "\u{25CF}"
        case .failed: return "\u{2717}"
        case .skipped: return "\u{2014}"
        case .pending: return "\u{25CB}"
        }
    }

    private func updateUI() {
        // Detail panel
        if state == .stageSelected, let id = selectedStageId, let stage = stages.first(where: { $0.id == id }) {
            detailPanel.isHidden = false
            detailTitleLabel.stringValue = stage.name
            detailDescLabel.stringValue = stage.description ?? ""
            detailStatusLabel.stringValue = "Status: \(stage.status.rawValue)"
        } else {
            detailPanel.isHidden = true
        }

        // Action bar
        actionBar.isHidden = state != .failed

        setAccessibilityValue("Pipeline \(state.rawValue), \(stages.count) stages")
    }

    // MARK: - Actions

    @objc private func handleStageClick(_ sender: NSButton) {
        let idx = sender.tag
        guard idx < stages.count else { return }
        reduce("SELECT_STAGE", stageId: stages[idx].id)
    }

    @objc private func handleRetry(_ sender: NSButton) { reduce("RETRY") }
    @objc private func handleReset(_ sender: NSButton) { reduce("RESET") }

    // MARK: - Keyboard

    override var acceptsFirstResponder: Bool { true }

    override func keyDown(with event: NSEvent) {
        switch event.keyCode {
        case 124: // Right
            focusIndex = min(focusIndex + 1, stages.count - 1)
            if focusIndex < stages.count { reduce("SELECT_STAGE", stageId: stages[focusIndex].id) }
        case 123: // Left
            focusIndex = max(focusIndex - 1, 0)
            if focusIndex < stages.count { reduce("SELECT_STAGE", stageId: stages[focusIndex].id) }
        case 53: // Escape
            reduce("DESELECT")
        default: super.keyDown(with: event)
        }
    }

    // MARK: - Cleanup

    deinit {}
}
