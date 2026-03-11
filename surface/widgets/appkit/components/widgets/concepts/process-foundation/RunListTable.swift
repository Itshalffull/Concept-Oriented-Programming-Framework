import AppKit

class RunListTableView: NSView {

    enum State: String { case idle; case rowSelected }

    struct Run {
        let id: String
        let name: String
        let status: String
        let startTime: String
        let duration: String
        let outcome: String
    }

    private(set) var state: State = .idle
    private var runs: [Run] = []
    private var selectedRunId: String? = nil
    private var focusIndex: Int = 0
    private var filterStatus: String? = nil

    var onRunSelect: ((String) -> Void)?

    private let rootStack = NSStackView()
    private let filterPopup = NSPopUpButton()
    private let tableScroll = NSScrollView()
    private let tableContainer = NSStackView()

    func reduce(_ event: String, runId: String? = nil) {
        switch state {
        case .idle:
            if event == "SELECT_ROW", let id = runId { state = .rowSelected; selectedRunId = id; onRunSelect?(id) }
        case .rowSelected:
            if event == "DESELECT" { state = .idle; selectedRunId = nil }
            if event == "SELECT_ROW", let id = runId { selectedRunId = id; onRunSelect?(id) }
        }
        updateUI()
    }

    override init(frame: NSRect) {
        super.init(frame: frame); setupSubviews()
        setAccessibilityRole(.group); setAccessibilityLabel("Table listing process runs")
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

        filterPopup.addItems(withTitles: ["All", "Running", "Completed", "Failed"])
        filterPopup.target = self; filterPopup.action = #selector(handleFilter(_:))
        rootStack.addArrangedSubview(filterPopup)

        // Header row
        let header = NSStackView(); header.orientation = .horizontal; header.spacing = 8
        for title in ["Status", "Name", "Started", "Duration", "Outcome"] {
            let lbl = NSTextField(labelWithString: title); lbl.font = .boldSystemFont(ofSize: 11)
            lbl.widthAnchor.constraint(equalToConstant: 80).isActive = true
            header.addArrangedSubview(lbl)
        }
        rootStack.addArrangedSubview(header)

        tableScroll.hasVerticalScroller = true; tableScroll.drawsBackground = false
        tableContainer.orientation = .vertical; tableContainer.spacing = 2
        tableScroll.documentView = tableContainer
        rootStack.addArrangedSubview(tableScroll)
        updateUI()
    }

    func configure(runs: [Run]) {
        self.runs = runs; rebuildTable(); updateUI()
    }

    private func filteredRuns() -> [Run] {
        guard let filter = filterStatus, filter != "All" else { return runs }
        return runs.filter { $0.status.lowercased() == filter.lowercased() }
    }

    private func rebuildTable() {
        tableContainer.arrangedSubviews.forEach { $0.removeFromSuperview() }
        for (i, run) in filteredRuns().enumerated() {
            let row = NSStackView(); row.orientation = .horizontal; row.spacing = 8
            row.wantsLayer = true
            if selectedRunId == run.id { row.layer?.backgroundColor = NSColor.controlAccentColor.withAlphaComponent(0.1).cgColor }

            let statusLabel = NSTextField(labelWithString: run.status)
            statusLabel.font = .boldSystemFont(ofSize: 11); statusLabel.widthAnchor.constraint(equalToConstant: 80).isActive = true
            switch run.status.lowercased() {
            case "running": statusLabel.textColor = .systemBlue
            case "completed": statusLabel.textColor = .systemGreen
            case "failed": statusLabel.textColor = .systemRed
            default: statusLabel.textColor = .secondaryLabelColor
            }
            row.addArrangedSubview(statusLabel)

            let nameBtn = NSButton(title: run.name, target: self, action: #selector(handleRowClick(_:)))
            nameBtn.bezelStyle = .roundRect; nameBtn.tag = i
            nameBtn.widthAnchor.constraint(equalToConstant: 80).isActive = true
            row.addArrangedSubview(nameBtn)

            for value in [run.startTime, run.duration, run.outcome] {
                let lbl = NSTextField(labelWithString: value); lbl.font = .systemFont(ofSize: 11)
                lbl.widthAnchor.constraint(equalToConstant: 80).isActive = true
                row.addArrangedSubview(lbl)
            }

            row.setAccessibilityLabel("\(run.name): \(run.status), \(run.outcome)")
            tableContainer.addArrangedSubview(row)
        }
    }

    private func updateUI() { setAccessibilityValue("\(filteredRuns().count) runs, \(state.rawValue)") }

    @objc private func handleFilter(_ sender: NSPopUpButton) {
        filterStatus = sender.titleOfSelectedItem; rebuildTable(); updateUI()
    }
    @objc private func handleRowClick(_ sender: NSButton) {
        let filtered = filteredRuns(); let idx = sender.tag; guard idx < filtered.count else { return }
        reduce("SELECT_ROW", runId: filtered[idx].id)
    }

    override var acceptsFirstResponder: Bool { true }
    override func keyDown(with event: NSEvent) {
        let filtered = filteredRuns()
        switch event.keyCode {
        case 125: focusIndex = min(focusIndex + 1, filtered.count - 1); if focusIndex < filtered.count { reduce("SELECT_ROW", runId: filtered[focusIndex].id) }
        case 126: focusIndex = max(focusIndex - 1, 0); if focusIndex < filtered.count { reduce("SELECT_ROW", runId: filtered[focusIndex].id) }
        case 53: reduce("DESELECT")
        default: super.keyDown(with: event)
        }
    }
    deinit {}
}
