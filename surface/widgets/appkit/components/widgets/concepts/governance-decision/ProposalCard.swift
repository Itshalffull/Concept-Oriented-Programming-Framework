import AppKit

class ProposalCardView: NSView {

    enum State: String { case idle; case hovered; case focused; case navigating }

    private(set) var state: State = .idle
    private var title: String = ""
    private var descriptionText: String = ""
    private var author: String = ""
    private var proposalStatus: String = ""
    private var timestamp: String = ""
    private var variant: String = "full"
    private var showVoteBar: Bool = true
    private var showQuorum: Bool = false
    private var truncateLength: Int = 120
    private var trackingArea: NSTrackingArea?

    var onClick: (() -> Void)?
    var onNavigate: (() -> Void)?

    private let rootStack = NSStackView()
    private let statusBadge = NSTextField(labelWithString: "")
    private let titleLabel = NSTextField(labelWithString: "")
    private let descriptionLabel = NSTextField(wrappingLabelWithString: "")
    private let proposerLabel = NSTextField(labelWithString: "")
    private let voteBarPlaceholder = NSView()
    private let quorumPlaceholder = NSView()
    private let timeRemainingLabel = NSTextField(labelWithString: "")
    private let actionButton = NSButton(title: "View", target: nil, action: nil)

    // MARK: - State machine

    func reduce(_ event: String) {
        switch state {
        case .idle:
            if event == "HOVER" { state = .hovered }
            if event == "FOCUS" { state = .focused }
            if event == "CLICK" { state = .navigating; performNavigation() }
        case .hovered:
            if event == "UNHOVER" { state = .idle }
        case .focused:
            if event == "BLUR" { state = .idle }
            if event == "CLICK" || event == "ENTER" { state = .navigating; performNavigation() }
        case .navigating:
            if event == "NAVIGATE_COMPLETE" { state = .idle }
        }
        updateUI()
    }

    // MARK: - Init

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Proposal card")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    // MARK: - Setup

    private func setupSubviews() {
        wantsLayer = true
        layer?.cornerRadius = 8
        layer?.borderWidth = 1
        layer?.borderColor = NSColor.separatorColor.cgColor

        rootStack.orientation = .vertical
        rootStack.spacing = 6
        rootStack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(rootStack)
        NSLayoutConstraint.activate([
            rootStack.topAnchor.constraint(equalTo: topAnchor, constant: 12),
            rootStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            rootStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            rootStack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -12),
        ])

        // Status badge
        statusBadge.font = .boldSystemFont(ofSize: 11)
        statusBadge.wantsLayer = true
        statusBadge.layer?.cornerRadius = 4
        statusBadge.setAccessibilityRole(.staticText)
        rootStack.addArrangedSubview(statusBadge)

        // Title
        titleLabel.font = .boldSystemFont(ofSize: 15)
        titleLabel.maximumNumberOfLines = 2
        titleLabel.setAccessibilityRole(.staticText)
        rootStack.addArrangedSubview(titleLabel)

        // Description
        descriptionLabel.font = .systemFont(ofSize: 13)
        descriptionLabel.textColor = .secondaryLabelColor
        descriptionLabel.maximumNumberOfLines = 3
        rootStack.addArrangedSubview(descriptionLabel)

        // Proposer
        proposerLabel.font = .systemFont(ofSize: 12)
        proposerLabel.textColor = .tertiaryLabelColor
        rootStack.addArrangedSubview(proposerLabel)

        // Vote bar placeholder
        voteBarPlaceholder.heightAnchor.constraint(equalToConstant: 24).isActive = true
        rootStack.addArrangedSubview(voteBarPlaceholder)

        // Quorum placeholder
        quorumPlaceholder.heightAnchor.constraint(equalToConstant: 20).isActive = true
        rootStack.addArrangedSubview(quorumPlaceholder)

        // Time remaining
        timeRemainingLabel.font = .monospacedDigitSystemFont(ofSize: 12, weight: .regular)
        timeRemainingLabel.textColor = .secondaryLabelColor
        rootStack.addArrangedSubview(timeRemainingLabel)

        // Action button
        actionButton.bezelStyle = .roundRect
        actionButton.target = self
        actionButton.action = #selector(handleActionClick(_:))
        actionButton.setAccessibilityLabel("View proposal")
        rootStack.addArrangedSubview(actionButton)

