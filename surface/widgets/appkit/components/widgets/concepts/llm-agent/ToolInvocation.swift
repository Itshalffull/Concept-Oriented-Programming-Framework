import AppKit

class ToolInvocationView: NSView {

    enum ViewState: String { case collapsed; case hoveredCollapsed; case expanded }
    enum ExecState: String { case pending; case running; case succeeded; case failed }

    private(set) var viewState: ViewState = .collapsed
    private(set) var execState: ExecState = .pending
    private var toolName: String = ""
    private var arguments: String = ""
    private var result: String = ""
    private var durationMs: Int? = nil
    private var warningMessage: String? = nil
    private var trackingArea: NSTrackingArea?

    var onRetry: (() -> Void)?
    var onToggle: ((Bool) -> Void)?

    private let rootStack = NSStackView()
    private let headerRow = NSStackView()
    private let toolIcon = NSTextField(labelWithString: "\u{1F527}")
    private let toolNameLabel = NSTextField(labelWithString: "")
    private let statusIcon = NSTextField(labelWithString: "")
    private let durationLabel = NSTextField(labelWithString: "")
    private let bodyStack = NSStackView()
    private let argumentsLabel = NSTextField(labelWithString: "Arguments")
    private let argumentsContent = NSTextField(wrappingLabelWithString: "")
    private let resultLabel = NSTextField(labelWithString: "Result")
    private let resultContent = NSTextField(wrappingLabelWithString: "")
    private let warningBadge = NSTextField(labelWithString: "")
    private let retryBtn = NSButton(title: "Retry", target: nil, action: nil)

    // MARK: - State machines

    func reduceView(_ event: String) {
        switch viewState {
        case .collapsed:
            if event == "HOVER" { viewState = .hoveredCollapsed }
            if event == "TOGGLE" { viewState = .expanded; onToggle?(true) }
        case .hoveredCollapsed:
            if event == "LEAVE" { viewState = .collapsed }
            if event == "TOGGLE" { viewState = .expanded; onToggle?(true) }
        case .expanded:
            if event == "TOGGLE" { viewState = .collapsed; onToggle?(false) }
        }
        updateUI()
    }

    func reduceExec(_ event: String) {
        switch execState {
        case .pending:
            if event == "START" { execState = .running }
        case .running:
            if event == "SUCCEED" { execState = .succeeded }
            if event == "FAIL" { execState = .failed }
        case .succeeded:
            break
        case .failed:
            if event == "RETRY" { execState = .pending; onRetry?() }
        }
        updateUI()
    }

    // MARK: - Init

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Collapsible card displaying an LLM tool invocation")
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

        // Header
        headerRow.orientation = .horizontal
        headerRow.spacing = 6
        toolIcon.font = .systemFont(ofSize: 14)
        toolNameLabel.font = .boldSystemFont(ofSize: 13)
        statusIcon.font = .systemFont(ofSize: 12)
        durationLabel.font = .monospacedDigitSystemFont(ofSize: 11, weight: .regular)
        durationLabel.textColor = .tertiaryLabelColor
        headerRow.addArrangedSubview(toolIcon)
        headerRow.addArrangedSubview(toolNameLabel)
        headerRow.addArrangedSubview(statusIcon)
        headerRow.addArrangedSubview(durationLabel)

