import AppKit

class InlineCitationView: NSView {

    enum State: String { case idle; case previewing; case navigating }

    private(set) var state: State = .idle
    private var citationNumber: Int = 1
    private var titleText: String = ""
    private var excerpt: String = ""
    private var url: String? = nil
    private var trackingArea: NSTrackingArea?

    var onNavigate: ((String) -> Void)?

    private let rootStack = NSStackView()
    private let badge = NSTextField(labelWithString: "")
    private let tooltipPanel = NSStackView()
    private let tooltipTitle = NSTextField(labelWithString: "")
    private let tooltipExcerpt = NSTextField(wrappingLabelWithString: "")
    private let tooltipLink = NSButton(title: "Open", target: nil, action: nil)

    // MARK: - State machine

    func reduce(_ event: String) {
        switch state {
        case .idle:
            if event == "HOVER" { state = .previewing }
        case .previewing:
            if event == "LEAVE" { state = .idle }
            if event == "NAVIGATE" { state = .navigating; if let u = url { onNavigate?(u) } }
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
        setAccessibilityLabel("Numbered inline citation reference")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    // MARK: - Setup

    private func setupSubviews() {
        wantsLayer = true

        rootStack.orientation = .vertical
        rootStack.spacing = 2
        rootStack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(rootStack)
        NSLayoutConstraint.activate([
            rootStack.topAnchor.constraint(equalTo: topAnchor),
            rootStack.leadingAnchor.constraint(equalTo: leadingAnchor),
            rootStack.trailingAnchor.constraint(equalTo: trailingAnchor),
            rootStack.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        // Badge
        badge.font = .monospacedDigitSystemFont(ofSize: 10, weight: .bold)
        badge.textColor = .controlAccentColor
        badge.wantsLayer = true
        badge.layer?.cornerRadius = 8
        badge.layer?.backgroundColor = NSColor.controlAccentColor.withAlphaComponent(0.1).cgColor
        badge.alignment = .center
        badge.setAccessibilityRole(.staticText)
        rootStack.addArrangedSubview(badge)

        // Tooltip panel
        tooltipPanel.orientation = .vertical
        tooltipPanel.spacing = 4
        tooltipPanel.isHidden = true
        tooltipPanel.wantsLayer = true
        tooltipPanel.layer?.backgroundColor = NSColor.windowBackgroundColor.cgColor
        tooltipPanel.layer?.borderWidth = 1
        tooltipPanel.layer?.borderColor = NSColor.separatorColor.cgColor
        tooltipPanel.layer?.cornerRadius = 6

        tooltipTitle.font = .boldSystemFont(ofSize: 12)
        tooltipExcerpt.font = .systemFont(ofSize: 11)
        tooltipExcerpt.textColor = .secondaryLabelColor
        tooltipExcerpt.maximumNumberOfLines = 3
        tooltipLink.bezelStyle = .roundRect
        tooltipLink.target = self
        tooltipLink.action = #selector(handleNavigate(_:))
        tooltipLink.setAccessibilityLabel("Open citation link")

        tooltipPanel.addArrangedSubview(tooltipTitle)
        tooltipPanel.addArrangedSubview(tooltipExcerpt)
        tooltipPanel.addArrangedSubview(tooltipLink)
        rootStack.addArrangedSubview(tooltipPanel)

        updateUI()
    }

    // MARK: - Configure

    func configure(number: Int, title: String, excerpt: String, url: String? = nil) {
        self.citationNumber = number
        self.titleText = title
        self.excerpt = excerpt
        self.url = url
        badge.stringValue = "[\(number)]"
        tooltipTitle.stringValue = title
        tooltipExcerpt.stringValue = excerpt
        tooltipLink.isHidden = url == nil
        updateUI()
    }

    private func updateUI() {
        tooltipPanel.isHidden = state != .previewing

        setAccessibilityValue("Citation \(citationNumber): \(titleText)")
    }

    // MARK: - Actions

    @objc private func handleNavigate(_ sender: NSButton) { reduce("NAVIGATE") }

    // MARK: - Mouse tracking

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        if let area = trackingArea { removeTrackingArea(area) }
        trackingArea = NSTrackingArea(rect: bounds, options: [.mouseEnteredAndExited, .activeInKeyWindow], owner: self, userInfo: nil)
        addTrackingArea(trackingArea!)
    }

    override func mouseEntered(with event: NSEvent) { reduce("HOVER") }
    override func mouseExited(with event: NSEvent) { reduce("LEAVE") }
    override func mouseDown(with event: NSEvent) { reduce("NAVIGATE") }

    // MARK: - Keyboard

    override var acceptsFirstResponder: Bool { true }

    override func keyDown(with event: NSEvent) {
        switch event.keyCode {
        case 36: reduce("NAVIGATE") // Enter
        default: super.keyDown(with: event)
        }
    }

    deinit {}
}
