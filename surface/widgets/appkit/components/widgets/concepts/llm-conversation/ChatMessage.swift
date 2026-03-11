import AppKit

class ChatMessageView: NSView {

    enum State: String { case idle; case hovered; case streaming; case copied }

    private(set) var state: State = .idle
    private var role: String = "user"
    private var body: String = ""
    private var timestamp: String = ""
    private var avatarText: String = ""
    private var copyTimer: Timer?
    private var trackingArea: NSTrackingArea?

    var onCopy: (() -> Void)?

    private let rootStack = NSStackView()
    private let avatarLabel = NSTextField(labelWithString: "")
    private let roleLabel = NSTextField(labelWithString: "")
    private let bodyLabel = NSTextField(wrappingLabelWithString: "")
    private let timestampLabel = NSTextField(labelWithString: "")
    private let actionsStack = NSStackView()
    private let copyBtn = NSButton(title: "Copy", target: nil, action: nil)

    // MARK: - State machine

    func reduce(_ event: String) {
        switch state {
        case .idle:
            if event == "HOVER" { state = .hovered }
            if event == "STREAM_START" { state = .streaming }
        case .hovered:
            if event == "LEAVE" { state = .idle }
            if event == "COPY" { state = .copied; performCopy() }
        case .streaming:
            if event == "STREAM_END" { state = .idle }
        case .copied:
            if event == "COPY_TIMEOUT" { state = .idle }
            if event == "LEAVE" { state = .idle }
        }
        updateUI()
    }

    // MARK: - Init

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Role-differentiated message container for chat display")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    // MARK: - Setup

    private func setupSubviews() {
        wantsLayer = true

        rootStack.orientation = .vertical
        rootStack.spacing = 4
        rootStack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(rootStack)
        NSLayoutConstraint.activate([
            rootStack.topAnchor.constraint(equalTo: topAnchor, constant: 8),
            rootStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
            rootStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
            rootStack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -8),
        ])

        let headerRow = NSStackView()
        headerRow.orientation = .horizontal
        headerRow.spacing = 8
        avatarLabel.font = .boldSystemFont(ofSize: 12)
        avatarLabel.alignment = .center
        avatarLabel.widthAnchor.constraint(equalToConstant: 28).isActive = true
        roleLabel.font = .boldSystemFont(ofSize: 13)
        timestampLabel.font = .systemFont(ofSize: 10)
        timestampLabel.textColor = .tertiaryLabelColor
        headerRow.addArrangedSubview(avatarLabel)
        headerRow.addArrangedSubview(roleLabel)
        headerRow.addArrangedSubview(timestampLabel)
        rootStack.addArrangedSubview(headerRow)

        bodyLabel.font = .systemFont(ofSize: 13)
        bodyLabel.isSelectable = true
        rootStack.addArrangedSubview(bodyLabel)

        actionsStack.orientation = .horizontal
        actionsStack.spacing = 6
        actionsStack.isHidden = true
        copyBtn.bezelStyle = .roundRect
        copyBtn.target = self
        copyBtn.action = #selector(handleCopy(_:))
        copyBtn.setAccessibilityLabel("Copy message")
        actionsStack.addArrangedSubview(copyBtn)
        rootStack.addArrangedSubview(actionsStack)

        updateUI()
    }

    // MARK: - Configure

    func configure(role: String, body: String, timestamp: String = "", streaming: Bool = false) {
        self.role = role
        self.body = body
        self.timestamp = timestamp
        self.avatarText = String(role.prefix(1)).uppercased()
        avatarLabel.stringValue = avatarText
        roleLabel.stringValue = role.capitalized
        bodyLabel.stringValue = body
        timestampLabel.stringValue = timestamp

        if streaming && state == .idle { reduce("STREAM_START") }
        else if !streaming && state == .streaming { reduce("STREAM_END") }
        updateUI()
    }

    func appendStreamText(_ text: String) {
        body += text
        bodyLabel.stringValue = body
    }

    private func performCopy() {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(body, forType: .string)
        onCopy?()
        copyBtn.title = "Copied!"
        copyTimer?.invalidate()
        copyTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: false) { [weak self] _ in
            self?.reduce("COPY_TIMEOUT")
        }
    }

    private func updateUI() {
        actionsStack.isHidden = state != .hovered && state != .copied
        copyBtn.title = state == .copied ? "Copied!" : "Copy"

        // Role-based styling
        switch role {
        case "assistant":
            layer?.backgroundColor = NSColor.controlBackgroundColor.cgColor
        case "system":
            layer?.backgroundColor = NSColor.systemYellow.withAlphaComponent(0.05).cgColor
        default:
            layer?.backgroundColor = NSColor.clear.cgColor
        }

        setAccessibilityValue("\(role) message: \(body.prefix(50))")
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

    // MARK: - Actions

    @objc private func handleCopy(_ sender: NSButton) { reduce("COPY") }

    override var acceptsFirstResponder: Bool { true }

    deinit { copyTimer?.invalidate() }
}
