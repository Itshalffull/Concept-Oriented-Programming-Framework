import AppKit

// MARK: - Proof goal types

struct ProofGoal {
    let id: String
    let label: String
    let status: ProofGoalStatus
    var tactic: String?
    var children: [ProofGoal]?
    var progress: Double?
}

enum ProofGoalStatus: String {
    case open, proved, failed, skipped

    var icon: String {
        switch self {
        case .proved: return "\u{2713}"
        case .failed: return "\u{2717}"
        case .open: return "\u{25CB}"
        case .skipped: return "\u{2298}"
        }
    }

    var displayLabel: String { rawValue.capitalized }
}

// MARK: - ProofSessionTreeView

class ProofSessionTreeView: NSView, NSOutlineViewDataSource, NSOutlineViewDelegate {

    enum State: String { case idle; case selected; case ready; case fetching }

    private var widgetState: State = .idle
    private var goals: [ProofGoal] = []
    private var selectedGoalId: String?
    private var expandedIds: Set<String> = []

    var onSelectGoal: ((String?) -> Void)?

    private let rootStack = NSStackView()
    private let summaryLabel = NSTextField(labelWithString: "")
    private let scrollView = NSScrollView()
    private let outlineView = NSOutlineView()
    private let detailPanel = NSStackView()
    private let detailTitle = NSTextField(labelWithString: "")
    private let detailStatusField = NSTextField(labelWithString: "")
    private let detailTacticField = NSTextField(labelWithString: "")
    private let detailProgressField = NSTextField(labelWithString: "")
    private let detailChildrenField = NSTextField(labelWithString: "")
    private let detailCloseBtn = NSButton(title: "\u{2715}", target: nil, action: nil)

    // MARK: - State machine

    func send(_ event: String, id: String? = nil) {
        switch widgetState {
        case .idle:
            if event == "SELECT" { widgetState = .selected; selectedGoalId = id; onSelectGoal?(id) }
            if event == "EXPAND" || event == "COLLAPSE" { /* stays idle */ }
        case .selected:
            if event == "DESELECT" { widgetState = .idle; selectedGoalId = nil; onSelectGoal?(nil) }
            if event == "SELECT" { selectedGoalId = id; onSelectGoal?(id) }
        case .ready:
            if event == "LOAD_CHILDREN" { widgetState = .fetching }
        case .fetching:
            if event == "LOAD_COMPLETE" || event == "LOAD_ERROR" { widgetState = .ready }
        }
        updateDetailPanel()
    }

    // MARK: - Init

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Hierarchical tree view displaying proof goals")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    // MARK: - Setup

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

        summaryLabel.font = .systemFont(ofSize: 13, weight: .medium)
        summaryLabel.setContentHuggingPriority(.defaultHigh, for: .vertical)
        rootStack.addArrangedSubview(summaryLabel)

