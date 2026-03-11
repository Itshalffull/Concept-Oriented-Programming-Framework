import AppKit

class EvalResultsTableView: NSView {

    enum State: String { case idle; case rowSelected }

    struct TestCase {
        let id: String
        let input: String
        let expected: String
        let actual: String
        let score: Int
        let pass: Bool
        let metrics: [String: Int]
    }

    private(set) var state: State = .idle
    private var testCases: [TestCase] = []
    private var overallScore: Int = 0
    private var passCount: Int = 0
    private var failCount: Int = 0
    private var selectedId: String? = nil
    private var focusIndex: Int = 0
    private var sortColumn: String = "score"
    private var sortAscending: Bool = false
    private var activeFilter: String? = nil

    var onSelect: ((TestCase) -> Void)?

    private let rootStack = NSStackView()

    // Summary bar
    private let summaryStack = NSStackView()
    private let scoreLabel = NSTextField(labelWithString: "")
    private let passLabel = NSTextField(labelWithString: "")
    private let failLabel = NSTextField(labelWithString: "")
    private let passFailBar = NSStackView()
    private let passSegment = NSView()
    private let failSegment = NSView()

    // Filter bar
    private let filterStack = NSStackView()
    private let filterAll = NSButton(title: "All", target: nil, action: nil)
    private let filterPass = NSButton(title: "Pass", target: nil, action: nil)
    private let filterFail = NSButton(title: "Fail", target: nil, action: nil)

    // Table
    private let tableScroll = NSScrollView()
    private let tableHeader = NSStackView()
    private let tableContainer = NSStackView()

    // Detail panel
    private let detailScroll = NSScrollView()
    private let detailContainer = NSStackView()
    private let detailCloseBtn = NSButton(title: "\u{2715}", target: nil, action: nil)

    func reduce(_ event: String, testId: String? = nil) {
        switch state {
        case .idle:
            if event == "SELECT_ROW", let id = testId { state = .rowSelected; selectedId = id }
            if event == "SORT" { /* stay idle */ }
            if event == "FILTER" { /* stay idle */ }
        case .rowSelected:
            if event == "DESELECT" { state = .idle; selectedId = nil }
            if event == "SELECT_ROW", let id = testId { selectedId = id }
        }
        updateUI()
    }

