import AppKit

struct DagNode {
    let id: String
    let label: String
    var type: String?
    var status: String?
}

struct DagEdge {
    let from: String
    let to: String
    var label: String?
}

class DagViewerView: NSView {

    enum State: String { case idle, nodeSelected, computing }

    private var widgetState: State = .idle
    private var nodes: [DagNode] = []
    private var edges: [DagEdge] = []
    private var selectedNodeId: String?
    private var focusedIndex: Int = 0
    private var flatNodes: [DagNode] = []

    var onSelectNode: ((String?) -> Void)?

    private let rootStack = NSStackView()
    private let canvasStack = NSStackView()
    private let edgesStack = NSStackView()
    private let detailPanel = NSStackView()
    private let detailTitle = NSTextField(labelWithString: "")
    private let detailBody = NSTextField(wrappingLabelWithString: "")

    func reduce(_ event: String, id: String? = nil) {
        switch widgetState {
        case .idle:
            if event == "SELECT_NODE" { widgetState = .nodeSelected; selectedNodeId = id; onSelectNode?(id) }
            if event == "LAYOUT" { widgetState = .computing }
        case .nodeSelected:
            if event == "DESELECT" { widgetState = .idle; selectedNodeId = nil; onSelectNode?(nil) }
            if event == "SELECT_NODE" { selectedNodeId = id; onSelectNode?(id) }
        case .computing:
            if event == "LAYOUT_COMPLETE" { widgetState = .idle }
        }
        rebuildUI()
    }

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Dependency graph")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        wantsLayer = true
        rootStack.orientation = .vertical
        rootStack.spacing = 8
        rootStack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(rootStack)
        NSLayoutConstraint.activate([
            rootStack.topAnchor.constraint(equalTo: topAnchor, constant: 8),
            rootStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
            rootStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
            rootStack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -8),
        ])

        canvasStack.orientation = .vertical
        canvasStack.spacing = 4
        rootStack.addArrangedSubview(canvasStack)

        edgesStack.orientation = .vertical
        edgesStack.spacing = 2
        rootStack.addArrangedSubview(edgesStack)

        detailPanel.orientation = .vertical
        detailPanel.spacing = 4
        detailPanel.isHidden = true
        detailTitle.font = .systemFont(ofSize: 14, weight: .semibold)
        detailPanel.addArrangedSubview(detailTitle)
        detailPanel.addArrangedSubview(detailBody)
        rootStack.addArrangedSubview(detailPanel)
    }

    func configure(nodes: [DagNode], edges: [DagEdge]) {
        self.nodes = nodes
        self.edges = edges
        computeLayout()
        rebuildUI()
    }

    private func computeLayout() {
        var inDeg = [String: Int]()
        var adj = [String: [String]]()
        for n in nodes { inDeg[n.id] = 0; adj[n.id] = [] }
        for e in edges { inDeg[e.to, default: 0] += 1; adj[e.from]?.append(e.to) }
        var levels = [String: Int]()
        var queue = inDeg.filter { $0.value == 0 }.map { $0.key }
        for id in queue { levels[id] = 0 }
        while !queue.isEmpty {
            let cur = queue.removeFirst()
            for child in adj[cur] ?? [] {
                let nl = (levels[cur] ?? 0) + 1
                if levels[child] == nil || nl > levels[child]! { levels[child] = nl }
                inDeg[child] = (inDeg[child] ?? 1) - 1
                if inDeg[child] == 0 { queue.append(child) }
            }
        }
        for n in nodes where levels[n.id] == nil { levels[n.id] = 0 }
        let maxLvl = levels.values.max() ?? 0
        var groups = [[DagNode]](repeating: [], count: maxLvl + 1)
        for n in nodes { groups[levels[n.id] ?? 0].append(n) }
        flatNodes = groups.flatMap { $0 }
    }

    private func rebuildUI() {
        canvasStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
        edgesStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
        let nodeMap = Dictionary(uniqueKeysWithValues: nodes.map { ($0.id, $0) })

        for (i, node) in flatNodes.enumerated() {
            let btn = NSButton(title: "\(node.label) [\(node.status ?? "?")]", target: self, action: #selector(nodeClicked(_:)))
            btn.tag = i
            btn.bezelStyle = .roundRect
            if selectedNodeId == node.id {
                btn.wantsLayer = true
                btn.layer?.borderWidth = 2
                btn.layer?.borderColor = NSColor.controlAccentColor.cgColor
            }
            btn.setAccessibilityLabel("\(node.label) - \(node.status ?? "unknown")")
            canvasStack.addArrangedSubview(btn)
        }

        for edge in edges {
            let from = nodeMap[edge.from]?.label ?? edge.from
            let to = nodeMap[edge.to]?.label ?? edge.to
            var text = "\(from) \u{2192} \(to)"
            if let l = edge.label { text += " (\(l))" }
            edgesStack.addArrangedSubview(NSTextField(labelWithString: text))
        }

        if let sid = selectedNodeId, let n = nodeMap[sid] {
            detailPanel.isHidden = false
            detailTitle.stringValue = n.label
            let up = edges.filter { $0.to == sid }.compactMap { nodeMap[$0.from]?.label }
            let down = edges.filter { $0.from == sid }.compactMap { nodeMap[$0.to]?.label }
            detailBody.stringValue = "Type: \(n.type ?? "N/A")\nStatus: \(n.status ?? "unknown")\nUpstream: \(up.isEmpty ? "None" : up.joined(separator: ", "))\nDownstream: \(down.isEmpty ? "None" : down.joined(separator: ", "))"
        } else { detailPanel.isHidden = true }
    }

    @objc private func nodeClicked(_ sender: NSButton) {
        let node = flatNodes[sender.tag]
        if selectedNodeId == node.id { reduce("DESELECT") } else { reduce("SELECT_NODE", id: node.id) }
    }

    override var acceptsFirstResponder: Bool { true }

    override func keyDown(with event: NSEvent) {
        guard !flatNodes.isEmpty else { super.keyDown(with: event); return }
        switch event.keyCode {
        case 125: focusedIndex = min(focusedIndex + 1, flatNodes.count - 1)
        case 126: focusedIndex = max(focusedIndex - 1, 0)
        case 36:
            let n = flatNodes[focusedIndex]
            selectedNodeId == n.id ? reduce("DESELECT") : reduce("SELECT_NODE", id: n.id)
        case 53: reduce("DESELECT")
        default: super.keyDown(with: event)
        }
    }

    deinit {}
}
