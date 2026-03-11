import AppKit

// MARK: - Coverage data types

enum CoverageStatus: String {
    case covered, uncovered, partial, none
}

enum CoverageFilter: String, CaseIterable {
    case all, covered, uncovered, partial
}

struct CoverageLine {
    let number: Int
    let text: String
    let coverage: CoverageStatus
    var coveredBy: String?
}

struct CoverageSummary {
    let totalLines: Int
    let coveredLines: Int
    let percentage: Double
}

// MARK: - CoverageSourceViewView

class CoverageSourceViewView: NSView {

    enum State: String { case idle, lineHovered }

    private var widgetState: State = .idle
    private var lines: [CoverageLine] = []
    private var summary = CoverageSummary(totalLines: 0, coveredLines: 0, percentage: 0)
    private var activeFilter: CoverageFilter = .all
    private var selectedLineIndex: Int? = nil
    private var focusedLineIndex: Int = 0
    private var hoveredLineIndex: Int? = nil
    private var showLineNumbers: Bool = true
    private var trackingArea: NSTrackingArea?

    var onLineSelect: ((CoverageLine) -> Void)?
    var onFilterChange: ((CoverageFilter) -> Void)?

    private let summaryLabel = NSTextField(labelWithString: "")
    private let filterBar = NSStackView()
    private let scrollView = NSScrollView()
    private let codeContainer = NSStackView()
    private let tooltipField = NSTextField(labelWithString: "")
    private let detailField = NSTextField(labelWithString: "")

    // MARK: - State machine

    func reduce(_ event: String, lineIndex: Int? = nil, filter: CoverageFilter? = nil) {
        switch widgetState {
        case .idle:
            if event == "HOVER_LINE" { widgetState = .lineHovered }
            if event == "FILTER", let f = filter {
                activeFilter = f
                selectedLineIndex = nil
                focusedLineIndex = 0
                onFilterChange?(f)
                rebuildLines()
            }
            if event == "JUMP_UNCOVERED" { jumpToNextUncovered() }
        case .lineHovered:
            if event == "LEAVE" { widgetState = .idle; hoveredLineIndex = nil }
        }
        updateTooltip()
    }

    // MARK: - Init

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Source code overlay showing formal verification coverage")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    // MARK: - Setup

