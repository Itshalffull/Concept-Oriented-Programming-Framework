import AppKit

class ReasoningBlockView: NSView {

    enum State: String { case collapsed; case expanded; case streaming }

    private(set) var state: State = .collapsed
    private var headerText: String = "Reasoning"
    private var bodyText: String = ""
    private var duration: String? = nil
    private var trackingArea: NSTrackingArea?

    var onToggle: ((Bool) -> Void)?

    private let rootStack = NSStackView()
    private let headerBtn = NSButton(title: "", target: nil, action: nil)
    private let headerIcon = NSTextField(labelWithString: "\u{25B6}")
    private let headerLabel = NSTextField(labelWithString: "Reasoning")
    private let durationLabel = NSTextField(labelWithString: "")
    private let bodyScroll = NSScrollView()
    private let bodyTextView = NSTextView()

    // MARK: - State machine

    func reduce(_ event: String) {
        switch state {
        case .collapsed:
            if event == "TOGGLE" { state = .expanded; onToggle?(true) }
            if event == "STREAM_START" { state = .streaming }
        case .expanded:
            if event == "TOGGLE" { state = .collapsed; onToggle?(false) }
        case .streaming:
            if event == "STREAM_END" { state = .expanded }
            if event == "TOGGLE" { state = .collapsed; onToggle?(false) }
        }
        updateUI()
    }

    // MARK: - Init

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Collapsible display for LLM chain-of-thought reasoning")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    // MARK: - Setup

    private func setupSubviews() {
        wantsLayer = true
        layer?.cornerRadius = 6
        layer?.backgroundColor = NSColor.controlBackgroundColor.cgColor

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

        // Header row
        let headerRow = NSStackView()
        headerRow.orientation = .horizontal
        headerRow.spacing = 6

        headerIcon.font = .systemFont(ofSize: 10)
        headerIcon.setAccessibilityRole(.image)
        headerRow.addArrangedSubview(headerIcon)

        headerLabel.font = .boldSystemFont(ofSize: 13)
        headerRow.addArrangedSubview(headerLabel)

        durationLabel.font = .systemFont(ofSize: 11)
        durationLabel.textColor = .tertiaryLabelColor
        durationLabel.isHidden = true
        headerRow.addArrangedSubview(durationLabel)

        headerBtn.bezelStyle = .roundRect
        headerBtn.isBordered = false
        headerBtn.target = self
        headerBtn.action = #selector(handleToggle(_:))
        headerBtn.setAccessibilityLabel("Toggle reasoning block")

        rootStack.addArrangedSubview(headerRow)

        // Make the header row clickable
        let clickGesture = NSClickGestureRecognizer(target: self, action: #selector(handleToggle(_:)))
        headerRow.addGestureRecognizer(clickGesture)

        // Body
        bodyScroll.hasVerticalScroller = true
        bodyScroll.drawsBackground = false
        bodyTextView.isEditable = false
        bodyTextView.isSelectable = true
        bodyTextView.font = .monospacedSystemFont(ofSize: 12, weight: .regular)
        bodyTextView.textColor = .secondaryLabelColor
        bodyScroll.documentView = bodyTextView
        bodyScroll.heightAnchor.constraint(greaterThanOrEqualToConstant: 40).isActive = true
        bodyScroll.isHidden = true
        rootStack.addArrangedSubview(bodyScroll)

        updateUI()
    }

    // MARK: - Configure

    func configure(header: String, body: String, duration: String? = nil, streaming: Bool = false) {
        self.headerText = header
        self.bodyText = body
        self.duration = duration
        headerLabel.stringValue = header
        bodyTextView.string = body

        if streaming && state == .collapsed { reduce("STREAM_START") }
        else if !streaming && state == .streaming { reduce("STREAM_END") }

        updateUI()
    }

    func appendStreamText(_ text: String) {
        bodyText += text
        bodyTextView.string = bodyText
        bodyTextView.scrollToEndOfDocument(nil)
    }

    private func updateUI() {
        let isOpen = state == .expanded || state == .streaming
        headerIcon.stringValue = isOpen ? "\u{25BC}" : "\u{25B6}"
        bodyScroll.isHidden = !isOpen

        durationLabel.isHidden = duration == nil
        if let d = duration { durationLabel.stringValue = d }

        if state == .streaming {
            headerLabel.stringValue = "\(headerText) (streaming...)"
        } else {
            headerLabel.stringValue = headerText
        }

        setAccessibilityValue("\(state.rawValue): \(headerText)")
    }

    // MARK: - Actions

    @objc private func handleToggle(_ sender: Any) { reduce("TOGGLE") }

    // MARK: - Keyboard

    override var acceptsFirstResponder: Bool { true }

    override func keyDown(with event: NSEvent) {
        switch event.keyCode {
        case 49, 36: reduce("TOGGLE") // Space, Enter
        default: super.keyDown(with: event)
        }
    }

    deinit {}
}
