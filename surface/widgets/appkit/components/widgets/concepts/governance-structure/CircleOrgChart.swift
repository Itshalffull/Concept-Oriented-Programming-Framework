import AppKit

class CircleOrgChartView: NSView {

    enum State: String { case idle; case circleSelected }

    struct Circle {
        let id: String
        let name: String
        let members: [String]
        let policies: [String]
        let jurisdiction: String?
        let parentId: String?
    }

    private(set) var state: State = .idle
    private var circles: [Circle] = []
    private var selectedCircleId: String? = nil
    private var expandedIds: Set<String> = []
    private var focusIndex: Int = 0
    private var flatCircleIds: [String] = []
    private var trackingArea: NSTrackingArea?

    var onCircleSelect: ((String) -> Void)?

    private let rootStack = NSStackView()
    private let treeScroll = NSScrollView()
    private let treeContainer = NSStackView()
    private let detailPanel = NSStackView()
    private let detailNameLabel = NSTextField(labelWithString: "")
    private let detailMembersLabel = NSTextField(wrappingLabelWithString: "")
    private let detailPoliciesLabel = NSTextField(wrappingLabelWithString: "")
    private let detailJurisdictionLabel = NSTextField(labelWithString: "")

    // MARK: - State machine

    func reduce(_ event: String, circleId: String? = nil) {
        switch state {
        case .idle:
            if event == "SELECT_CIRCLE", let id = circleId { state = .circleSelected; selectedCircleId = id; onCircleSelect?(id) }
        case .circleSelected:
            if event == "DESELECT" { state = .idle; selectedCircleId = nil }
            if event == "SELECT_CIRCLE", let id = circleId { selectedCircleId = id; onCircleSelect?(id) }
        }
        updateUI()
    }

    // MARK: - Init

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Hierarchical organization chart showing governance circles")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    // MARK: - Setup

    private func setupSubviews() {
        wantsLayer = true

        rootStack.orientation = .horizontal
        rootStack.spacing = 12
        rootStack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(rootStack)
        NSLayoutConstraint.activate([
            rootStack.topAnchor.constraint(equalTo: topAnchor, constant: 8),
            rootStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
            rootStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
            rootStack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -8),
        ])

        // Tree view
        treeScroll.hasVerticalScroller = true
        treeScroll.drawsBackground = false
        treeContainer.orientation = .vertical
        treeContainer.spacing = 2
        treeScroll.documentView = treeContainer
        rootStack.addArrangedSubview(treeScroll)

        // Detail panel
        detailPanel.orientation = .vertical
        detailPanel.spacing = 6
        detailPanel.isHidden = true
        detailNameLabel.font = .boldSystemFont(ofSize: 15)
        detailMembersLabel.font = .systemFont(ofSize: 12)
        detailPoliciesLabel.font = .systemFont(ofSize: 12)
        detailJurisdictionLabel.font = .systemFont(ofSize: 12)
        detailJurisdictionLabel.textColor = .secondaryLabelColor
        detailPanel.addArrangedSubview(detailNameLabel)
        detailPanel.addArrangedSubview(detailMembersLabel)
        detailPanel.addArrangedSubview(detailPoliciesLabel)
        detailPanel.addArrangedSubview(detailJurisdictionLabel)
        detailPanel.widthAnchor.constraint(greaterThanOrEqualToConstant: 200).isActive = true
        rootStack.addArrangedSubview(detailPanel)

