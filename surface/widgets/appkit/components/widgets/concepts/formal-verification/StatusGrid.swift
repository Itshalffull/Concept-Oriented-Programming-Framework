import AppKit

// MARK: - Status grid types

enum CellStatus: String {
    case passed, failed, running, pending, timeout

    var color: NSColor {
        switch self {
        case .passed: return NSColor(red: 0.133, green: 0.773, blue: 0.369, alpha: 1)
        case .failed: return NSColor(red: 0.937, green: 0.267, blue: 0.267, alpha: 1)
        case .running: return NSColor(red: 0.231, green: 0.510, blue: 0.965, alpha: 1)
        case .pending: return NSColor(red: 0.612, green: 0.639, blue: 0.686, alpha: 1)
        case .timeout: return NSColor(red: 0.976, green: 0.451, blue: 0.086, alpha: 1)
        }
    }

    var displayLabel: String { rawValue.capitalized }
}

struct StatusGridItem {
    let id: String
    let name: String
    let status: CellStatus
    var duration: Int?
}

enum StatusFilterValue: String, CaseIterable {
    case all, passed, failed
}

// MARK: - StatusGridView

class StatusGridView: NSView {

    enum State: String { case idle; case cellHovered; case cellSelected }

    private var widgetState: State = .idle
    private var items: [StatusGridItem] = []
    private var columns: Int = 4
    private var showAggregates: Bool = true
    private var compact: Bool = false
    private var filter: StatusFilterValue = .all
    private var hoveredIndex: Int?
    private var selectedIndex: Int?
    private var focusIndex: Int = 0
    private var trackingArea: NSTrackingArea?

    var onCellSelect: ((StatusGridItem) -> Void)?

    private let rootStack = NSStackView()
    private let summaryLabel = NSTextField(labelWithString: "")
    private let filterBar = NSStackView()
    private let gridContainer = NSStackView()
    private let tooltipField = NSTextField(labelWithString: "")
    private let detailPanel = NSStackView()
    private let detailName = NSTextField(labelWithString: "")
    private let detailStatus = NSTextField(labelWithString: "")
    private let detailDuration = NSTextField(labelWithString: "")

    // MARK: - State machine

    func send(_ event: String, index: Int? = nil) {
        switch widgetState {
        case .idle:
            if event == "HOVER_CELL" { widgetState = .cellHovered; hoveredIndex = index }
            if event == "CLICK_CELL" { widgetState = .cellSelected; selectedIndex = index; focusIndex = index ?? 0 }
            if event == "SORT" || event == "FILTER" { /* stays idle */ }
        case .cellHovered:
            if event == "LEAVE_CELL" { widgetState = .idle; hoveredIndex = nil }
            if event == "CLICK_CELL" { widgetState = .cellSelected; selectedIndex = index; focusIndex = index ?? 0 }
        case .cellSelected:
            if event == "DESELECT" { widgetState = .idle; selectedIndex = nil }
            if event == "CLICK_CELL" { selectedIndex = index; focusIndex = index ?? 0 }
        }
        rebuildGrid()
    }

    // MARK: - Init

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Matrix grid displaying verification statuses")
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

        summaryLabel.font = .systemFont(ofSize: 13)
        rootStack.addArrangedSubview(summaryLabel)

        filterBar.orientation = .horizontal
        filterBar.spacing = 4
        for fv in StatusFilterValue.allCases {
            let btn = NSButton(title: fv.rawValue.capitalized, target: self, action: #selector(filterClicked(_:)))
            btn.bezelStyle = .roundRect
            btn.tag = StatusFilterValue.allCases.firstIndex(of: fv) ?? 0
            btn.setAccessibilityLabel("Filter \(fv.rawValue)")
            filterBar.addArrangedSubview(btn)
        }
        rootStack.addArrangedSubview(filterBar)

        gridContainer.orientation = .vertical
        gridContainer.spacing = 4
        rootStack.addArrangedSubview(gridContainer)

        tooltipField.font = .systemFont(ofSize: 12)
        tooltipField.wantsLayer = true
        tooltipField.layer?.backgroundColor = NSColor(white: 0.12, alpha: 0.95).cgColor
        tooltipField.textColor = .white
        tooltipField.isBezeled = false
        tooltipField.isEditable = false
        tooltipField.drawsBackground = true
        tooltipField.isHidden = true
        addSubview(tooltipField)

        detailPanel.orientation = .vertical
        detailPanel.spacing = 4
        detailPanel.isHidden = true
        detailName.font = .systemFont(ofSize: 14, weight: .semibold)
        detailPanel.addArrangedSubview(detailName)
        detailStatus.font = .systemFont(ofSize: 13)
        detailPanel.addArrangedSubview(detailStatus)
        detailDuration.font = .systemFont(ofSize: 13)
        detailDuration.textColor = .secondaryLabelColor
        detailPanel.addArrangedSubview(detailDuration)
        rootStack.addArrangedSubview(detailPanel)

        setupTrackingArea()
    }

