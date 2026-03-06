import AppKit

class DependencyTreeView: NSView {

    enum State: String { case idle; case nodeSelected; case filtering }

    struct DependencyNode {
        let id: String
        let name: String
        let version: String
        let hasConflict: Bool
        let hasVuln: Bool
        let isDuplicate: Bool
        let children: [DependencyNode]
    }

    private(set) var state: State = .idle
    private var nodes: [DependencyNode] = []
    private var selectedNodeId: String? = nil
    private var expandedIds: Set<String> = []
    private var searchText: String = ""
    private var focusIndex: Int = 0
    private var flatNodeIds: [String] = []

    var onNodeSelect: ((String) -> Void)?

    private let rootStack = NSStackView()
    private let searchField = NSSearchField()
    private let treeScroll = NSScrollView()
    private let treeContainer = NSStackView()
    private let detailPanel = NSStackView()
    private let detailNameLabel = NSTextField(labelWithString: "")
    private let detailVersionLabel = NSTextField(labelWithString: "")
    private let detailFlagsLabel = NSTextField(labelWithString: "")

    func reduce(_ event: String, nodeId: String? = nil) {
        switch state {
        case .idle:
            if event == "SELECT_NODE", let id = nodeId { state = .nodeSelected; selectedNodeId = id; onNodeSelect?(id) }
            if event == "FILTER" { state = .filtering }
        case .nodeSelected:
            if event == "DESELECT" { state = .idle; selectedNodeId = nil }
            if event == "SELECT_NODE", let id = nodeId { selectedNodeId = id; onNodeSelect?(id) }
        case .filtering:
            if event == "CLEAR_FILTER" { state = .idle; searchText = "" }
            if event == "SELECT_NODE", let id = nodeId { state = .nodeSelected; selectedNodeId = id; onNodeSelect?(id) }
        }
        updateUI()
    }

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Interactive dependency tree viewer for packages")
    }
    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        wantsLayer = true
        rootStack.orientation = .vertical; rootStack.spacing = 6
        rootStack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(rootStack)
        NSLayoutConstraint.activate([
            rootStack.topAnchor.constraint(equalTo: topAnchor, constant: 8),
            rootStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
            rootStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
            rootStack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -8),
        ])

        searchField.placeholderString = "Search dependencies..."
        searchField.target = self; searchField.action = #selector(handleSearch(_:))
        rootStack.addArrangedSubview(searchField)

        treeScroll.hasVerticalScroller = true; treeScroll.drawsBackground = false
        treeContainer.orientation = .vertical; treeContainer.spacing = 2
        treeScroll.documentView = treeContainer
        rootStack.addArrangedSubview(treeScroll)

        detailPanel.orientation = .vertical; detailPanel.spacing = 4; detailPanel.isHidden = true
        detailNameLabel.font = .boldSystemFont(ofSize: 13)
        detailVersionLabel.font = .systemFont(ofSize: 12)
        detailFlagsLabel.font = .systemFont(ofSize: 11); detailFlagsLabel.textColor = .secondaryLabelColor
        detailPanel.addArrangedSubview(detailNameLabel)
        detailPanel.addArrangedSubview(detailVersionLabel)
        detailPanel.addArrangedSubview(detailFlagsLabel)
        rootStack.addArrangedSubview(detailPanel)
        updateUI()
    }

    func configure(nodes: [DependencyNode]) {
        self.nodes = nodes; expandedIds = Set(allIds(nodes))
        rebuildTree(); updateUI()
    }

    private func allIds(_ nodes: [DependencyNode]) -> [String] {
        var ids: [String] = []
        for n in nodes { ids.append(n.id); ids.append(contentsOf: allIds(n.children)) }
        return ids
    }

    private func rebuildTree() {
        treeContainer.arrangedSubviews.forEach { $0.removeFromSuperview() }; flatNodeIds = []
        for node in nodes { addNode(node, depth: 0) }
    }

    private func addNode(_ node: DependencyNode, depth: Int) {
        if !searchText.isEmpty && !node.name.localizedCaseInsensitiveContains(searchText) && node.children.isEmpty { return }
        flatNodeIds.append(node.id)
        let row = NSStackView(); row.orientation = .horizontal; row.spacing = 4
        row.edgeInsets = NSEdgeInsets(top: 2, left: CGFloat(depth * 16), bottom: 2, right: 4)

        let hasChildren = !node.children.isEmpty
        if hasChildren {
            let toggle = NSButton(title: expandedIds.contains(node.id) ? "\u{25BC}" : "\u{25B6}", target: self, action: #selector(handleToggle(_:)))
            toggle.bezelStyle = .roundRect; toggle.font = .systemFont(ofSize: 10)
            toggle.identifier = NSUserInterfaceItemIdentifier("toggle-\(node.id)")
            row.addArrangedSubview(toggle)
        } else { let s = NSView(); s.widthAnchor.constraint(equalToConstant: 20).isActive = true; row.addArrangedSubview(s) }

        let nameBtn = NSButton(title: "\(node.name)@\(node.version)", target: self, action: #selector(handleNodeClick(_:)))
        nameBtn.bezelStyle = .roundRect; nameBtn.identifier = NSUserInterfaceItemIdentifier(node.id)
        var flags: [String] = []
        if node.hasConflict { flags.append("\u{26A0}") }
        if node.hasVuln { flags.append("\u{1F6E1}") }
        if node.isDuplicate { flags.append("dup") }
        nameBtn.setAccessibilityLabel("\(node.name)@\(node.version) \(flags.joined(separator: " "))")
        row.addArrangedSubview(nameBtn)

        if !flags.isEmpty {
            let f = NSTextField(labelWithString: flags.joined(separator: " "))
            f.font = .systemFont(ofSize: 10); f.textColor = node.hasVuln ? .systemRed : .systemOrange
            row.addArrangedSubview(f)
        }
        treeContainer.addArrangedSubview(row)

        if hasChildren && expandedIds.contains(node.id) {
            for child in node.children { addNode(child, depth: depth + 1) }
        }
    }

    private func findNode(_ id: String, in nodes: [DependencyNode]) -> DependencyNode? {
        for n in nodes { if n.id == id { return n }; if let found = findNode(id, in: n.children) { return found } }
        return nil
    }

    private func updateUI() {
        if state == .nodeSelected, let id = selectedNodeId, let n = findNode(id, in: nodes) {
            detailPanel.isHidden = false; detailNameLabel.stringValue = n.name; detailVersionLabel.stringValue = "v\(n.version)"
            var flags: [String] = []
            if n.hasConflict { flags.append("Conflict") }; if n.hasVuln { flags.append("Vulnerability") }; if n.isDuplicate { flags.append("Duplicate") }
            detailFlagsLabel.stringValue = flags.joined(separator: ", ")
        } else { detailPanel.isHidden = true }
        setAccessibilityValue("\(flatNodeIds.count) visible nodes, \(state.rawValue)")
    }

    @objc private func handleSearch(_ sender: NSSearchField) {
        searchText = sender.stringValue
        if searchText.isEmpty { reduce("CLEAR_FILTER") } else { reduce("FILTER") }
        rebuildTree(); updateUI()
    }
    @objc private func handleNodeClick(_ sender: NSButton) { if let id = sender.identifier?.rawValue { reduce("SELECT_NODE", nodeId: id) } }
    @objc private func handleToggle(_ sender: NSButton) {
        guard let rawId = sender.identifier?.rawValue, rawId.hasPrefix("toggle-") else { return }
        let id = String(rawId.dropFirst(7))
        if expandedIds.contains(id) { expandedIds.remove(id) } else { expandedIds.insert(id) }
        rebuildTree(); updateUI()
    }

    override var acceptsFirstResponder: Bool { true }
    override func keyDown(with event: NSEvent) {
        switch event.keyCode {
        case 125: focusIndex = min(focusIndex + 1, flatNodeIds.count - 1); if focusIndex < flatNodeIds.count { reduce("SELECT_NODE", nodeId: flatNodeIds[focusIndex]) }
        case 126: focusIndex = max(focusIndex - 1, 0); if focusIndex < flatNodeIds.count { reduce("SELECT_NODE", nodeId: flatNodeIds[focusIndex]) }
        case 124: if focusIndex < flatNodeIds.count { expandedIds.insert(flatNodeIds[focusIndex]); rebuildTree(); updateUI() }
        case 123: if focusIndex < flatNodeIds.count { expandedIds.remove(flatNodeIds[focusIndex]); rebuildTree(); updateUI() }
        case 53: reduce("DESELECT")
        default: super.keyDown(with: event)
        }
    }
    deinit {}
}
