// ============================================================
// Clef Surface AppKit Widget — GraphAnalysisPanel
//
// Analysis panel for running graph algorithms on canvas data.
// Composes ClefCanvasPanelView to provide category selection,
// algorithm picker, execution controls, results table, overlay
// toggles, and report generation.
// ============================================================

import AppKit

public enum ClefGraphWorkflowState: String {
    case idle = "idle"
    case configuring = "configuring"
    case running = "running"
    case showingResults = "showingResults"
    case showingReport = "showingReport"
    case comparing = "comparing"
}

public class ClefGraphAnalysisPanelView: NSView, NSTableViewDataSource, NSTableViewDelegate {
    public var canvasId: String = "" { didSet { panelView.canvasId = canvasId } }
    public var selectedCategory: String = "centrality" { didSet { updateAlgorithmList() } }
    public var selectedAlgorithm: String? = nil
    public var workflowState: ClefGraphWorkflowState = .idle { didSet { updateWorkflowState() } }
    public var overlaysEnabled: Bool = false { didSet { masterOverlaySwitch.state = overlaysEnabled ? .on : .off } }
    public var reportFormat: String = "summary"
    public var onRun: ((String, String?) -> Void)?
    public var onOverlayToggle: ((String, Bool) -> Void)?
    public var onGenerateReport: ((String) -> Void)?
    public var onExport: (() -> Void)?
    public var onCompare: (() -> Void)?

    // Composed panel
    private let panelView = ClefCanvasPanelView()

    // Category selector
    private let categorySegment = NSSegmentedControl()

    // Algorithm picker
    private let algorithmLabel = NSTextField(labelWithString: "Algorithm:")
    private let algorithmPopUp = NSPopUpButton(frame: .zero, pullsDown: false)

    // Run controls
    private let runButton = NSButton()
    private let progressIndicator = NSProgressIndicator()

    // Results table
    private let resultsLabel = NSTextField(labelWithString: "Results")
    private let resultsScrollView = NSScrollView()
    private let resultsTable = NSTableView()
    private var resultsData: [(rank: Int, node: String, score: Double)] = []

    // Overlay controls
    private let overlayLabel = NSTextField(labelWithString: "Overlays")
    private let masterOverlaySwitch = NSSwitch()
    private let overlayStack = NSStackView()
    private var overlaySwitches: [NSSwitch] = []
    private let overlayNames = ["Heatmap", "Labels", "Edges", "Clusters"]

    // Report controls
    private let reportFormatPopUp = NSPopUpButton(frame: .zero, pullsDown: false)
    private let generateReportButton = NSButton()
    private let compareButton = NSButton()

    // Algorithm catalog per category
    private let algorithmCatalog: [String: [String]] = [
        "centrality": ["Degree", "Betweenness", "Closeness", "Eigenvector", "PageRank"],
        "community": ["Louvain", "Label Propagation", "Girvan-Newman", "Modularity"],
        "pathfinding": ["Dijkstra", "A*", "Bellman-Ford", "Floyd-Warshall"],
        "clustering": ["K-Means", "DBSCAN", "Hierarchical", "Spectral"],
        "flow": ["Max Flow", "Min Cut", "Ford-Fulkerson", "Push-Relabel"],
        "similarity": ["Jaccard", "Cosine", "Overlap", "Adamic-Adar"],
        "layout": ["Force-Directed", "Hierarchical", "Circular", "Spectral"],
    ]

    private let categoryLabels = ["Centrality", "Community", "Pathfinding", "Clustering", "Flow", "Similarity", "Layout"]
    private let categoryKeys = ["centrality", "community", "pathfinding", "clustering", "flow", "similarity", "layout"]

    public override init(frame frameRect: NSRect) { super.init(frame: frameRect); setup() }
    required init?(coder: NSCoder) { super.init(coder: coder); setup() }

