import AppKit

class WeightBreakdownView: NSView {

    enum State: String { case idle; case segmentHovered }

    struct Segment {
        let label: String
        let weight: Double
        let color: NSColor?
    }

    private(set) var state: State = .idle
    private var segments: [Segment] = []
    private var totalWeight: Double = 0
    private var hoveredIndex: Int? = nil
    private var focusedIndex: Int = -1
    private var trackingArea: NSTrackingArea?

    var onSegmentHover: ((Int?) -> Void)?

    private let rootStack = NSStackView()
    private let chartContainer = NSView()
    private var segmentViews: [NSView] = []
    private let legendStack = NSStackView()
    private let totalLabel = NSTextField(labelWithString: "")
    private let tooltipLabel = NSTextField(labelWithString: "")

    private static let defaultColors: [NSColor] = [
        .systemBlue, .systemGreen, .systemOrange, .systemPurple, .systemRed, .systemTeal, .systemYellow, .systemPink,
    ]

    // MARK: - State machine

    func reduce(_ event: String, index: Int? = nil) {
        switch state {
        case .idle:
            if event == "HOVER_SEGMENT", let i = index { state = .segmentHovered; hoveredIndex = i }
        case .segmentHovered:
            if event == "UNHOVER" { state = .idle; hoveredIndex = nil }
            if event == "HOVER_SEGMENT", let i = index { hoveredIndex = i }
        }
        updateUI()
    }

    // MARK: - Init

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.image)
        setAccessibilityLabel("Stacked bar chart showing the composition of voting weights")
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

        // Stacked bar chart
        chartContainer.wantsLayer = true
        chartContainer.layer?.cornerRadius = 4
        chartContainer.layer?.backgroundColor = NSColor.separatorColor.cgColor
        chartContainer.heightAnchor.constraint(equalToConstant: 28).isActive = true
        rootStack.addArrangedSubview(chartContainer)

        // Tooltip
        tooltipLabel.font = .systemFont(ofSize: 11)
        tooltipLabel.textColor = .secondaryLabelColor
        tooltipLabel.isHidden = true
        rootStack.addArrangedSubview(tooltipLabel)

        // Legend
        legendStack.orientation = .vertical
        legendStack.spacing = 4
        rootStack.addArrangedSubview(legendStack)

        // Total
        totalLabel.font = .systemFont(ofSize: 12)
        totalLabel.textColor = .tertiaryLabelColor
        rootStack.addArrangedSubview(totalLabel)

        updateUI()
    }

    // MARK: - Configure

    func configure(segments: [Segment], total: Double? = nil) {
        self.segments = segments
        self.totalWeight = total ?? segments.reduce(0) { $0 + $1.weight }
        rebuildChart()
        updateUI()
    }

    private func rebuildChart() {
        segmentViews.forEach { $0.removeFromSuperview() }
        segmentViews = []
        legendStack.arrangedSubviews.forEach { $0.removeFromSuperview() }

        let barWidth = chartContainer.bounds.width > 0 ? chartContainer.bounds.width : 300
        var xOffset: CGFloat = 0

        for (i, seg) in segments.enumerated() {
            let pct = totalWeight > 0 ? seg.weight / totalWeight : 0
            let width = barWidth * CGFloat(pct)
            let color = seg.color ?? Self.defaultColors[i % Self.defaultColors.count]

            let view = NSView(frame: NSRect(x: xOffset, y: 0, width: width, height: 28))
            view.wantsLayer = true
            view.layer?.backgroundColor = color.cgColor
            view.tag = i

            let area = NSTrackingArea(rect: view.bounds, options: [.mouseEnteredAndExited, .activeInKeyWindow], owner: self, userInfo: ["index": i])
            view.addTrackingArea(area)

            chartContainer.addSubview(view)
            segmentViews.append(view)
            xOffset += width

            // Legend item
            let legendRow = NSStackView()
            legendRow.orientation = .horizontal
            legendRow.spacing = 6

            let swatch = NSView()
            swatch.wantsLayer = true
            swatch.layer?.backgroundColor = color.cgColor
            swatch.layer?.cornerRadius = 4
            swatch.widthAnchor.constraint(equalToConstant: 12).isActive = true
            swatch.heightAnchor.constraint(equalToConstant: 12).isActive = true
            legendRow.addArrangedSubview(swatch)

            let pctStr = String(format: "%.1f%%", pct * 100)
            let lbl = NSTextField(labelWithString: "\(seg.label): \(String(format: "%.2f", seg.weight)) (\(pctStr))")
            lbl.font = .systemFont(ofSize: 12)
            legendRow.addArrangedSubview(lbl)

            legendStack.addArrangedSubview(legendRow)
        }

        totalLabel.stringValue = "Total: \(String(format: "%.2f", totalWeight))"

        // ARIA description
        let desc = segments.map { seg -> String in
            let pct = totalWeight > 0 ? seg.weight / totalWeight * 100 : 0
            return "\(seg.label): \(String(format: "%.1f", pct))%"
        }.joined(separator: ", ")
        setAccessibilityValue("Weight breakdown: \(desc)")
    }

    private func updateUI() {
        // Hover effects
        for (i, view) in segmentViews.enumerated() {
            if let hovered = hoveredIndex {
                view.alphaValue = i == hovered ? 1.0 : 0.5
            } else {
                view.alphaValue = 1.0
            }
        }

        // Tooltip
        if let idx = hoveredIndex, idx < segments.count {
            let seg = segments[idx]
            let pct = totalWeight > 0 ? seg.weight / totalWeight * 100 : 0
            tooltipLabel.stringValue = "\(seg.label): \(String(format: "%.2f", seg.weight)) (\(String(format: "%.1f%%", pct)))"
            tooltipLabel.isHidden = false
        } else {
            tooltipLabel.isHidden = true
        }
    }

    // MARK: - Mouse tracking

    override func mouseEntered(with event: NSEvent) {
        if let idx = event.trackingArea?.userInfo?["index"] as? Int {
            reduce("HOVER_SEGMENT", index: idx)
            onSegmentHover?(idx)
        }
    }

    override func mouseExited(with event: NSEvent) {
        reduce("UNHOVER")
        onSegmentHover?(nil)
    }

    // MARK: - Keyboard

    override var acceptsFirstResponder: Bool { true }

    override func keyDown(with event: NSEvent) {
        switch event.keyCode {
        case 124: // Right
            focusedIndex = focusedIndex < segments.count - 1 ? focusedIndex + 1 : 0
            reduce("HOVER_SEGMENT", index: focusedIndex)
            onSegmentHover?(focusedIndex)
        case 123: // Left
            focusedIndex = focusedIndex > 0 ? focusedIndex - 1 : segments.count - 1
            reduce("HOVER_SEGMENT", index: focusedIndex)
            onSegmentHover?(focusedIndex)
        case 53: // Escape
            focusedIndex = -1
            reduce("UNHOVER")
            onSegmentHover?(nil)
        default: super.keyDown(with: event)
        }
    }

    // MARK: - Cleanup

    deinit {}
}