    override init(frame: NSRect) {
        super.init(frame: frame); setupSubviews()
        setAccessibilityRole(.group); setAccessibilityLabel("Results table for LLM evaluation runs showing test cases with pass/fail status")
    }
    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        wantsLayer = true
        rootStack.orientation = .vertical; rootStack.spacing = 8
        rootStack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(rootStack)
        NSLayoutConstraint.activate([
            rootStack.topAnchor.constraint(equalTo: topAnchor, constant: 8),
            rootStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
            rootStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
            rootStack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -8),
        ])

        // Summary bar
        summaryStack.orientation = .horizontal; summaryStack.spacing = 12
        scoreLabel.font = .boldSystemFont(ofSize: 18)
        passLabel.font = .systemFont(ofSize: 12); passLabel.textColor = .systemGreen
        failLabel.font = .systemFont(ofSize: 12); failLabel.textColor = .systemRed
        summaryStack.addArrangedSubview(scoreLabel); summaryStack.addArrangedSubview(passLabel); summaryStack.addArrangedSubview(failLabel)
        rootStack.addArrangedSubview(summaryStack)

        // Pass/fail bar
        passFailBar.orientation = .horizontal; passFailBar.spacing = 0
        passFailBar.wantsLayer = true; passFailBar.layer?.cornerRadius = 4
        passFailBar.heightAnchor.constraint(equalToConstant: 8).isActive = true
        passSegment.wantsLayer = true; passSegment.layer?.backgroundColor = NSColor.systemGreen.cgColor
        failSegment.wantsLayer = true; failSegment.layer?.backgroundColor = NSColor.systemRed.cgColor
        passFailBar.addArrangedSubview(passSegment); passFailBar.addArrangedSubview(failSegment)
        rootStack.addArrangedSubview(passFailBar)

        // Filter bar
        filterStack.orientation = .horizontal; filterStack.spacing = 6
        filterAll.bezelStyle = .roundRect; filterAll.target = self; filterAll.action = #selector(handleFilterAll(_:))
        filterPass.bezelStyle = .roundRect; filterPass.target = self; filterPass.action = #selector(handleFilterPass(_:))
        filterFail.bezelStyle = .roundRect; filterFail.target = self; filterFail.action = #selector(handleFilterFail(_:))
        filterStack.addArrangedSubview(filterAll); filterStack.addArrangedSubview(filterPass); filterStack.addArrangedSubview(filterFail)
        rootStack.addArrangedSubview(filterStack)

        // Table header
        tableHeader.orientation = .horizontal; tableHeader.spacing = 4
        let columns = ["Status", "Input", "Output", "Expected", "Score"]
        for (i, col) in columns.enumerated() {
            let btn = NSButton(title: col, target: self, action: #selector(handleSortClick(_:)))
            btn.bezelStyle = .roundRect; btn.tag = i
            btn.setAccessibilityLabel("Sort by \(col)")
            tableHeader.addArrangedSubview(btn)
        }
        rootStack.addArrangedSubview(tableHeader)

        // Table scroll
        tableScroll.hasVerticalScroller = true; tableScroll.drawsBackground = false
        tableContainer.orientation = .vertical; tableContainer.spacing = 2
        tableScroll.documentView = tableContainer
        rootStack.addArrangedSubview(tableScroll)

        // Detail panel
        detailScroll.hasVerticalScroller = true; detailScroll.drawsBackground = false
        detailContainer.orientation = .vertical; detailContainer.spacing = 6
        detailScroll.documentView = detailContainer
        detailScroll.isHidden = true
        detailCloseBtn.bezelStyle = .roundRect; detailCloseBtn.target = self; detailCloseBtn.action = #selector(handleCloseDetail(_:))
        rootStack.addArrangedSubview(detailScroll)

        updateUI()
    }

    func configure(testCases: [TestCase], overallScore: Int, passCount: Int, failCount: Int) {
        self.testCases = testCases; self.overallScore = overallScore
        self.passCount = passCount; self.failCount = failCount
        rebuildTable(); updateUI()
    }

    private func filteredCases() -> [TestCase] {
        guard let filter = activeFilter else { return testCases }
        if filter == "pass" { return testCases.filter { $0.pass } }
        if filter == "fail" { return testCases.filter { !$0.pass } }
        return testCases
    }

    private func sortedCases() -> [TestCase] {
        let cases = filteredCases()
        return cases.sorted { a, b in
            let cmp: Int
            switch sortColumn {
            case "score": cmp = a.score - b.score
            case "status": cmp = (a.pass ? 1 : 0) - (b.pass ? 1 : 0)
            case "input": cmp = a.input.localizedCaseInsensitiveCompare(b.input) == .orderedAscending ? -1 : 1
            case "output": cmp = a.actual.localizedCaseInsensitiveCompare(b.actual) == .orderedAscending ? -1 : 1
            case "expected": cmp = a.expected.localizedCaseInsensitiveCompare(b.expected) == .orderedAscending ? -1 : 1
            default: cmp = 0
            }
            return sortAscending ? cmp < 0 : cmp > 0
        }
    }

    private func truncate(_ text: String, max: Int = 60) -> String {
        if text.count <= max { return text }
        return String(text.prefix(max - 3)) + "..."
    }

    private func rebuildTable() {
        tableContainer.arrangedSubviews.forEach { $0.removeFromSuperview() }
        let sorted = sortedCases()

        for (i, tc) in sorted.enumerated() {
            let row = NSStackView(); row.orientation = .horizontal; row.spacing = 4
            row.wantsLayer = true
            if selectedId == tc.id { row.layer?.backgroundColor = NSColor.controlAccentColor.withAlphaComponent(0.1).cgColor }

            // Status
            let statusLabel = NSTextField(labelWithString: tc.pass ? "\u{2713} Pass" : "\u{2717} Fail")
            statusLabel.font = .boldSystemFont(ofSize: 11)
            statusLabel.textColor = tc.pass ? .systemGreen : .systemRed
            statusLabel.widthAnchor.constraint(equalToConstant: 60).isActive = true
            row.addArrangedSubview(statusLabel)

            // Input
            let inputBtn = NSButton(title: truncate(tc.input), target: self, action: #selector(handleRowClick(_:)))
            inputBtn.bezelStyle = .roundRect; inputBtn.tag = i
            inputBtn.toolTip = tc.input
            row.addArrangedSubview(inputBtn)

            // Output
            let outputLabel = NSTextField(labelWithString: truncate(tc.actual))
            outputLabel.font = .systemFont(ofSize: 11); outputLabel.toolTip = tc.actual
            row.addArrangedSubview(outputLabel)

            // Expected
            let expectedLabel = NSTextField(labelWithString: truncate(tc.expected))
            expectedLabel.font = .systemFont(ofSize: 11); expectedLabel.textColor = .secondaryLabelColor; expectedLabel.toolTip = tc.expected
            row.addArrangedSubview(expectedLabel)

            // Score
            let scoreLabel = NSTextField(labelWithString: "\(tc.score)")
            scoreLabel.font = .monospacedDigitSystemFont(ofSize: 11, weight: .regular)
            scoreLabel.widthAnchor.constraint(equalToConstant: 40).isActive = true
            row.addArrangedSubview(scoreLabel)

            row.setAccessibilityLabel("\(tc.pass ? "Pass" : "Fail"): \(truncate(tc.input, max: 40)), score \(tc.score)")
            tableContainer.addArrangedSubview(row)
        }

        if sorted.isEmpty {
            let emptyLabel = NSTextField(labelWithString: "No test cases match the current filter")
            emptyLabel.font = .systemFont(ofSize: 12); emptyLabel.textColor = .secondaryLabelColor; emptyLabel.alignment = .center
            tableContainer.addArrangedSubview(emptyLabel)
        }
    }

    private func rebuildDetail() {
        detailContainer.arrangedSubviews.forEach { $0.removeFromSuperview() }
        guard let id = selectedId, let tc = sortedCases().first(where: { $0.id == id }) else {
            detailScroll.isHidden = true; return
        }
        detailScroll.isHidden = false

        // Header
        let header = NSStackView(); header.orientation = .horizontal; header.spacing = 8
        let statusLabel = NSTextField(labelWithString: tc.pass ? "\u{2713} Passed" : "\u{2717} Failed")
        statusLabel.font = .boldSystemFont(ofSize: 13); statusLabel.textColor = tc.pass ? .systemGreen : .systemRed
        let scoreLabel = NSTextField(labelWithString: "Score: \(tc.score)")
        scoreLabel.font = .systemFont(ofSize: 12)
        header.addArrangedSubview(statusLabel); header.addArrangedSubview(scoreLabel); header.addArrangedSubview(detailCloseBtn)
        detailContainer.addArrangedSubview(header)

        // Input section
        addDetailSection("Input", tc.input)
        addDetailSection("Model Output", tc.actual)
        addDetailSection("Expected Output", tc.expected)

        // Diff
        if tc.actual != tc.expected {
            let diffHeader = NSTextField(labelWithString: "Diff")
            diffHeader.font = .boldSystemFont(ofSize: 12)
            detailContainer.addArrangedSubview(diffHeader)
            let diffExpected = NSTextField(labelWithString: "- \(tc.expected)")
            diffExpected.font = .monospacedSystemFont(ofSize: 11, weight: .regular); diffExpected.textColor = .systemRed
            let diffActual = NSTextField(labelWithString: "+ \(tc.actual)")
            diffActual.font = .monospacedSystemFont(ofSize: 11, weight: .regular); diffActual.textColor = .systemGreen
            detailContainer.addArrangedSubview(diffExpected); detailContainer.addArrangedSubview(diffActual)
        }

        // Metrics
        if !tc.metrics.isEmpty {
            let metricsHeader = NSTextField(labelWithString: "Metrics")
            metricsHeader.font = .boldSystemFont(ofSize: 12)
            detailContainer.addArrangedSubview(metricsHeader)
            for (metric, value) in tc.metrics {
                let metricRow = NSStackView(); metricRow.orientation = .horizontal; metricRow.spacing = 8
                let nameLabel = NSTextField(labelWithString: metric)
                nameLabel.font = .systemFont(ofSize: 11)
                let valueLabel = NSTextField(labelWithString: "\(value)")
                valueLabel.font = .monospacedDigitSystemFont(ofSize: 11, weight: .regular)
                let bar = NSProgressIndicator()
                bar.isIndeterminate = false; bar.minValue = 0; bar.maxValue = 100; bar.doubleValue = Double(min(100, value))
                bar.style = .bar
                metricRow.addArrangedSubview(nameLabel); metricRow.addArrangedSubview(valueLabel); metricRow.addArrangedSubview(bar)
                detailContainer.addArrangedSubview(metricRow)
            }
        }
    }

    private func addDetailSection(_ title: String, _ content: String) {
        let label = NSTextField(labelWithString: title)
        label.font = .boldSystemFont(ofSize: 12)
        detailContainer.addArrangedSubview(label)
        let contentLabel = NSTextField(wrappingLabelWithString: content)
        contentLabel.font = .monospacedSystemFont(ofSize: 11, weight: .regular)
        detailContainer.addArrangedSubview(contentLabel)
    }

    private func updateUI() {
        let total = passCount + failCount
        let passPct = total > 0 ? Int(Double(passCount) / Double(total) * 100) : 0
        scoreLabel.stringValue = "\(overallScore)%"
        passLabel.stringValue = "\(passCount) passed"
        failLabel.stringValue = "\(failCount) failed"

        // Update pass/fail bar widths via constraints
        passSegment.widthAnchor.constraint(equalTo: passFailBar.widthAnchor, multiplier: max(0.01, CGFloat(passPct) / 100.0)).isActive = true

        filterAll.title = "All (\(testCases.count))"
        filterPass.title = "Pass (\(passCount))"
        filterFail.title = "Fail (\(failCount))"

        rebuildTable()
        rebuildDetail()
        setAccessibilityValue("\(sortedCases().count) results, \(state.rawValue)")
    }

    @objc private func handleFilterAll(_ sender: NSButton) { activeFilter = nil; reduce("FILTER") }
    @objc private func handleFilterPass(_ sender: NSButton) {
        activeFilter = activeFilter == "pass" ? nil : "pass"; reduce("FILTER")
    }
    @objc private func handleFilterFail(_ sender: NSButton) {
        activeFilter = activeFilter == "fail" ? nil : "fail"; reduce("FILTER")
    }
    @objc private func handleSortClick(_ sender: NSButton) {
        let columns = ["status", "input", "output", "expected", "score"]
        let col = columns[sender.tag]
        if sortColumn == col { sortAscending.toggle() } else { sortColumn = col; sortAscending = false }
        reduce("SORT")
    }
    @objc private func handleRowClick(_ sender: NSButton) {
        let sorted = sortedCases(); let idx = sender.tag; guard idx < sorted.count else { return }
        let tc = sorted[idx]
        if selectedId == tc.id { reduce("DESELECT") }
        else { reduce("SELECT_ROW", testId: tc.id); onSelect?(tc) }
    }
    @objc private func handleCloseDetail(_ sender: NSButton) { reduce("DESELECT") }

    override var acceptsFirstResponder: Bool { true }
    override func keyDown(with event: NSEvent) {
        let sorted = sortedCases()
        switch event.keyCode {
        case 125: // down
            focusIndex = min(focusIndex + 1, sorted.count - 1)
        case 126: // up
            focusIndex = max(focusIndex - 1, 0)
        case 36: // enter
            if focusIndex < sorted.count {
                let tc = sorted[focusIndex]
                if selectedId == tc.id { reduce("DESELECT") }
                else { reduce("SELECT_ROW", testId: tc.id); onSelect?(tc) }
            }
        case 53: // escape
            reduce("DESELECT")
        default: super.keyDown(with: event)
        }
    }
    deinit {}
}