        updateUI()
    }

    // MARK: - Configure

    func configure(circles: [Circle]) {
        self.circles = circles
        expandedIds = Set(circles.map { $0.id })
        rebuildTree()
        updateUI()
    }

    private func rebuildTree() {
        treeContainer.arrangedSubviews.forEach { $0.removeFromSuperview() }
        flatCircleIds = []

        let roots = circles.filter { $0.parentId == nil }
        for root in roots {
            addCircleNode(root, depth: 0)
        }
    }

    private func addCircleNode(_ circle: Circle, depth: Int) {
        flatCircleIds.append(circle.id)
        let isExpanded = expandedIds.contains(circle.id)
        let children = circles.filter { $0.parentId == circle.id }
        let hasChildren = !children.isEmpty

        let row = NSStackView()
        row.orientation = .horizontal
        row.spacing = 4
        row.edgeInsets = NSEdgeInsets(top: 2, left: CGFloat(depth * 20), bottom: 2, right: 4)

        // Expand/collapse toggle
        if hasChildren {
            let toggle = NSButton(title: isExpanded ? "\u{25BC}" : "\u{25B6}", target: self, action: #selector(handleToggle(_:)))
            toggle.bezelStyle = .roundRect
            toggle.font = .systemFont(ofSize: 10)
            toggle.identifier = NSUserInterfaceItemIdentifier("toggle-\(circle.id)")
            toggle.setAccessibilityLabel(isExpanded ? "Collapse \(circle.name)" : "Expand \(circle.name)")
            row.addArrangedSubview(toggle)
        } else {
            let spacer = NSView()
            spacer.widthAnchor.constraint(equalToConstant: 24).isActive = true
            row.addArrangedSubview(spacer)
        }

        // Circle name button
        let nameBtn = NSButton(title: circle.name, target: self, action: #selector(handleCircleClick(_:)))
        nameBtn.bezelStyle = .roundRect
        nameBtn.identifier = NSUserInterfaceItemIdentifier(circle.id)
        nameBtn.setAccessibilityLabel("\(circle.name), \(circle.members.count) members")
        if selectedCircleId == circle.id {
            nameBtn.contentTintColor = .controlAccentColor
        }
        row.addArrangedSubview(nameBtn)

        // Member count
        let memberBadge = NSTextField(labelWithString: "\(circle.members.count)")
        memberBadge.font = .systemFont(ofSize: 10)
        memberBadge.textColor = .secondaryLabelColor
        row.addArrangedSubview(memberBadge)

        // Jurisdiction tag
        if let j = circle.jurisdiction {
            let tag = NSTextField(labelWithString: j)
            tag.font = .systemFont(ofSize: 10)
            tag.textColor = .tertiaryLabelColor
            row.addArrangedSubview(tag)
        }

        treeContainer.addArrangedSubview(row)

        // Recursively add children
        if hasChildren && isExpanded {
            for child in children {
                addCircleNode(child, depth: depth + 1)
            }
        }
    }

    private func updateUI() {
        if state == .circleSelected, let id = selectedCircleId, let circle = circles.first(where: { $0.id == id }) {
            detailPanel.isHidden = false
            detailNameLabel.stringValue = circle.name
            detailMembersLabel.stringValue = "Members: \(circle.members.joined(separator: ", "))"
            detailPoliciesLabel.stringValue = "Policies: \(circle.policies.joined(separator: ", "))"
            detailJurisdictionLabel.stringValue = circle.jurisdiction ?? ""
        } else {
            detailPanel.isHidden = true
        }

        setAccessibilityValue("\(circles.count) circles, \(state.rawValue)")
    }

    // MARK: - Actions

    @objc private func handleCircleClick(_ sender: NSButton) {
        if let id = sender.identifier?.rawValue {
            reduce("SELECT_CIRCLE", circleId: id)
        }
    }

    @objc private func handleToggle(_ sender: NSButton) {
        guard let rawId = sender.identifier?.rawValue, rawId.hasPrefix("toggle-") else { return }
        let id = String(rawId.dropFirst(7))
        if expandedIds.contains(id) { expandedIds.remove(id) } else { expandedIds.insert(id) }
        rebuildTree()
        updateUI()
    }

    // MARK: - Keyboard

    override var acceptsFirstResponder: Bool { true }

    override func keyDown(with event: NSEvent) {
        switch event.keyCode {
        case 125: // Down
            focusIndex = min(focusIndex + 1, flatCircleIds.count - 1)
            if focusIndex < flatCircleIds.count { reduce("SELECT_CIRCLE", circleId: flatCircleIds[focusIndex]) }
        case 126: // Up
            focusIndex = max(focusIndex - 1, 0)
            if focusIndex < flatCircleIds.count { reduce("SELECT_CIRCLE", circleId: flatCircleIds[focusIndex]) }
        case 124: // Right - expand
            if focusIndex < flatCircleIds.count {
                expandedIds.insert(flatCircleIds[focusIndex])
                rebuildTree(); updateUI()
            }
        case 123: // Left - collapse
            if focusIndex < flatCircleIds.count {
                expandedIds.remove(flatCircleIds[focusIndex])
                rebuildTree(); updateUI()
            }
        case 53: reduce("DESELECT") // Escape
        default: super.keyDown(with: event)
        }
    }

    // MARK: - Cleanup

    deinit {}
}