        updateUI()
    }

    // MARK: - Configure

    func configure(title: String, description: String, author: String, status: String, timestamp: String, variant: String = "full", showVoteBar: Bool = true, showQuorum: Bool = false, truncateLength: Int = 120) {
        self.title = title
        self.descriptionText = description
        self.author = author
        self.proposalStatus = status
        self.timestamp = timestamp
        self.variant = variant
        self.showVoteBar = showVoteBar
        self.showQuorum = showQuorum
        self.truncateLength = truncateLength
        updateUI()
    }

    private func truncatedDescription() -> String {
        if descriptionText.count <= truncateLength { return descriptionText }
        return String(descriptionText.prefix(truncateLength).trimmingCharacters(in: .whitespaces)) + "\u{2026}"
    }

    private func actionLabel() -> String {
        switch proposalStatus {
        case "Active": return "Vote"
        case "Passed", "Approved": return "Execute"
        case "Draft": return "Edit"
        default: return "View"
        }
    }

    private func formatTimeRemaining() -> String {
        guard let date = ISO8601DateFormatter().date(from: timestamp) else { return timestamp }
        let diff = date.timeIntervalSinceNow
        let absDiff = abs(diff)
        let suffix = diff < 0 ? " ago" : " remaining"
        let days = Int(absDiff / 86400)
        let hours = Int(absDiff / 3600)
        let minutes = Int(absDiff / 60)
        if days > 0 { return "\(days)d\(suffix)" }
        if hours > 0 { return "\(hours)h\(suffix)" }
        return "\(minutes)m\(suffix)"
    }

    private func performNavigation() {
        onClick?()
        onNavigate?()
        DispatchQueue.main.async { [weak self] in
            self?.reduce("NAVIGATE_COMPLETE")
        }
    }

    private func updateUI() {
        let isMinimal = variant == "minimal"
        let isFull = variant == "full"

        statusBadge.stringValue = proposalStatus
        titleLabel.stringValue = title
        descriptionLabel.stringValue = truncatedDescription()
        descriptionLabel.isHidden = isMinimal
        proposerLabel.stringValue = "by \(author)"
        proposerLabel.isHidden = isMinimal
        voteBarPlaceholder.isHidden = !(showVoteBar && proposalStatus == "Active" && !isMinimal)
        quorumPlaceholder.isHidden = !(showQuorum && isFull)
        timeRemainingLabel.stringValue = formatTimeRemaining()
        actionButton.title = actionLabel()
        actionButton.isHidden = isMinimal
        actionButton.setAccessibilityLabel("\(actionLabel()) proposal: \(title)")

        // Status badge color
        switch proposalStatus {
        case "Active": statusBadge.textColor = .systemBlue
        case "Passed", "Approved": statusBadge.textColor = .systemGreen
        case "Rejected": statusBadge.textColor = .systemRed
        case "Cancelled": statusBadge.textColor = .secondaryLabelColor
        default: statusBadge.textColor = .labelColor
        }

        // Hover state
        if state == .hovered {
            layer?.backgroundColor = NSColor.controlBackgroundColor.withAlphaComponent(0.5).cgColor
        } else {
            layer?.backgroundColor = NSColor.clear.cgColor
        }

        setAccessibilityValue("\(proposalStatus) proposal: \(title)")
    }

    // MARK: - Actions

    @objc private func handleActionClick(_ sender: NSButton) {
        reduce("CLICK")
    }

    // MARK: - Mouse tracking

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        if let area = trackingArea { removeTrackingArea(area) }
        trackingArea = NSTrackingArea(rect: bounds, options: [.mouseEnteredAndExited, .activeInKeyWindow], owner: self, userInfo: nil)
        addTrackingArea(trackingArea!)
    }

    override func mouseEntered(with event: NSEvent) { reduce("HOVER") }
    override func mouseExited(with event: NSEvent) { reduce("UNHOVER") }
    override func mouseDown(with event: NSEvent) { reduce("CLICK") }

    // MARK: - Keyboard

    override var acceptsFirstResponder: Bool { true }

    override func becomeFirstResponder() -> Bool {
        reduce("FOCUS")
        return super.becomeFirstResponder()
    }

    override func resignFirstResponder() -> Bool {
        reduce("BLUR")
        return super.resignFirstResponder()
    }

    override func keyDown(with event: NSEvent) {
        switch event.keyCode {
        case 36, 49: reduce("ENTER") // Enter, Space
        default: super.keyDown(with: event)
        }
    }

    // MARK: - Cleanup

    deinit {}
}
