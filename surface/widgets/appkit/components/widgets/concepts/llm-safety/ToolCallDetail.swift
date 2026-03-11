import AppKit

class ToolCallDetailView: NSView {

    enum State: String { case idle; case retrying }

    private(set) var state: State = .idle
    private var toolName: String = ""
    private var status: String = ""
    private var arguments: String = ""
    private var result: String = ""
    private var durationMs: Int? = nil
    private var tokens: Int? = nil
    private var errorMessage: String? = nil

    var onRetry: (() -> Void)?

    private let rootStack = NSStackView()
    private let headerRow = NSStackView()
    private let toolNameLabel = NSTextField(labelWithString: "")
    private let statusBadge = NSTextField(labelWithString: "")
    private let argumentsLabel = NSTextField(labelWithString: "Arguments")
    private let argumentsContent = NSTextField(wrappingLabelWithString: "")
    private let resultLabel = NSTextField(labelWithString: "Result")
    private let resultContent = NSTextField(wrappingLabelWithString: "")
    private let timingLabel = NSTextField(labelWithString: "")
    private let tokenBadge = NSTextField(labelWithString: "")
    private let errorPanel = NSTextField(wrappingLabelWithString: "")
    private let retryBtn = NSButton(title: "Retry", target: nil, action: nil)

    // MARK: - State machine

    func reduce(_ event: String) {
        switch state {
        case .idle:
            if event == "RETRY" { state = .retrying; onRetry?() }
        case .retrying:
            if event == "RETRY_COMPLETE" { state = .idle }
            if event == "RETRY_ERROR" { state = .idle }
        }
        updateUI()
    }

    // MARK: - Init

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Detailed view of a single tool call with arguments and results")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    // MARK: - Setup

    private func setupSubviews() {
        wantsLayer = true
        layer?.cornerRadius = 6
        layer?.borderWidth = 1
        layer?.borderColor = NSColor.separatorColor.cgColor

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

        headerRow.orientation = .horizontal
        headerRow.spacing = 8
        toolNameLabel.font = .boldSystemFont(ofSize: 14)
        statusBadge.font = .boldSystemFont(ofSize: 11)
        headerRow.addArrangedSubview(toolNameLabel)
        headerRow.addArrangedSubview(statusBadge)
        rootStack.addArrangedSubview(headerRow)

        argumentsLabel.font = .boldSystemFont(ofSize: 11); argumentsLabel.textColor = .secondaryLabelColor
        argumentsContent.font = .monospacedSystemFont(ofSize: 11, weight: .regular)
        rootStack.addArrangedSubview(argumentsLabel)
        rootStack.addArrangedSubview(argumentsContent)

        resultLabel.font = .boldSystemFont(ofSize: 11); resultLabel.textColor = .secondaryLabelColor
        resultContent.font = .monospacedSystemFont(ofSize: 11, weight: .regular)
        rootStack.addArrangedSubview(resultLabel)
        rootStack.addArrangedSubview(resultContent)

        let metaRow = NSStackView()
        metaRow.orientation = .horizontal
        metaRow.spacing = 12
        timingLabel.font = .monospacedDigitSystemFont(ofSize: 11, weight: .regular)
        timingLabel.textColor = .tertiaryLabelColor
        tokenBadge.font = .systemFont(ofSize: 11)
        tokenBadge.textColor = .tertiaryLabelColor
        metaRow.addArrangedSubview(timingLabel)
        metaRow.addArrangedSubview(tokenBadge)
        rootStack.addArrangedSubview(metaRow)

        errorPanel.font = .systemFont(ofSize: 12)
        errorPanel.textColor = .systemRed
        errorPanel.isHidden = true
        rootStack.addArrangedSubview(errorPanel)

        retryBtn.bezelStyle = .roundRect
        retryBtn.target = self
        retryBtn.action = #selector(handleRetry(_:))
        retryBtn.setAccessibilityLabel("Retry tool call")
        retryBtn.isHidden = true
        rootStack.addArrangedSubview(retryBtn)

        updateUI()
    }

    // MARK: - Configure

    func configure(toolName: String, status: String, arguments: String, result: String = "", durationMs: Int? = nil, tokens: Int? = nil, error: String? = nil) {
        self.toolName = toolName
        self.status = status
        self.arguments = arguments
        self.result = result
        self.durationMs = durationMs
        self.tokens = tokens
        self.errorMessage = error
        updateUI()
    }

    private func updateUI() {
        toolNameLabel.stringValue = toolName
        statusBadge.stringValue = status
        switch status {
        case "success": statusBadge.textColor = .systemGreen
        case "error", "failed": statusBadge.textColor = .systemRed
        case "running": statusBadge.textColor = .systemBlue
        default: statusBadge.textColor = .secondaryLabelColor
        }

        argumentsContent.stringValue = arguments
        resultContent.stringValue = result
        timingLabel.stringValue = durationMs != nil ? "\(durationMs!)ms" : ""
        tokenBadge.stringValue = tokens != nil ? "\(tokens!) tokens" : ""

        errorPanel.stringValue = errorMessage ?? ""
        errorPanel.isHidden = errorMessage == nil
        retryBtn.isHidden = errorMessage == nil || state == .retrying

        setAccessibilityValue("\(toolName), \(status), \(state.rawValue)")
    }

    // MARK: - Actions

    @objc private func handleRetry(_ sender: NSButton) { reduce("RETRY") }

    override var acceptsFirstResponder: Bool { true }
    deinit {}
}