    private func setup() {
        wantsLayer = true
        translatesAutoresizingMaskIntoConstraints = false

        // Composed panel
        panelView.panelTitle = "Graph Analysis"
        panelView.defaultWidth = 340
        panelView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(panelView)

        NSLayoutConstraint.activate([
            panelView.topAnchor.constraint(equalTo: topAnchor),
            panelView.leadingAnchor.constraint(equalTo: leadingAnchor),
            panelView.trailingAnchor.constraint(equalTo: trailingAnchor),
            panelView.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        let content = panelView.contentView
        buildCategorySelector(in: content)
        buildAlgorithmPicker(in: content)
        buildRunControls(in: content)
        buildResultsTable(in: content)
        buildOverlayControls(in: content)
        buildReportControls(in: content)

        setAccessibilityRole(.group)
        setAccessibilityLabel("Graph analysis panel")
        updateAlgorithmList()
        updateWorkflowState()
    }

    // MARK: — Category Selector

    private func buildCategorySelector(in container: NSView) {
        let label = NSTextField(labelWithString: "Category")
        label.font = NSFont.systemFont(ofSize: 11, weight: .medium)
        label.textColor = .secondaryLabelColor
        label.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(label)

        categorySegment.segmentCount = categoryLabels.count
        for (i, title) in categoryLabels.enumerated() {
            categorySegment.setLabel(title, forSegment: i)
            categorySegment.setWidth(0, forSegment: i)
        }
        categorySegment.selectedSegment = 0
        categorySegment.segmentStyle = .rounded
        categorySegment.target = self
        categorySegment.action = #selector(categoryChanged(_:))
        categorySegment.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(categorySegment)

        NSLayoutConstraint.activate([
            label.topAnchor.constraint(equalTo: container.topAnchor, constant: 8),
            label.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 12),

            categorySegment.topAnchor.constraint(equalTo: label.bottomAnchor, constant: 4),
            categorySegment.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 12),
            categorySegment.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -12),
        ])
    }

    // MARK: — Algorithm Picker

    private func buildAlgorithmPicker(in container: NSView) {
        algorithmLabel.font = NSFont.systemFont(ofSize: 11, weight: .medium)
        algorithmLabel.textColor = .secondaryLabelColor
        algorithmLabel.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(algorithmLabel)

        algorithmPopUp.target = self
        algorithmPopUp.action = #selector(algorithmChanged(_:))
        algorithmPopUp.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(algorithmPopUp)

        NSLayoutConstraint.activate([
            algorithmLabel.topAnchor.constraint(equalTo: categorySegment.bottomAnchor, constant: 16),
            algorithmLabel.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 12),

            algorithmPopUp.topAnchor.constraint(equalTo: algorithmLabel.bottomAnchor, constant: 4),
            algorithmPopUp.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 12),
            algorithmPopUp.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -12),
        ])
    }

    // MARK: — Run Controls

    private func buildRunControls(in container: NSView) {
        runButton.title = "Run Analysis"
        runButton.bezelStyle = .rounded
        runButton.controlSize = .regular
        runButton.target = self
        runButton.action = #selector(runAnalysis(_:))
        runButton.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(runButton)

        progressIndicator.style = .spinning
        progressIndicator.controlSize = .small
        progressIndicator.isIndeterminate = true
        progressIndicator.isHidden = true
        progressIndicator.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(progressIndicator)

        NSLayoutConstraint.activate([
            runButton.topAnchor.constraint(equalTo: algorithmPopUp.bottomAnchor, constant: 12),
            runButton.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 12),

            progressIndicator.centerYAnchor.constraint(equalTo: runButton.centerYAnchor),
            progressIndicator.leadingAnchor.constraint(equalTo: runButton.trailingAnchor, constant: 8),
            progressIndicator.widthAnchor.constraint(equalToConstant: 16),
            progressIndicator.heightAnchor.constraint(equalToConstant: 16),
        ])
    }

    // MARK: — Results Table

    private func buildResultsTable(in container: NSView) {
        resultsLabel.font = NSFont.systemFont(ofSize: 12, weight: .semibold)
        resultsLabel.textColor = .labelColor
        resultsLabel.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(resultsLabel)

        let rankColumn = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("rank"))
        rankColumn.title = "Rank"
        rankColumn.width = 40
        rankColumn.minWidth = 30
        resultsTable.addTableColumn(rankColumn)

        let nodeColumn = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("node"))
        nodeColumn.title = "Node"
        nodeColumn.width = 140
        nodeColumn.minWidth = 80
        resultsTable.addTableColumn(nodeColumn)

        let scoreColumn = NSTableColumn(identifier: NSUserInterfaceItemIdentifier("score"))
        scoreColumn.title = "Score"
        scoreColumn.width = 80
        scoreColumn.minWidth = 50
        resultsTable.addTableColumn(scoreColumn)

        resultsTable.dataSource = self
        resultsTable.delegate = self
        resultsTable.usesAlternatingRowBackgroundColors = true
        resultsTable.rowHeight = 20
        resultsTable.headerView = NSTableHeaderView()
        resultsTable.style = .plain

        resultsScrollView.hasVerticalScroller = true
        resultsScrollView.autohidesScrollers = true
        resultsScrollView.borderType = .bezelBorder
        resultsScrollView.documentView = resultsTable
        resultsScrollView.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(resultsScrollView)

        NSLayoutConstraint.activate([
            resultsLabel.topAnchor.constraint(equalTo: runButton.bottomAnchor, constant: 16),
            resultsLabel.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 12),

            resultsScrollView.topAnchor.constraint(equalTo: resultsLabel.bottomAnchor, constant: 4),
            resultsScrollView.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 12),
            resultsScrollView.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -12),
            resultsScrollView.heightAnchor.constraint(equalToConstant: 160),
        ])
    }

    // MARK: — Overlay Controls

    private func buildOverlayControls(in container: NSView) {
        overlayLabel.font = NSFont.systemFont(ofSize: 12, weight: .semibold)
        overlayLabel.textColor = .labelColor
        overlayLabel.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(overlayLabel)

        masterOverlaySwitch.state = overlaysEnabled ? .on : .off
        masterOverlaySwitch.target = self
        masterOverlaySwitch.action = #selector(masterOverlayChanged(_:))
        masterOverlaySwitch.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(masterOverlaySwitch)

        overlayStack.orientation = .vertical
        overlayStack.alignment = .leading
        overlayStack.spacing = 6
        overlayStack.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(overlayStack)

        for name in overlayNames {
            let row = NSStackView()
            row.orientation = .horizontal
            row.spacing = 8
            row.translatesAutoresizingMaskIntoConstraints = false

            let toggle = NSSwitch()
            toggle.state = .off
            toggle.controlSize = .mini
            toggle.target = self
            toggle.action = #selector(overlayToggleChanged(_:))
            toggle.translatesAutoresizingMaskIntoConstraints = false
            overlaySwitches.append(toggle)

            let lbl = NSTextField(labelWithString: name)
            lbl.font = NSFont.systemFont(ofSize: 11)
            lbl.translatesAutoresizingMaskIntoConstraints = false

            row.addArrangedSubview(toggle)
            row.addArrangedSubview(lbl)
            overlayStack.addArrangedSubview(row)
        }

        NSLayoutConstraint.activate([
            overlayLabel.topAnchor.constraint(equalTo: resultsScrollView.bottomAnchor, constant: 16),
            overlayLabel.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 12),

            masterOverlaySwitch.centerYAnchor.constraint(equalTo: overlayLabel.centerYAnchor),
            masterOverlaySwitch.leadingAnchor.constraint(equalTo: overlayLabel.trailingAnchor, constant: 8),

            overlayStack.topAnchor.constraint(equalTo: overlayLabel.bottomAnchor, constant: 8),
            overlayStack.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 12),
            overlayStack.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -12),
        ])
    }

    // MARK: — Report Controls

    private func buildReportControls(in container: NSView) {
        let reportLabel = NSTextField(labelWithString: "Report Format:")
        reportLabel.font = NSFont.systemFont(ofSize: 11, weight: .medium)
        reportLabel.textColor = .secondaryLabelColor
        reportLabel.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(reportLabel)

        reportFormatPopUp.addItems(withTitles: ["Summary", "Detailed", "CSV", "JSON"])
        reportFormatPopUp.target = self
        reportFormatPopUp.action = #selector(reportFormatChanged(_:))
        reportFormatPopUp.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(reportFormatPopUp)

        generateReportButton.title = "Generate Report"
        generateReportButton.bezelStyle = .rounded
        generateReportButton.controlSize = .regular
        generateReportButton.target = self
        generateReportButton.action = #selector(generateReport(_:))
        generateReportButton.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(generateReportButton)

        compareButton.title = "Compare"
        compareButton.bezelStyle = .rounded
        compareButton.controlSize = .regular
        compareButton.target = self
        compareButton.action = #selector(compareResults(_:))
        compareButton.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(compareButton)

        NSLayoutConstraint.activate([
            reportLabel.topAnchor.constraint(equalTo: overlayStack.bottomAnchor, constant: 16),
            reportLabel.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 12),

            reportFormatPopUp.topAnchor.constraint(equalTo: reportLabel.bottomAnchor, constant: 4),
            reportFormatPopUp.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 12),
            reportFormatPopUp.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -12),

            generateReportButton.topAnchor.constraint(equalTo: reportFormatPopUp.bottomAnchor, constant: 8),
            generateReportButton.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 12),

            compareButton.centerYAnchor.constraint(equalTo: generateReportButton.centerYAnchor),
            compareButton.leadingAnchor.constraint(equalTo: generateReportButton.trailingAnchor, constant: 8),

            compareButton.bottomAnchor.constraint(lessThanOrEqualTo: container.bottomAnchor, constant: -12),
        ])
    }

    // MARK: — State Management

    private func updateAlgorithmList() {
        algorithmPopUp.removeAllItems()
        let key = selectedCategory
        if let algorithms = algorithmCatalog[key] {
            algorithmPopUp.addItems(withTitles: algorithms)
        }
        selectedAlgorithm = algorithmPopUp.titleOfSelectedItem
    }

    private func updateWorkflowState() {
        switch workflowState {
        case .idle:
            runButton.isEnabled = true
            progressIndicator.isHidden = true
            progressIndicator.stopAnimation(nil)
            resultsScrollView.isHidden = true
            resultsLabel.isHidden = true
            generateReportButton.isEnabled = false
            compareButton.isEnabled = false
        case .configuring:
            runButton.isEnabled = true
            progressIndicator.isHidden = true
            progressIndicator.stopAnimation(nil)
            resultsScrollView.isHidden = true
            resultsLabel.isHidden = true
            generateReportButton.isEnabled = false
            compareButton.isEnabled = false
        case .running:
            runButton.isEnabled = false
            progressIndicator.isHidden = false
            progressIndicator.startAnimation(nil)
            resultsScrollView.isHidden = true
            resultsLabel.isHidden = true
            generateReportButton.isEnabled = false
            compareButton.isEnabled = false
        case .showingResults:
            runButton.isEnabled = true
            progressIndicator.isHidden = true
            progressIndicator.stopAnimation(nil)
            resultsScrollView.isHidden = false
            resultsLabel.isHidden = false
            generateReportButton.isEnabled = true
            compareButton.isEnabled = true
        case .showingReport:
            runButton.isEnabled = true
            progressIndicator.isHidden = true
            progressIndicator.stopAnimation(nil)
            resultsScrollView.isHidden = false
            resultsLabel.isHidden = false
            generateReportButton.isEnabled = true
            compareButton.isEnabled = true
        case .comparing:
            runButton.isEnabled = false
            progressIndicator.isHidden = true
            progressIndicator.stopAnimation(nil)
            resultsScrollView.isHidden = false
            resultsLabel.isHidden = false
            generateReportButton.isEnabled = false
            compareButton.isEnabled = false
        }
    }

    // MARK: — Public API

    public func loadResults(_ data: [(rank: Int, node: String, score: Double)]) {
        resultsData = data
        resultsTable.reloadData()
        workflowState = .showingResults
    }

    // MARK: — NSTableViewDataSource

    public func numberOfRows(in tableView: NSTableView) -> Int {
        return resultsData.count
    }

    public func tableView(_ tableView: NSTableView, viewFor tableColumn: NSTableColumn?, row: Int) -> NSView? {
        guard row < resultsData.count else { return nil }
        let entry = resultsData[row]
        let cellId = NSUserInterfaceItemIdentifier("AnalysisCell")
        let cell = tableView.makeView(withIdentifier: cellId, owner: nil) as? NSTextField
            ?? NSTextField(labelWithString: "")
        cell.identifier = cellId
        cell.font = NSFont.systemFont(ofSize: 11)

        switch tableColumn?.identifier.rawValue {
        case "rank":
            cell.stringValue = "\(entry.rank)"
            cell.alignment = .center
        case "node":
            cell.stringValue = entry.node
        case "score":
            cell.stringValue = String(format: "%.4f", entry.score)
            cell.alignment = .right
        default:
            break
        }
        return cell
    }

    // MARK: — Actions

    @objc private func categoryChanged(_ sender: NSSegmentedControl) {
        let idx = sender.selectedSegment
        if idx >= 0 && idx < categoryKeys.count {
            selectedCategory = categoryKeys[idx]
        }
        workflowState = .configuring
    }

    @objc private func algorithmChanged(_ sender: NSPopUpButton) {
        selectedAlgorithm = sender.titleOfSelectedItem
        workflowState = .configuring
    }

    @objc private func runAnalysis(_ sender: Any) {
        onRun?(selectedCategory, selectedAlgorithm)
    }

    @objc private func masterOverlayChanged(_ sender: NSSwitch) {
        overlaysEnabled = sender.state == .on
        for toggle in overlaySwitches {
            toggle.state = overlaysEnabled ? .on : .off
        }
        for name in overlayNames {
            onOverlayToggle?(name, overlaysEnabled)
        }
    }

    @objc private func overlayToggleChanged(_ sender: NSSwitch) {
        if let idx = overlaySwitches.firstIndex(of: sender), idx < overlayNames.count {
            let name = overlayNames[idx]
            let enabled = sender.state == .on
            onOverlayToggle?(name, enabled)
        }
    }

    @objc private func reportFormatChanged(_ sender: NSPopUpButton) {
        reportFormat = (sender.titleOfSelectedItem ?? "summary").lowercased()
    }

    @objc private func generateReport(_ sender: Any) {
        onGenerateReport?(reportFormat)
    }

    @objc private func compareResults(_ sender: Any) {
        onCompare?()
    }
}
