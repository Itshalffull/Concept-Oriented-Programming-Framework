import AppKit

class AgentTimelineView: NSView {

    enum State: String { case idle; case entrySelected; case interrupted; case inactive; case active }
    enum EntryType: String { case message; case tool; case delegation; case interrupt; case error }

    struct TimelineEntry {
        let id: String
        let agentName: String
        let entryType: EntryType
        let content: String
        let timestamp: String
        let delegatedTo: String?
    }

    private(set) var state: State = .idle
    private var entries: [TimelineEntry] = []
    private var selectedEntryId: String? = nil
    private var focusIndex: Int = 0
    private var trackingArea: NSTrackingArea?

    var onEntrySelect: ((String) -> Void)?
    var onInterrupt: (() -> Void)?

    private let rootStack = NSStackView()
    private let headerLabel = NSTextField(labelWithString: "Agent Timeline")
    private let statusLabel = NSTextField(labelWithString: "")
    private let timelineScroll = NSScrollView()
    private let timelineContainer = NSStackView()
    private let interruptBtn = NSButton(title: "Interrupt", target: nil, action: nil)

    // MARK: - State machine

    func reduce(_ event: String, entryId: String? = nil) {
        switch state {
        case .idle:
            if event == "SELECT_ENTRY", let id = entryId { state = .entrySelected; selectedEntryId = id; onEntrySelect?(id) }
            if event == "INTERRUPT" { state = .interrupted; onInterrupt?() }
            if event == "ACTIVATE" { state = .active }
            if event == "DEACTIVATE" { state = .inactive }
        case .entrySelected:
            if event == "DESELECT" { state = .idle; selectedEntryId = nil }
            if event == "SELECT_ENTRY", let id = entryId { selectedEntryId = id; onEntrySelect?(id) }
        case .interrupted:
            if event == "RESUME" { state = .active }
            if event == "DEACTIVATE" { state = .inactive }
        case .inactive:
            if event == "ACTIVATE" { state = .active }
        case .active:
            if event == "INTERRUPT" { state = .interrupted; onInterrupt?() }
            if event == "DEACTIVATE" { state = .inactive }
            if event == "SELECT_ENTRY", let id = entryId { state = .entrySelected; selectedEntryId = id; onEntrySelect?(id) }
        }
        updateUI()
    }

    // MARK: - Init

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Multi-agent communication timeline display")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    // MARK: - Setup

    private func setupSubviews() {
        wantsLayer = true

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

        let headerRow = NSStackView()
        headerRow.orientation = .horizontal
        headerRow.spacing = 8
        headerLabel.font = .boldSystemFont(ofSize: 14)
        statusLabel.font = .systemFont(ofSize: 12)
        statusLabel.textColor = .secondaryLabelColor
        interruptBtn.bezelStyle = .roundRect
        interruptBtn.target = self
        interruptBtn.action = #selector(handleInterrupt(_:))
        interruptBtn.setAccessibilityLabel("Interrupt agent")
        headerRow.addArrangedSubview(headerLabel)
        headerRow.addArrangedSubview(statusLabel)
        headerRow.addArrangedSubview(interruptBtn)
        rootStack.addArrangedSubview(headerRow)

        timelineScroll.hasVerticalScroller = true
        timelineScroll.drawsBackground = false
        timelineContainer.orientation = .vertical
        timelineContainer.spacing = 4
        timelineScroll.documentView = timelineContainer
        rootStack.addArrangedSubview(timelineScroll)

        updateUI()
    }

    // MARK: - Configure

    func configure(entries: [TimelineEntry], agentActive: Bool = false) {
        self.entries = entries
        if agentActive && state == .idle { reduce("ACTIVATE") }
        rebuildTimeline()
        updateUI()
    }

    private func rebuildTimeline() {
        timelineContainer.arrangedSubviews.forEach { $0.removeFromSuperview() }

        for (i, entry) in entries.enumerated() {
            let row = NSStackView()
            row.orientation = .horizontal
            row.spacing = 8

            // Agent badge
            let badge = NSTextField(labelWithString: entry.agentName)
            badge.font = .boldSystemFont(ofSize: 11)
            badge.wantsLayer = true
            badge.layer?.cornerRadius = 4
            badge.layer?.backgroundColor = NSColor.controlAccentColor.withAlphaComponent(0.2).cgColor
            row.addArrangedSubview(badge)

            // Type icon
            let icon: String
            switch entry.entryType {
            case .message: icon = "\u{1F4AC}"
            case .tool: icon = "\u{1F527}"
            case .delegation: icon = "\u{27A1}"
            case .interrupt: icon = "\u{26A0}"
            case .error: icon = "\u{274C}"
            }
            let typeLabel = NSTextField(labelWithString: icon)
            typeLabel.font = .systemFont(ofSize: 12)
            row.addArrangedSubview(typeLabel)

            // Content button
            let contentBtn = NSButton(title: entry.content, target: self, action: #selector(handleEntryClick(_:)))
            contentBtn.bezelStyle = .roundRect
            contentBtn.tag = i
            contentBtn.setAccessibilityLabel("\(entry.agentName): \(entry.content)")
            if selectedEntryId == entry.id {
                contentBtn.contentTintColor = .controlAccentColor
            }
            row.addArrangedSubview(contentBtn)

            // Timestamp
            let timeLabel = NSTextField(labelWithString: entry.timestamp)
            timeLabel.font = .systemFont(ofSize: 10)
            timeLabel.textColor = .tertiaryLabelColor
            row.addArrangedSubview(timeLabel)

            // Delegation info
            if let del = entry.delegatedTo {
                let delLabel = NSTextField(labelWithString: "\u{27A1} \(del)")
                delLabel.font = .systemFont(ofSize: 10)
                delLabel.textColor = .secondaryLabelColor
                row.addArrangedSubview(delLabel)
            }

            timelineContainer.addArrangedSubview(row)
        }
    }

    private func updateUI() {
        statusLabel.stringValue = state.rawValue.capitalized
        interruptBtn.isHidden = state != .active

        switch state {
        case .active: statusLabel.textColor = .systemGreen
        case .interrupted: statusLabel.textColor = .systemOrange
        case .inactive: statusLabel.textColor = .secondaryLabelColor
        default: statusLabel.textColor = .secondaryLabelColor
        }

        setAccessibilityValue("\(entries.count) entries, \(state.rawValue)")
    }

    // MARK: - Actions

    @objc private func handleEntryClick(_ sender: NSButton) {
        let idx = sender.tag
        guard idx < entries.count else { return }
        reduce("SELECT_ENTRY", entryId: entries[idx].id)
    }

    @objc private func handleInterrupt(_ sender: NSButton) { reduce("INTERRUPT") }

    // MARK: - Keyboard

    override var acceptsFirstResponder: Bool { true }

    override func keyDown(with event: NSEvent) {
        switch event.keyCode {
        case 125: focusIndex = min(focusIndex + 1, entries.count - 1); if focusIndex < entries.count { reduce("SELECT_ENTRY", entryId: entries[focusIndex].id) }
        case 126: focusIndex = max(focusIndex - 1, 0); if focusIndex < entries.count { reduce("SELECT_ENTRY", entryId: entries[focusIndex].id) }
        case 53: reduce("DESELECT")
        default: super.keyDown(with: event)
        }
    }

    deinit {}
}
