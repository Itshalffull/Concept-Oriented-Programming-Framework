import AppKit

class GuardStatusPanelView: NSView {

    enum State: String { case idle; case guardSelected }
    enum GuardStatus: String { case passing; case failing; case pending; case bypassed }

    struct Guard {
        let id: String
        let name: String
        let description: String
        let status: GuardStatus
        let lastChecked: String?
    }

    private(set) var state: State = .idle
    private var guards: [Guard] = []
    private var selectedGuardId: String? = nil
    private var focusIndex: Int = 0
    private var trackingArea: NSTrackingArea?

    var onGuardSelect: ((String) -> Void)?

    private let rootStack = NSStackView()
    private let headerLabel = NSTextField(labelWithString: "Guards")
    private let overallStatusLabel = NSTextField(labelWithString: "")
    private let guardScroll = NSScrollView()
    private let guardContainer = NSStackView()
    private let blockingBanner = NSTextField(wrappingLabelWithString: "")
    private let detailPanel = NSStackView()
    private let detailNameLabel = NSTextField(labelWithString: "")
    private let detailDescLabel = NSTextField(wrappingLabelWithString: "")
    private let detailStatusLabel = NSTextField(labelWithString: "")
    private let detailCheckedLabel = NSTextField(labelWithString: "")

    private let statusIcons: [GuardStatus: String] = [
        .passing: "\u{2713}", .failing: "\u{2717}", .pending: "\u{23F3}", .bypassed: "\u{2298}",
    ]
    private let statusLabels: [GuardStatus: String] = [
        .passing: "Passing", .failing: "Failing", .pending: "Pending", .bypassed: "Bypassed",
    ]

    // MARK: - State machine

    func reduce(_ event: String, guardId: String? = nil) {
        switch state {
        case .idle:
            if event == "SELECT_GUARD", let id = guardId { state = .guardSelected; selectedGuardId = id; onGuardSelect?(id) }
            if event == "GUARD_TRIP" { /* stay idle, update UI */ }
        case .guardSelected:
            if event == "DESELECT" { state = .idle; selectedGuardId = nil }
        }
        updateUI()
    }

    // MARK: - Init

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Panel displaying all active guards for a governance action")
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

        // Header
        let headerRow = NSStackView()
        headerRow.orientation = .horizontal
        headerRow.spacing = 8
        headerLabel.font = .boldSystemFont(ofSize: 14)
        overallStatusLabel.font = .systemFont(ofSize: 12)
        headerRow.addArrangedSubview(headerLabel)
        headerRow.addArrangedSubview(overallStatusLabel)
        rootStack.addArrangedSubview(headerRow)

        // Blocking banner
        blockingBanner.font = .boldSystemFont(ofSize: 12)
        blockingBanner.textColor = .white
        blockingBanner.wantsLayer = true
        blockingBanner.layer?.backgroundColor = NSColor.systemRed.cgColor
        blockingBanner.layer?.cornerRadius = 4
        blockingBanner.isHidden = true
        blockingBanner.setAccessibilityRole(.staticText)
        rootStack.addArrangedSubview(blockingBanner)

        // Guard list
        guardScroll.hasVerticalScroller = true
        guardScroll.drawsBackground = false
        guardContainer.orientation = .vertical
        guardContainer.spacing = 4
        guardScroll.documentView = guardContainer
        rootStack.addArrangedSubview(guardScroll)

        // Detail panel
        detailPanel.orientation = .vertical
        detailPanel.spacing = 4
        detailPanel.isHidden = true
        detailNameLabel.font = .boldSystemFont(ofSize: 13)
        detailDescLabel.font = .systemFont(ofSize: 12)
        detailDescLabel.textColor = .secondaryLabelColor
        detailStatusLabel.font = .systemFont(ofSize: 12)
        detailCheckedLabel.font = .systemFont(ofSize: 11)
        detailCheckedLabel.textColor = .tertiaryLabelColor
        detailPanel.addArrangedSubview(detailNameLabel)
        detailPanel.addArrangedSubview(detailDescLabel)
        detailPanel.addArrangedSubview(detailStatusLabel)
        detailPanel.addArrangedSubview(detailCheckedLabel)
        rootStack.addArrangedSubview(detailPanel)