        let column = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("goal"))
        column.title = "Goals"
        outlineView.addTableColumn(column)
        outlineView.outlineTableColumn = column
        outlineView.headerView = nil
        outlineView.dataSource = self
        outlineView.delegate = self
        outlineView.rowHeight = 28
        outlineView.target = self
        outlineView.action = #selector(outlineClicked)
        outlineView.setAccessibilityRole(.outline)

        scrollView.documentView = outlineView
        scrollView.hasVerticalScroller = true
        scrollView.autohidesScrollers = true
        rootStack.addArrangedSubview(scrollView)

        detailPanel.orientation = .vertical
        detailPanel.spacing = 4
        detailPanel.isHidden = true

        let header = NSStackView()
        header.orientation = .horizontal
        detailTitle.font = .systemFont(ofSize: 14, weight: .semibold)
        header.addArrangedSubview(detailTitle)
        let spacer = NSView()
        spacer.setContentHuggingPriority(.defaultLow, for: .horizontal)
        header.addArrangedSubview(spacer)
        detailCloseBtn.bezelStyle = .roundRect
        detailCloseBtn.target = self
        detailCloseBtn.action = #selector(closeDetail)
        detailCloseBtn.setAccessibilityLabel("Close detail panel")
        header.addArrangedSubview(detailCloseBtn)
        detailPanel.addArrangedSubview(header)

        for field in [detailStatusField, detailTacticField, detailProgressField, detailChildrenField] {
            field.font = .systemFont(ofSize: 13)
            field.isHidden = true
            detailPanel.addArrangedSubview(field)
        }
        rootStack.addArrangedSubview(detailPanel)
    }

    // MARK: - Configure

    func configure(goals: [ProofGoal], expandedIds: Set<String>? = nil) {
        self.goals = goals
        self.expandedIds = expandedIds ?? []
        updateSummary()
        outlineView.reloadData()
    }

    private func updateSummary() {
        let (total, proved) = countGoals(goals)
        summaryLabel.stringValue = "\(proved) of \(total) goals proved"
    }

    private func countGoals(_ nodes: [ProofGoal]) -> (Int, Int) {
        var total = 0, proved = 0
        for g in nodes {
            total += 1
            if g.status == .proved { proved += 1 }
            if let c = g.children { let r = countGoals(c); total += r.0; proved += r.1 }
        }
        return (total, proved)
    }

    private func findGoal(in nodes: [ProofGoal], id: String) -> ProofGoal? {
        for g in nodes {
            if g.id == id { return g }
            if let c = g.children, let found = findGoal(in: c, id: id) { return found }
        }
        return nil
    }

    private func updateDetailPanel() {
        guard let sid = selectedGoalId, let goal = findGoal(in: goals, id: sid) else {
            detailPanel.isHidden = true; return
        }
        detailPanel.isHidden = false
        detailTitle.stringValue = goal.label
        detailStatusField.stringValue = "Status: \(goal.status.icon) \(goal.status.displayLabel)"
        detailStatusField.isHidden = false
        if let t = goal.tactic { detailTacticField.stringValue = "Tactic: \(t)"; detailTacticField.isHidden = false } else { detailTacticField.isHidden = true }
        if let p = goal.progress { detailProgressField.stringValue = "Progress: \(Int(p * 100))%"; detailProgressField.isHidden = false } else { detailProgressField.isHidden = true }
        if let c = goal.children, !c.isEmpty { detailChildrenField.stringValue = "Sub-goals: \(c.count)"; detailChildrenField.isHidden = false } else { detailChildrenField.isHidden = true }
    }

    @objc private func outlineClicked() {
        let row = outlineView.clickedRow
        guard row >= 0, let wrapper = outlineView.item(atRow: row) as? GoalWrapper else { return }
        if selectedGoalId == wrapper.goal.id { send("DESELECT") } else { send("SELECT", id: wrapper.goal.id) }
    }

    @objc private func closeDetail() { send("DESELECT") }

    override var acceptsFirstResponder: Bool { true }
    override func keyDown(with event: NSEvent) {
        if event.keyCode == 53 { send("DESELECT") } else { super.keyDown(with: event) }
    }

    // MARK: - Outline data source wrapper

    private class GoalWrapper: NSObject {
        let goal: ProofGoal
        init(_ goal: ProofGoal) { self.goal = goal }
        override func isEqual(_ object: Any?) -> Bool { (object as? GoalWrapper)?.goal.id == goal.id }
        override var hash: Int { goal.id.hashValue }
    }

    func outlineView(_ outlineView: NSOutlineView, numberOfChildrenOfItem item: Any?) -> Int {
        if item == nil { return goals.count }
        return (item as? GoalWrapper)?.goal.children?.count ?? 0
    }

    func outlineView(_ outlineView: NSOutlineView, child index: Int, ofItem item: Any?) -> Any {
        if item == nil { return GoalWrapper(goals[index]) }
        return GoalWrapper((item as! GoalWrapper).goal.children![index])
    }

    func outlineView(_ outlineView: NSOutlineView, isItemExpandable item: Any) -> Bool {
        ((item as? GoalWrapper)?.goal.children?.count ?? 0) > 0
    }

    func outlineView(_ outlineView: NSOutlineView, viewFor tableColumn: NSTableColumn?, item: Any) -> NSView? {
        guard let wrapper = item as? GoalWrapper else { return nil }
        let goal = wrapper.goal
        let row = NSStackView()
        row.orientation = .horizontal
        row.spacing = 6
        row.addArrangedSubview(NSTextField(labelWithString: goal.status.icon))
        let name = NSTextField(labelWithString: goal.label)
        name.font = .systemFont(ofSize: 13)
        name.lineBreakMode = .byTruncatingTail
        row.addArrangedSubview(name)
        if let p = goal.progress {
            let pct = NSTextField(labelWithString: "\(Int(p * 100))%")
            pct.font = .systemFont(ofSize: 11); pct.textColor = .secondaryLabelColor
            row.addArrangedSubview(pct)
        }
        row.setAccessibilityLabel("\(goal.label) - \(goal.status.displayLabel)")
        if selectedGoalId == goal.id {
            row.wantsLayer = true
            row.layer?.backgroundColor = NSColor.selectedContentBackgroundColor.withAlphaComponent(0.2).cgColor
        }
        return row
    }

    deinit {}
}