    private func setupSubviews() {
        wantsLayer = true

        let rootStack = NSStackView()
        rootStack.orientation = .vertical
        rootStack.spacing = 0
        rootStack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(rootStack)
        NSLayoutConstraint.activate([
            rootStack.topAnchor.constraint(equalTo: topAnchor),
            rootStack.leadingAnchor.constraint(equalTo: leadingAnchor),
            rootStack.trailingAnchor.constraint(equalTo: trailingAnchor),
            rootStack.bottomAnchor.constraint(equalTo: bottomAnchor),
        ])

        // Summary header
        summaryLabel.font = .systemFont(ofSize: 14, weight: .semibold)
        summaryLabel.setContentHuggingPriority(.defaultHigh, for: .vertical)
        rootStack.addArrangedSubview(summaryLabel)

        // Filter bar
        filterBar.orientation = .horizontal
        filterBar.spacing = 4
        for filter in CoverageFilter.allCases {
            let btn = NSButton(title: filter.rawValue.capitalized, target: self, action: #selector(handleFilterClick(_:)))
            btn.bezelStyle = .roundRect
            btn.tag = CoverageFilter.allCases.firstIndex(of: filter) ?? 0
            btn.setAccessibilityLabel("Filter \(filter.rawValue)")
            filterBar.addArrangedSubview(btn)
        }
        rootStack.addArrangedSubview(filterBar)

        // Scrollable code area
        codeContainer.orientation = .vertical
        codeContainer.spacing = 0
        codeContainer.alignment = .leading
        scrollView.documentView = codeContainer
        scrollView.hasVerticalScroller = true
        scrollView.hasHorizontalScroller = true
        scrollView.autohidesScrollers = true
        rootStack.addArrangedSubview(scrollView)

        // Tooltip
        tooltipField.font = .systemFont(ofSize: 12)
        tooltipField.backgroundColor = NSColor(white: 0.12, alpha: 0.9)
        tooltipField.textColor = .white
        tooltipField.isHidden = true
        tooltipField.isBezeled = false
        tooltipField.isEditable = false
        tooltipField.drawsBackground = true
        addSubview(tooltipField)

        // Detail field
        detailField.font = .systemFont(ofSize: 13)
        detailField.isHidden = true
        detailField.isBezeled = false
        detailField.isEditable = false
        rootStack.addArrangedSubview(detailField)

        setupTrackingArea()
    }

    // MARK: - Configure

    func configure(lines: [CoverageLine], summary: CoverageSummary, showLineNumbers: Bool = true) {
        self.lines = lines
        self.summary = summary
        self.showLineNumbers = showLineNumbers
        summaryLabel.stringValue = "Coverage: \(String(format: "%.0f", summary.percentage))% (\(summary.coveredLines)/\(summary.totalLines) lines)"
        rebuildLines()
    }

    private var filteredLines: [CoverageLine] {
        if activeFilter == .all { return lines }
        return lines.filter { $0.coverage.rawValue == activeFilter.rawValue }
    }

    private func rebuildLines() {
        codeContainer.arrangedSubviews.forEach { $0.removeFromSuperview() }

        for (index, line) in filteredLines.enumerated() {
            let row = NSStackView()
            row.orientation = .horizontal
            row.spacing = 0

            // Coverage gutter
            let gutter = NSView()
            gutter.wantsLayer = true
            gutter.layer?.backgroundColor = gutterColor(for: line.coverage).cgColor
            gutter.translatesAutoresizingMaskIntoConstraints = false
            row.addArrangedSubview(gutter)
            NSLayoutConstraint.activate([gutter.widthAnchor.constraint(equalToConstant: 4)])

            // Line number
            if showLineNumbers {
                let numField = NSTextField(labelWithString: "\(line.number)")
                numField.font = .monospacedSystemFont(ofSize: 13, weight: .regular)
                numField.textColor = .secondaryLabelColor
                numField.alignment = .right
                numField.translatesAutoresizingMaskIntoConstraints = false
                row.addArrangedSubview(numField)
                NSLayoutConstraint.activate([numField.widthAnchor.constraint(equalToConstant: 48)])
            }

            // Source text
            let textField = NSTextField(labelWithString: line.text)
            textField.font = .monospacedSystemFont(ofSize: 13, weight: .regular)
            textField.lineBreakMode = .byTruncatingTail
            textField.maximumNumberOfLines = 1
            row.addArrangedSubview(textField)

            row.tag = index
            let click = NSClickGestureRecognizer(target: self, action: #selector(handleLineClick(_:)))
            row.addGestureRecognizer(click)

            codeContainer.addArrangedSubview(row)
        }

        updateLineHighlights()
    }

    private func gutterColor(for status: CoverageStatus) -> NSColor {
        switch status {
        case .covered: return NSColor(red: 0.133, green: 0.773, blue: 0.369, alpha: 1)
        case .uncovered: return NSColor(red: 0.937, green: 0.267, blue: 0.267, alpha: 1)
        case .partial: return NSColor(red: 0.918, green: 0.702, blue: 0.031, alpha: 1)
        case .none: return .clear
        }
    }

    private func updateLineHighlights() {
        for (index, view) in codeContainer.arrangedSubviews.enumerated() {
            guard let row = view as? NSStackView else { continue }
            row.wantsLayer = true
            if index == selectedLineIndex {
                row.layer?.backgroundColor = NSColor.selectedContentBackgroundColor.withAlphaComponent(0.3).cgColor
            } else if index == focusedLineIndex {
                row.layer?.backgroundColor = NSColor.controlBackgroundColor.cgColor
            } else {
                row.layer?.backgroundColor = nil
            }
        }

        // Detail field
        if let idx = selectedLineIndex, idx < filteredLines.count {
            let line = filteredLines[idx]
            var text = "Line \(line.number) - \(line.coverage.rawValue.capitalized)"
            if let cb = line.coveredBy { text += " (covered by: \(cb))" }
            detailField.stringValue = text
            detailField.isHidden = false
        } else {
            detailField.isHidden = true
        }
    }

    private func updateTooltip() {
        if widgetState == .lineHovered, let idx = hoveredLineIndex, idx < filteredLines.count {
            let line = filteredLines[idx]
            if let coveredBy = line.coveredBy {
                tooltipField.stringValue = "Covered by: \(coveredBy)"
                tooltipField.isHidden = false
                tooltipField.sizeToFit()
                return
            }
        }
        tooltipField.isHidden = true
    }

    private func jumpToNextUncovered() {
        let fl = filteredLines
        guard !fl.isEmpty else { return }
        let start = focusedLineIndex + 1
        for i in 0..<fl.count {
            let idx = (start + i) % fl.count
            if fl[idx].coverage == .uncovered {
                focusedLineIndex = idx
                updateLineHighlights()
                return
            }
        }
    }

    // MARK: - Actions

    @objc private func handleFilterClick(_ sender: NSButton) {
        let filter = CoverageFilter.allCases[sender.tag]
        reduce("FILTER", filter: filter)
    }

    @objc private func handleLineClick(_ recognizer: NSClickGestureRecognizer) {
        guard let row = recognizer.view as? NSStackView else { return }
        let index = row.tag
        selectedLineIndex = index
        focusedLineIndex = index
        if index < filteredLines.count {
            onLineSelect?(filteredLines[index])
        }
        updateLineHighlights()
    }

    // MARK: - Keyboard

    override var acceptsFirstResponder: Bool { true }

    override func keyDown(with event: NSEvent) {
        let fl = filteredLines
        guard !fl.isEmpty else { super.keyDown(with: event); return }

        switch event.keyCode {
        case 126: // Up
            focusedLineIndex = max(0, focusedLineIndex - 1)
            updateLineHighlights()
        case 125: // Down
            focusedLineIndex = min(fl.count - 1, focusedLineIndex + 1)
            updateLineHighlights()
        case 36: // Enter
            selectedLineIndex = focusedLineIndex
            if focusedLineIndex < fl.count { onLineSelect?(fl[focusedLineIndex]) }
            updateLineHighlights()
        default:
            if event.charactersIgnoringModifiers == "g" && event.modifierFlags.contains(.control) {
                reduce("JUMP_UNCOVERED")
            } else {
                super.keyDown(with: event)
            }
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
        let point = codeContainer.convert(event.locationInWindow, from: nil)
        for (index, view) in codeContainer.arrangedSubviews.enumerated() {
            if view.frame.contains(point) {
                hoveredLineIndex = index
                reduce("HOVER_LINE", lineIndex: index)
                return
            }
        }
        hoveredLineIndex = nil
        reduce("LEAVE")
    }

    override func mouseExited(with event: NSEvent) {
        hoveredLineIndex = nil
        reduce("LEAVE")
    }

    // MARK: - Cleanup

    deinit {
        if let ta = trackingArea { removeTrackingArea(ta) }
    }
}
