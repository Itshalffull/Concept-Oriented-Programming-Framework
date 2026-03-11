import AppKit

class VerificationStatusBadgeView: NSView {

    enum State: String { case idle; case hovered; case animating }
    enum VerificationStatus: String { case proved; case refuted; case unknown; case timeout; case running }

    private(set) var state: State = .idle
    private var status: VerificationStatus = .unknown
    private var labelText: String = "Unknown"
    private var duration: Int? = nil
    private var solver: String? = nil
    private var animationTimer: Timer?
    private var trackingArea: NSTrackingArea?

    private let rootStack = NSStackView()
    private let iconView = NSImageView()
    private let statusLabel = NSTextField(labelWithString: "Unknown")
    private let tooltipPanel = NSTextField(labelWithString: "")

    // MARK: - State machine

    func reduce(_ event: String) {
        switch state {
        case .idle:
            if event == "HOVER" { state = .hovered }
            if event == "STATUS_CHANGE" { state = .animating; startAnimation() }
        case .hovered:
            if event == "LEAVE" { state = .idle }
        case .animating:
            if event == "ANIMATION_END" { state = .idle }
        }
        updateUI()
    }

    // MARK: - Init

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Verification status badge")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    // MARK: - Setup

    private func setupSubviews() {
        wantsLayer = true

        rootStack.orientation = .horizontal
        rootStack.spacing = 6
        rootStack.alignment = .centerY
        rootStack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(rootStack)
        NSLayoutConstraint.activate([
            rootStack.topAnchor.constraint(equalTo: topAnchor, constant: 4),
            rootStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
            rootStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
            rootStack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -4),
        ])

        // Icon
        iconView.imageScaling = .scaleProportionallyDown
        iconView.widthAnchor.constraint(equalToConstant: 16).isActive = true
        iconView.heightAnchor.constraint(equalToConstant: 16).isActive = true
        iconView.setAccessibilityRole(.image)
        rootStack.addArrangedSubview(iconView)

        // Status label
        statusLabel.font = .systemFont(ofSize: 13, weight: .medium)
        statusLabel.isSelectable = false
        statusLabel.setAccessibilityRole(.staticText)
        rootStack.addArrangedSubview(statusLabel)

        // Tooltip panel (hidden by default)
        tooltipPanel.font = .systemFont(ofSize: 11)
        tooltipPanel.textColor = .secondaryLabelColor
        tooltipPanel.isHidden = true
        tooltipPanel.setAccessibilityRole(.staticText)
        addSubview(tooltipPanel)
        tooltipPanel.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            tooltipPanel.topAnchor.constraint(equalTo: rootStack.bottomAnchor, constant: 4),
            tooltipPanel.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
        ])

        updateUI()
    }

    // MARK: - Configure

    func configure(status: VerificationStatus, label: String, duration: Int? = nil, solver: String? = nil) {
        let oldStatus = self.status
        self.status = status
        self.labelText = label
        self.duration = duration
        self.solver = solver

        if oldStatus != status {
            reduce("STATUS_CHANGE")
        }
        updateUI()
    }

    private func updateUI() {
        statusLabel.stringValue = labelText
        updateIcon()

        // Tooltip
        var tooltipParts: [String] = []
        if let s = solver { tooltipParts.append(s) }
        if let d = duration { tooltipParts.append("\(d)ms") }
        let tooltipText = tooltipParts.joined(separator: " \u{2014} ")
        tooltipPanel.stringValue = tooltipText
        tooltipPanel.isHidden = state != .hovered || tooltipText.isEmpty

        // Color by status
        switch status {
        case .proved:
            statusLabel.textColor = .systemGreen
            iconView.contentTintColor = .systemGreen
        case .refuted:
            statusLabel.textColor = .systemRed
            iconView.contentTintColor = .systemRed
        case .unknown:
            statusLabel.textColor = .secondaryLabelColor
            iconView.contentTintColor = .secondaryLabelColor
        case .timeout:
            statusLabel.textColor = .systemOrange
            iconView.contentTintColor = .systemOrange
        case .running:
            statusLabel.textColor = .systemBlue
            iconView.contentTintColor = .systemBlue
        }

        // Animation pulse
        if state == .animating {
            layer?.opacity = 0.5
        } else {
            layer?.opacity = 1.0
        }

        setAccessibilityValue("Verification status: \(labelText), \(state.rawValue)")
    }

    private func updateIcon() {
        let symbolName: String
        switch status {
        case .proved: symbolName = "checkmark.circle.fill"
        case .refuted: symbolName = "xmark.circle.fill"
        case .unknown: symbolName = "questionmark.circle"
        case .timeout: symbolName = "clock"
        case .running: symbolName = "arrow.triangle.2.circlepath"
        }
        if let img = NSImage(systemSymbolName: symbolName, accessibilityDescription: status.rawValue) {
            iconView.image = img
        }
    }

    private func startAnimation() {
        animationTimer?.invalidate()
        animationTimer = Timer.scheduledTimer(withTimeInterval: 0.2, repeats: false) { [weak self] _ in
            self?.reduce("ANIMATION_END")
        }
    }

    // MARK: - Mouse tracking

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        if let area = trackingArea { removeTrackingArea(area) }
        trackingArea = NSTrackingArea(rect: bounds, options: [.mouseEnteredAndExited, .activeInKeyWindow], owner: self, userInfo: nil)
        addTrackingArea(trackingArea!)
    }

    override func mouseEntered(with event: NSEvent) { reduce("HOVER") }
    override func mouseExited(with event: NSEvent) { reduce("LEAVE") }

    // MARK: - Keyboard

    override var acceptsFirstResponder: Bool { true }

    override func keyDown(with event: NSEvent) {
        super.keyDown(with: event)
    }

    override func becomeFirstResponder() -> Bool {
        reduce("HOVER")
        return super.becomeFirstResponder()
    }

    override func resignFirstResponder() -> Bool {
        reduce("LEAVE")
        return super.resignFirstResponder()
    }

    // MARK: - Cleanup

    deinit { animationTimer?.invalidate() }
}