    // MARK: - Configure

    func configure(items: [StatusGridItem], columns: Int = 4, showAggregates: Bool = true, compact: Bool = false) {
        self.items = items
        self.columns = columns
        self.showAggregates = showAggregates
        self.compact = compact
        rebuildGrid()
    }

    private var filteredItems: [StatusGridItem] {
        if filter == .all { return items }
        return items.filter { $0.status.rawValue == filter.rawValue }
    }

    private func formatDuration(_ ms: Int) -> String {
        ms < 1000 ? "\(ms)ms" : String(format: "%.1fs", Double(ms) / 1000.0)
    }

    private func rebuildGrid() {
        gridContainer.arrangedSubviews.forEach { $0.removeFromSuperview() }

        let filtered = filteredItems
        let actualCols = min(columns, filtered.count)
        guard actualCols > 0 else { return }

        // Summary
        var counts = [CellStatus: Int]()
        for item in items { counts[item.status, default: 0] += 1 }
        var parts = [String]()
        if let c = counts[.passed], c > 0 { parts.append("\(c) passed") }
        if let c = counts[.failed], c > 0 { parts.append("\(c) failed") }
        if let c = counts[.running], c > 0 { parts.append("\(c) running") }
        if let c = counts[.pending], c > 0 { parts.append("\(c) pending") }
        if let c = counts[.timeout], c > 0 { parts.append("\(c) timeout") }
        summaryLabel.stringValue = parts.joined(separator: ", ")
        summaryLabel.isHidden = !showAggregates

        // Grid rows
        var row = NSStackView()
        row.orientation = .horizontal
        row.spacing = compact ? 2 : 4
        row.distribution = .fillEqually

        for (index, item) in filtered.enumerated() {
            if index > 0 && index % actualCols == 0 {
                gridContainer.addArrangedSubview(row)
                row = NSStackView()
                row.orientation = .horizontal
                row.spacing = compact ? 2 : 4
                row.distribution = .fillEqually
            }

            let cell = NSStackView()
            cell.orientation = .vertical
            cell.spacing = compact ? 2 : 4
            cell.alignment = compact ? .centerX : .leading
            cell.wantsLayer = true
            cell.layer?.cornerRadius = 4

            if index == selectedIndex {
                cell.layer?.borderWidth = 2
                cell.layer?.borderColor = NSColor.controlAccentColor.cgColor
            } else if index == hoveredIndex {
                cell.layer?.borderWidth = 1
                cell.layer?.borderColor = NSColor.separatorColor.cgColor
            }

            // Status dot
            let dot = NSView()
            dot.wantsLayer = true
            dot.layer?.backgroundColor = item.status.color.cgColor
            dot.layer?.cornerRadius = compact ? 5 : 7
            dot.translatesAutoresizingMaskIntoConstraints = false
            cell.addArrangedSubview(dot)
            let dotSize: CGFloat = compact ? 10 : 14
            NSLayoutConstraint.activate([
                dot.widthAnchor.constraint(equalToConstant: dotSize),
                dot.heightAnchor.constraint(equalToConstant: dotSize),
            ])

            let nameField = NSTextField(labelWithString: item.name)
            nameField.font = .systemFont(ofSize: compact ? 10 : 12)
            nameField.lineBreakMode = .byTruncatingTail
            nameField.maximumNumberOfLines = 1
            cell.addArrangedSubview(nameField)

            if !compact, let dur = item.duration {
                let durField = NSTextField(labelWithString: formatDuration(dur))
                durField.font = .systemFont(ofSize: 11)
                durField.textColor = .secondaryLabelColor
                cell.addArrangedSubview(durField)
            }

            cell.setAccessibilityLabel("\(item.name): \(item.status.displayLabel)\(item.duration != nil ? ", \(formatDuration(item.duration!))" : "")")
            cell.tag = index

            let click = NSClickGestureRecognizer(target: self, action: #selector(cellClicked(_:)))
            cell.addGestureRecognizer(click)

            row.addArrangedSubview(cell)
        }
        if !row.arrangedSubviews.isEmpty { gridContainer.addArrangedSubview(row) }

        // Detail panel
        if let si = selectedIndex, si < filtered.count {
            let item = filtered[si]
            detailPanel.isHidden = false
            detailName.stringValue = item.name
            detailStatus.stringValue = "Status: \(item.status.displayLabel)"
            if let dur = item.duration {
                detailDuration.stringValue = "Duration: \(formatDuration(dur))"
                detailDuration.isHidden = false
            } else { detailDuration.isHidden = true }
        } else { detailPanel.isHidden = true }

        // Tooltip
        if widgetState == .cellHovered, let hi = hoveredIndex, hi < filtered.count {
            let item = filtered[hi]
            var text = "\(item.name) \u{2014} \(item.status.displayLabel)"
            if let dur = item.duration { text += " (\(formatDuration(dur)))" }
            tooltipField.stringValue = text
            tooltipField.isHidden = false
            tooltipField.sizeToFit()
        } else { tooltipField.isHidden = true }
    }

    // MARK: - Actions

    @objc private func filterClicked(_ sender: NSButton) {
        filter = StatusFilterValue.allCases[sender.tag]
        selectedIndex = nil
        hoveredIndex = nil
        focusIndex = 0
        send("FILTER")
    }

    @objc private func cellClicked(_ recognizer: NSClickGestureRecognizer) {
        guard let cell = recognizer.view as? NSStackView else { return }
        let index = cell.tag
        send("CLICK_CELL", index: index)
        let filtered = filteredItems
        if index < filtered.count { onCellSelect?(filtered[index]) }
    }

    // MARK: - Keyboard

    override var acceptsFirstResponder: Bool { true }

    override func keyDown(with event: NSEvent) {
        let filtered = filteredItems
        guard !filtered.isEmpty else { super.keyDown(with: event); return }
        let actualCols = min(columns, filtered.count)

        switch event.keyCode {
        case 124: focusIndex = min(focusIndex + 1, filtered.count - 1) // Right
        case 123: focusIndex = max(focusIndex - 1, 0) // Left
        case 125: focusIndex = min(focusIndex + actualCols, filtered.count - 1) // Down
        case 126: focusIndex = max(focusIndex - actualCols, 0) // Up
        case 36: send("CLICK_CELL", index: focusIndex); if focusIndex < filtered.count { onCellSelect?(filtered[focusIndex]) }
        case 53: send("DESELECT")
        default: super.keyDown(with: event)
        }
    }

    // MARK: - Mouse tracking

    private func setupTrackingArea() {
        let area = NSTrackingArea(rect: bounds, options: [.mouseEnteredAndExited, .mouseMoved, .activeInKeyWindow, .inVisibleRect], owner: self, userInfo: nil)
        addTrackingArea(area)
        trackingArea = area
    }

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        if let ta = trackingArea { removeTrackingArea(ta) }
        setupTrackingArea()
    }

    override func mouseMoved(with event: NSEvent) {
        let point = gridContainer.convert(event.locationInWindow, from: nil)
        for row in gridContainer.arrangedSubviews {
            guard let rowStack = row as? NSStackView else { continue }
            for cell in rowStack.arrangedSubviews {
                if cell.frame.contains(gridContainer.convert(point, to: rowStack)) {
                    send("HOVER_CELL", index: cell.tag)
                    return
                }
            }
        }
        send("LEAVE_CELL")
    }

    override func mouseExited(with event: NSEvent) { send("LEAVE_CELL") }

    deinit { if let ta = trackingArea { removeTrackingArea(ta) } }
}
