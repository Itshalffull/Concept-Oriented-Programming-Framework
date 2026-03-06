import AppKit

class ExecutionMetricsPanelView: NSView {

    enum State: String { case idle; case updating }

    private(set) var state: State = .idle
    private var stepCount: Int = 0
    private var totalTokens: Int = 0
    private var maxTokens: Int = 100000
    private var cost: Double = 0
    private var latencyMs: Int = 0
    private var errorRate: Double = 0

    private let rootStack = NSStackView()
    private let stepCounterLabel = NSTextField(labelWithString: "")
    private let tokenGauge = NSProgressIndicator()
    private let tokenLabel = NSTextField(labelWithString: "")
    private let costLabel = NSTextField(labelWithString: "")
    private let latencyLabel = NSTextField(labelWithString: "")
    private let errorRateLabel = NSTextField(labelWithString: "")

    // MARK: - State machine

    func reduce(_ event: String) {
        switch state {
        case .idle:
            if event == "UPDATE" { state = .updating }
        case .updating:
            if event == "UPDATE_COMPLETE" { state = .idle }
        }
        updateUI()
    }

    // MARK: - Init

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Dashboard panel displaying LLM execution metrics")
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

        stepCounterLabel.font = .boldSystemFont(ofSize: 14)
        rootStack.addArrangedSubview(stepCounterLabel)

        let tokenRow = NSStackView()
        tokenRow.orientation = .horizontal
        tokenRow.spacing = 8
        tokenGauge.style = .bar
        tokenGauge.minValue = 0
        tokenGauge.maxValue = 100
        tokenGauge.setAccessibilityLabel("Token usage")
        tokenLabel.font = .monospacedDigitSystemFont(ofSize: 12, weight: .regular)
        tokenRow.addArrangedSubview(tokenGauge)
        tokenRow.addArrangedSubview(tokenLabel)
        rootStack.addArrangedSubview(tokenRow)

        costLabel.font = .monospacedDigitSystemFont(ofSize: 13, weight: .medium)
        rootStack.addArrangedSubview(costLabel)

        latencyLabel.font = .monospacedDigitSystemFont(ofSize: 12, weight: .regular)
        latencyLabel.textColor = .secondaryLabelColor
        rootStack.addArrangedSubview(latencyLabel)

        errorRateLabel.font = .systemFont(ofSize: 12)
        rootStack.addArrangedSubview(errorRateLabel)

        updateUI()
    }

    // MARK: - Configure

    func configure(steps: Int, tokens: Int, maxTokens: Int = 100000, cost: Double, latencyMs: Int, errorRate: Double) {
        self.stepCount = steps
        self.totalTokens = tokens
        self.maxTokens = maxTokens
        self.cost = cost
        self.latencyMs = latencyMs
        self.errorRate = errorRate
        reduce("UPDATE")
        updateUI()
        reduce("UPDATE_COMPLETE")
    }

    private func updateUI() {
        stepCounterLabel.stringValue = "Steps: \(stepCount)"
        let tokenPct = maxTokens > 0 ? Double(totalTokens) / Double(maxTokens) * 100 : 0
        tokenGauge.doubleValue = tokenPct
        tokenLabel.stringValue = "\(totalTokens)/\(maxTokens) tokens"
        costLabel.stringValue = String(format: "Cost: $%.4f", cost)
        latencyLabel.stringValue = "Latency: \(latencyMs)ms"
        errorRateLabel.stringValue = String(format: "Error Rate: %.1f%%", errorRate * 100)
        errorRateLabel.textColor = errorRate > 0.1 ? .systemRed : errorRate > 0.05 ? .systemOrange : .systemGreen

        setAccessibilityValue("\(stepCount) steps, \(totalTokens) tokens, \(state.rawValue)")
    }

    override var acceptsFirstResponder: Bool { true }
    deinit {}
}