        updateUI()
    }

    // MARK: - Configure

    func configure(guards: [Guard]) {
        self.guards = guards
        rebuildGuardList()
        updateUI()
    }

    private func rebuildGuardList() {
        guardContainer.arrangedSubviews.forEach { $0.removeFromSuperview() }

        for (i, guard_) in guards.enumerated() {
            let row = NSStackView()
            row.orientation = .horizontal
            row.spacing = 8

            let icon = statusIcons[guard_.status] ?? "?"
            let iconLabel = NSTextField(labelWithString: icon)
            iconLabel.font = .systemFont(ofSize: 14)
            switch guard_.status {
            case .passing: iconLabel.textColor = .systemGreen
            case .failing: iconLabel.textColor = .systemRed
            case .pending: iconLabel.textColor = .systemOrange
            case .bypassed: iconLabel.textColor = .secondaryLabelColor
            }
            row.addArrangedSubview(iconLabel)

            let nameBtn = NSButton(title: guard_.name, target: self, action: #selector(handleGuardClick(_:)))
            nameBtn.bezelStyle = .roundRect
            nameBtn.tag = i
            nameBtn.setAccessibilityLabel("\(guard_.name): \(statusLabels[guard_.status] ?? "")")
            row.addArrangedSubview(nameBtn)

            let statusText = NSTextField(labelWithString: statusLabels[guard_.status] ?? "")
            statusText.font = .systemFont(ofSize: 11)
            statusText.textColor = .secondaryLabelColor
            row.addArrangedSubview(statusText)

            row.setAccessibilityRole(.group)
            guardContainer.addArrangedSubview(row)
        }
    }

    private func deriveOverallStatus() -> String {
        if guards.isEmpty { return "all-passing" }
        if guards.contains(where: { $0.status == .failing }) { return "has-failing" }
        if guards.contains(where: { $0.status == .pending }) { return "has-pending" }
        return "all-passing"
    }

    private func updateUI() {
        let overall = deriveOverallStatus()
        overallStatusLabel.stringValue = overall == "all-passing" ? "All passing" : overall == "has-failing" ? "Blocked" : "Pending"
        overallStatusLabel.textColor = overall == "all-passing" ? .systemGreen : overall == "has-failing" ? .systemRed : .systemOrange

        // Blocking banner
        let failingGuards = guards.filter { $0.status == .failing }
        blockingBanner.isHidden = failingGuards.isEmpty
        if !failingGuards.isEmpty {
            blockingBanner.stringValue = " Blocked by: \(failingGuards.map { $0.name }.joined(separator: ", "))"
        }

        // Detail panel
        if state == .guardSelected, let id = selectedGuardId, let g = guards.first(where: { $0.id == id }) {
            detailPanel.isHidden = false
            detailNameLabel.stringValue = g.name
            detailDescLabel.stringValue = g.description
            detailStatusLabel.stringValue = "Status: \(statusLabels[g.status] ?? g.status.rawValue)"
            detailCheckedLabel.stringValue = g.lastChecked != nil ? "Last checked: \(g.lastChecked!)" : ""
        } else {
            detailPanel.isHidden = true
        }

        setAccessibilityValue("\(guards.count) guards, \(overall)")
    }

    // MARK: - Actions

    @objc private func handleGuardClick(_ sender: NSButton) {
        let idx = sender.tag
        guard idx < guards.count else { return }
        reduce("SELECT_GUARD", guardId: guards[idx].id)
    }

    // MARK: - Keyboard

    override var acceptsFirstResponder: Bool { true }

    override func keyDown(with event: NSEvent) {
        switch event.keyCode {
        case 125: // Down
            focusIndex = min(focusIndex + 1, guards.count - 1)
            if focusIndex < guards.count { reduce("SELECT_GUARD", guardId: guards[focusIndex].id) }
        case 126: // Up
            focusIndex = max(focusIndex - 1, 0)
            if focusIndex < guards.count { reduce("SELECT_GUARD", guardId: guards[focusIndex].id) }
        case 53: reduce("DESELECT") // Escape
        default: super.keyDown(with: event)
        }
    }

    // MARK: - Cleanup

    deinit {}
}