        let clickGesture = NSClickGestureRecognizer(target: self, action: #selector(handleToggle(_:)))
        headerRow.addGestureRecognizer(clickGesture)
        rootStack.addArrangedSubview(headerRow)

        // Body (hidden when collapsed)
        bodyStack.orientation = .vertical
        bodyStack.spacing = 4
        bodyStack.isHidden = true

        argumentsLabel.font = .boldSystemFont(ofSize: 11)
        argumentsLabel.textColor = .secondaryLabelColor
        argumentsContent.font = .monospacedSystemFont(ofSize: 11, weight: .regular)
        resultLabel.font = .boldSystemFont(ofSize: 11)
        resultLabel.textColor = .secondaryLabelColor
        resultContent.font = .monospacedSystemFont(ofSize: 11, weight: .regular)

        warningBadge.font = .boldSystemFont(ofSize: 11)
        warningBadge.textColor = .systemOrange
        warningBadge.isHidden = true

        retryBtn.bezelStyle = .roundRect
        retryBtn.target = self
        retryBtn.action = #selector(handleRetry(_:))
        retryBtn.setAccessibilityLabel("Retry tool invocation")
        retryBtn.isHidden = true

        bodyStack.addArrangedSubview(argumentsLabel)
        bodyStack.addArrangedSubview(argumentsContent)
        bodyStack.addArrangedSubview(resultLabel)
        bodyStack.addArrangedSubview(resultContent)
        bodyStack.addArrangedSubview(warningBadge)
        bodyStack.addArrangedSubview(retryBtn)
        rootStack.addArrangedSubview(bodyStack)

        updateUI()
    }

    // MARK: - Configure

    func configure(toolName: String, arguments: String, result: String = "", durationMs: Int? = nil, warning: String? = nil, execState: ExecState = .pending) {
        self.toolName = toolName
        self.arguments = arguments
        self.result = result
        self.durationMs = durationMs
        self.warningMessage = warning
        self.execState = execState
        toolNameLabel.stringValue = toolName
        argumentsContent.stringValue = arguments
        resultContent.stringValue = result
        updateUI()
    }

    private func updateUI() {
        let isOpen = viewState == .expanded
        bodyStack.isHidden = !isOpen

        // Status icon
        switch execState {
        case .pending: statusIcon.stringValue = "\u{25CB}"; statusIcon.textColor = .tertiaryLabelColor
        case .running: statusIcon.stringValue = "\u{25CF}"; statusIcon.textColor = .systemBlue
        case .succeeded: statusIcon.stringValue = "\u{2713}"; statusIcon.textColor = .systemGreen
        case .failed: statusIcon.stringValue = "\u{2717}"; statusIcon.textColor = .systemRed
        }

        // Duration
        if let ms = durationMs {
            durationLabel.stringValue = "\(ms)ms"
            durationLabel.isHidden = false
        } else {
            durationLabel.isHidden = true
        }

        // Warning
        warningBadge.isHidden = warningMessage == nil
        warningBadge.stringValue = warningMessage ?? ""

        // Retry button
        retryBtn.isHidden = execState != .failed

        // Hover highlight
        if viewState == .hoveredCollapsed {
            layer?.backgroundColor = NSColor.controlBackgroundColor.withAlphaComponent(0.5).cgColor
        } else {
            layer?.backgroundColor = NSColor.clear.cgColor
        }

        setAccessibilityValue("\(toolName), \(execState.rawValue), \(viewState.rawValue)")
    }

    // MARK: - Actions

    @objc private func handleToggle(_ sender: Any) { reduceView("TOGGLE") }
    @objc private func handleRetry(_ sender: NSButton) { reduceExec("RETRY") }

    // MARK: - Mouse tracking

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        if let area = trackingArea { removeTrackingArea(area) }
        trackingArea = NSTrackingArea(rect: bounds, options: [.mouseEnteredAndExited, .activeInKeyWindow], owner: self, userInfo: nil)
        addTrackingArea(trackingArea!)
    }

    override func mouseEntered(with event: NSEvent) { if viewState == .collapsed { reduceView("HOVER") } }
    override func mouseExited(with event: NSEvent) { if viewState == .hoveredCollapsed { reduceView("LEAVE") } }

    // MARK: - Keyboard

    override var acceptsFirstResponder: Bool { true }

    override func keyDown(with event: NSEvent) {
        switch event.keyCode {
        case 49, 36: reduceView("TOGGLE") // Space, Enter
        default: super.keyDown(with: event)
        }
    }

    deinit {}
}
