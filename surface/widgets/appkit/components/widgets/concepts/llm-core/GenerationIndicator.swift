import AppKit

class GenerationIndicatorView: NSView {

    enum State: String { case idle; case generating; case complete; case error }

    private(set) var state: State = .idle
    private var model: String = ""
    private var tokenCount: Int = 0
    private var elapsedMs: Int = 0
    private var errorMessage: String? = nil
    private var spinnerTimer: Timer?

    var onCancel: (() -> Void)?

    private let rootStack = NSStackView()
    private let spinner = NSProgressIndicator()
    private let statusLabel = NSTextField(labelWithString: "Idle")
    private let modelBadge = NSTextField(labelWithString: "")
    private let tokenLabel = NSTextField(labelWithString: "")
    private let elapsedLabel = NSTextField(labelWithString: "")
    private let errorLabel = NSTextField(wrappingLabelWithString: "")

    // MARK: - State machine

    func reduce(_ event: String) {
        switch state {
        case .idle:
            if event == "START" { state = .generating; startSpinner() }
        case .generating:
            if event == "COMPLETE" { state = .complete; stopSpinner() }
            if event == "ERROR" { state = .error; stopSpinner() }
            if event == "CANCEL" { state = .idle; stopSpinner(); onCancel?() }
            if event == "TOKEN" { tokenCount += 1 }
        case .complete:
            if event == "RESET" { state = .idle; tokenCount = 0; elapsedMs = 0 }
        case .error:
            if event == "RETRY" { state = .generating; startSpinner() }
            if event == "RESET" { state = .idle; tokenCount = 0; elapsedMs = 0; errorMessage = nil }
        }
        updateUI()
    }

    // MARK: - Init

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Status indicator for LLM generation in progress")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    // MARK: - Setup

    private func setupSubviews() {
        wantsLayer = true

        rootStack.orientation = .horizontal
        rootStack.spacing = 8
        rootStack.alignment = .centerY
        rootStack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(rootStack)
        NSLayoutConstraint.activate([
            rootStack.topAnchor.constraint(equalTo: topAnchor, constant: 6),
            rootStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
            rootStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
            rootStack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -6),
        ])

        spinner.style = .spinning
        spinner.controlSize = .small
        spinner.isHidden = true
        rootStack.addArrangedSubview(spinner)

        statusLabel.font = .systemFont(ofSize: 12, weight: .medium)
        rootStack.addArrangedSubview(statusLabel)

        modelBadge.font = .systemFont(ofSize: 10)
        modelBadge.textColor = .secondaryLabelColor
        rootStack.addArrangedSubview(modelBadge)

        tokenLabel.font = .monospacedDigitSystemFont(ofSize: 11, weight: .regular)
        tokenLabel.textColor = .tertiaryLabelColor
        rootStack.addArrangedSubview(tokenLabel)

        elapsedLabel.font = .monospacedDigitSystemFont(ofSize: 11, weight: .regular)
        elapsedLabel.textColor = .tertiaryLabelColor
        rootStack.addArrangedSubview(elapsedLabel)

        errorLabel.font = .systemFont(ofSize: 11)
        errorLabel.textColor = .systemRed
        errorLabel.isHidden = true
        rootStack.addArrangedSubview(errorLabel)

        updateUI()
    }

    // MARK: - Configure

    func configure(model: String, tokenCount: Int = 0, elapsedMs: Int = 0, error: String? = nil) {
        self.model = model
        self.tokenCount = tokenCount
        self.elapsedMs = elapsedMs
        self.errorMessage = error
        updateUI()
    }

    private func startSpinner() {
        spinner.isHidden = false
        spinner.startAnimation(nil)
    }

    private func stopSpinner() {
        spinner.stopAnimation(nil)
        spinner.isHidden = true
    }

    private func updateUI() {
        switch state {
        case .idle:
            statusLabel.stringValue = "Idle"
            statusLabel.textColor = .secondaryLabelColor
        case .generating:
            statusLabel.stringValue = "Generating..."
            statusLabel.textColor = .systemBlue
        case .complete:
            statusLabel.stringValue = "Complete"
            statusLabel.textColor = .systemGreen
        case .error:
            statusLabel.stringValue = "Error"
            statusLabel.textColor = .systemRed
        }

        modelBadge.stringValue = model
        tokenLabel.stringValue = tokenCount > 0 ? "\(tokenCount) tokens" : ""
        elapsedLabel.stringValue = elapsedMs > 0 ? "\(elapsedMs)ms" : ""
        errorLabel.stringValue = errorMessage ?? ""
        errorLabel.isHidden = errorMessage == nil

        setAccessibilityValue("\(state.rawValue), \(model), \(tokenCount) tokens")
    }

    // MARK: - Keyboard

    override var acceptsFirstResponder: Bool { true }

    deinit { spinnerTimer?.invalidate() }
}
