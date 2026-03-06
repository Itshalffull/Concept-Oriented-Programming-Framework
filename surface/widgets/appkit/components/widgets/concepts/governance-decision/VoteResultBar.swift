import AppKit

class VoteResultBarView: NSView {

    enum State: String { case idle; case animating; case segmentHovered }

    struct Segment {
        let label: String
        let count: Int
        let color: NSColor?
    }

    private(set) var state: State = .idle
    private var segments: [Segment] = []
    private var total: Int = 0
    private var showLabels: Bool = true
    private var showQuorum: Bool = false
    private var quorumThreshold: Double = 0
    private var hoveredIndex: Int? = nil
    private var focusedIndex: Int = -1
    private var barHeight: CGFloat = 24
    private var animationTimer: Timer?
    private var trackingArea: NSTrackingArea?

    var onSegmentHover: ((Int?) -> Void)?

    private let rootStack = NSStackView()
    private let barContainer = NSView()
    private var segmentViews: [NSView] = []
    private let labelsStack = NSStackView()
    private let totalLabel = NSTextField(labelWithString: "")
    private let quorumMarker = NSView()

    private static let defaultColors: [NSColor] = [
        .systemGreen, .systemRed, .systemOrange, .systemBlue, .systemPurple, .systemTeal, .brown, .gray,
    ]

    // MARK: - State machine

    func reduce(_ event: String, index: Int? = nil) {
        switch state {
        case .idle:
            if event == "HOVER_SEGMENT", let i = index { state = .segmentHovered; hoveredIndex = i }
            if event == "ANIMATE_IN" { state = .animating; startAnimation() }
        case .animating:
            if event == "ANIMATION_END" { state = .idle }
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
        setAccessibilityLabel("Vote results bar")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    // MARK: - Setup

    private func setupSubviews() {
        wantsLayer = true

        rootStack.orientation = .vertical
        rootStack.spacing = 4
        rootStack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(rootStack)
        NSLayoutConstraint.activate([
            rootStack.topAnchor.constraint(equalTo: topAnchor, constant: 4),
            rootStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 4),
            rootStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -4),
            rootStack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -4),
        ])

        // Bar container
        barContainer.wantsLayer = true
        barContainer.layer?.cornerRadius = 4
        barContainer.layer?.backgroundColor = NSColor.separatorColor.cgColor
        barContainer.heightAnchor.constraint(equalToConstant: barHeight).isActive = true
        rootStack.addArrangedSubview(barContainer)

        // Quorum marker
        quorumMarker.wantsLayer = true
        quorumMarker.layer?.backgroundColor = NSColor.black.cgColor
        quorumMarker.isHidden = true
        barContainer.addSubview(quorumMarker)

        // Labels
        labelsStack.orientation = .horizontal
        labelsStack.spacing = 12
        rootStack.addArrangedSubview(labelsStack)

        // Total
        totalLabel.font = .systemFont(ofSize: 12)
        totalLabel.textColor = .tertiaryLabelColor
        rootStack.addArrangedSubview(totalLabel)

        updateUI()
    }

    // MARK: - Configure

    func configure(segments: [Segment], total: Int? = nil, showLabels: Bool = true, showQuorum: Bool = false, quorumThreshold: Double = 0, barHeight: CGFloat = 24, animate: Bool = true) {
        self.segments = segments
        self.total = total ?? segments.reduce(0) { $0 + $1.count }
        self.showLabels = showLabels
        self.showQuorum = showQuorum
        self.quorumThreshold = quorumThreshold
        self.barHeight = barHeight
        rebuildBar()
        if animate { reduce("ANIMATE_IN") }
        else { updateUI() }
    }

    private func rebuildBar() {
        segmentViews.forEach { $0.removeFromSuperview() }
        segmentViews = []
        labelsStack.arrangedSubviews.forEach { $0.removeFromSuperview() }

        var xOffset: CGFloat = 0
        let barWidth = barContainer.bounds.width > 0 ? barContainer.bounds.width : 300

        for (i, seg) in segments.enumerated() {
            let pct = total > 0 ? CGFloat(seg.count) / CGFloat(total) : 0
            let width = max(seg.count == 0 && total > 0 ? 2 : 0, barWidth * pct)
            let color = seg.color ?? Self.defaultColors[i % Self.defaultColors.count]

            let view = NSView(frame: NSRect(x: xOffset, y: 0, width: width, height: barHeight))
            view.wantsLayer = true
            view.layer?.backgroundColor = color.cgColor
            view.tag = i

            let area = NSTrackingArea(rect: view.bounds, options: [.mouseEnteredAndExited, .activeInKeyWindow], owner: self, userInfo: ["index": i])
            view.addTrackingArea(area)

            barContainer.addSubview(view)
            segmentViews.append(view)
            xOffset += width

            // Label
            if showLabels {
                let pctValue = total > 0 ? Double(seg.count) / Double(total) * 100 : 0
                let pctStr = pctValue.truncatingRemainder(dividingBy: 1) == 0 ? String(format: "%.0f", pctValue) : String(format: "%.1f", pctValue)
                let lbl = NSTextField(labelWithString: "\(seg.label) \(seg.count) (\(pctStr)%)")
                lbl.font = .systemFont(ofSize: 11)
                lbl.textColor = .secondaryLabelColor
                labelsStack.addArrangedSubview(lbl)
            }
        }

        // Quorum marker
        quorumMarker.isHidden = !(showQuorum && quorumThreshold > 0)
        if showQuorum && quorumThreshold > 0 {
            let x = barWidth * CGFloat(quorumThreshold / 100)
            quorumMarker.frame = NSRect(x: x, y: 0, width: 2, height: barHeight)
            quorumMarker.setAccessibilityLabel("Quorum threshold at \(Int(quorumThreshold))%")
        }

        totalLabel.stringValue = "Total: \(total)"

        // ARIA
        let desc = segments.map { seg -> String in
            let pct = total > 0 ? Double(seg.count) / Double(total) * 100 : 0
            return "\(seg.label): \(seg.count) votes (\(String(format: "%.1f", pct))%)"
        }.joined(separator: ", ")
        setAccessibilityValue("Vote results: \(desc). Total: \(total) votes.")
    }

    private func startAnimation() {
        animationTimer?.invalidate()
        animationTimer = Timer.scheduledTimer(withTimeInterval: 0.4, repeats: false) { [weak self] _ in
            self?.reduce("ANIMATION_END")
        }
    }

    private func updateUI() {
        labelsStack.isHidden = !showLabels

        // Hover opacity
        for (i, view) in segmentViews.enumerated() {
            if let hovered = hoveredIndex {
                view.alphaValue = i == hovered ? 1.0 : 0.5
            } else {
                view.alphaValue = 1.0
            }
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

    deinit { animationTimer?.invalidate() }
}
