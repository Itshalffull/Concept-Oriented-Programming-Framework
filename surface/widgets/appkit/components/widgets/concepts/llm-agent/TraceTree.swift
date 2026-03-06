import AppKit

class TraceTreeView: NSView {

    enum State: String { case idle; case spanSelected; case ready; case fetching }
    enum SpanType: String { case llm; case tool; case chain; case retrieval; case error }

    struct Span {
        let id: String
        let label: String
        let spanType: SpanType
        let durationMs: Int?
        let tokens: Int?
        let status: String
        let children: [Span]
    }

    private(set) var state: State = .idle
    private var spans: [Span] = []
    private var selectedSpanId: String? = nil
    private var expandedIds: Set<String> = []
    private var typeFilter: Set<SpanType> = Set(SpanType.allCases)
    private var focusIndex: Int = 0
    private var flatSpanIds: [String] = []
    private var trackingArea: NSTrackingArea?

    var onSpanSelect: ((String) -> Void)?

    private let rootStack = NSStackView()
    private let headerLabel = NSTextField(labelWithString: "Trace")
    private let filterBar = NSStackView()
    private let treeScroll = NSScrollView()
    private let treeContainer = NSStackView()
    private let detailPanel = NSStackView()
    private let detailLabelField = NSTextField(labelWithString: "")
    private let detailTypeField = NSTextField(labelWithString: "")
    private let detailDurationField = NSTextField(labelWithString: "")
    private let detailTokensField = NSTextField(labelWithString: "")
    private let detailStatusField = NSTextField(labelWithString: "")

    // MARK: - State machine

    func reduce(_ event: String, spanId: String? = nil) {
        switch state {
        case .idle:
            if event == "SELECT_SPAN", let id = spanId { state = .spanSelected; selectedSpanId = id; onSpanSelect?(id) }
        case .spanSelected:
            if event == "DESELECT" { state = .idle; selectedSpanId = nil }
            if event == "SELECT_SPAN", let id = spanId { selectedSpanId = id; onSpanSelect?(id) }
        case .ready:
            if event == "SELECT_SPAN", let id = spanId { state = .spanSelected; selectedSpanId = id; onSpanSelect?(id) }
        case .fetching:
            if event == "FETCH_COMPLETE" { state = .idle }
        }
        updateUI()
    }

    // MARK: - Init

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Hierarchical execution trace viewer displaying spans")
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

        headerLabel.font = .boldSystemFont(ofSize: 14)
        rootStack.addArrangedSubview(headerLabel)

        // Filter bar
        filterBar.orientation = .horizontal
        filterBar.spacing = 4
        for spanType in SpanType.allCases {
            let btn = NSButton(checkboxWithTitle: spanType.rawValue, target: self, action: #selector(handleFilterToggle(_:)))
            btn.state = .on
            btn.identifier = NSUserInterfaceItemIdentifier(spanType.rawValue)
            btn.setAccessibilityLabel("Filter \(spanType.rawValue) spans")
            filterBar.addArrangedSubview(btn)
        }
        rootStack.addArrangedSubview(filterBar)

        // Tree
        treeScroll.hasVerticalScroller = true
        treeScroll.drawsBackground = false
        treeContainer.orientation = .vertical
        treeContainer.spacing = 2
        treeScroll.documentView = treeContainer
        rootStack.addArrangedSubview(treeScroll)

        // Detail panel
        detailPanel.orientation = .vertical
        detailPanel.spacing = 4
        detailPanel.isHidden = true
        detailLabelField.font = .boldSystemFont(ofSize: 13)
        detailTypeField.font = .systemFont(ofSize: 12)
        detailDurationField.font = .monospacedDigitSystemFont(ofSize: 12, weight: .regular)
        detailTokensField.font = .systemFont(ofSize: 12)
        detailTokensField.textColor = .secondaryLabelColor
        detailStatusField.font = .systemFont(ofSize: 12)
        detailPanel.addArrangedSubview(detailLabelField)
        detailPanel.addArrangedSubview(detailTypeField)
        detailPanel.addArrangedSubview(detailDurationField)
        detailPanel.addArrangedSubview(detailTokensField)
        detailPanel.addArrangedSubview(detailStatusField)
        rootStack.addArrangedSubview(detailPanel)

        updateUI()
    }

    // MARK: - Configure

    func configure(spans: [Span]) {
        self.spans = spans
        expandedIds = Set(allSpanIds(spans))
        rebuildTree()
        updateUI()
    }

    private func allSpanIds(_ spans: [Span]) -> [String] {
        var ids: [String] = []
        for span in spans { ids.append(span.id); ids.append(contentsOf: allSpanIds(span.children)) }
        return ids
    }

    private func spanIcon(_ type: SpanType) -> String {
        switch type {
        case .llm: return "\u{1F916}"
        case .tool: return "\u{1F527}"
        case .chain: return "\u{1F517}"
        case .retrieval: return "\u{1F50D}"
        case .error: return "\u{274C}"
        }
    }

    private func rebuildTree() {
        treeContainer.arrangedSubviews.forEach { $0.removeFromSuperview() }
        flatSpanIds = []
        for span in spans {
            addSpanNode(span, depth: 0)
        }
    }

    private func addSpanNode(_ span: Span, depth: Int) {
        guard typeFilter.contains(span.spanType) else { return }
        flatSpanIds.append(span.id)

        let row = NSStackView()
        row.orientation = .horizontal
        row.spacing = 4
        row.edgeInsets = NSEdgeInsets(top: 2, left: CGFloat(depth * 16), bottom: 2, right: 4)

        let isExpanded = expandedIds.contains(span.id)
        let hasChildren = !span.children.isEmpty

        if hasChildren {
            let toggle = NSButton(title: isExpanded ? "\u{25BC}" : "\u{25B6}", target: self, action: #selector(handleToggle(_:)))
            toggle.bezelStyle = .roundRect
            toggle.font = .systemFont(ofSize: 10)
            toggle.identifier = NSUserInterfaceItemIdentifier("toggle-\(span.id)")
            row.addArrangedSubview(toggle)
        } else {
            let spacer = NSView()
            spacer.widthAnchor.constraint(equalToConstant: 20).isActive = true
            row.addArrangedSubview(spacer)
        }

        let icon = NSTextField(labelWithString: spanIcon(span.spanType))
        icon.font = .systemFont(ofSize: 11)
        row.addArrangedSubview(icon)

        let nameBtn = NSButton(title: span.label, target: self, action: #selector(handleSpanClick(_:)))
        nameBtn.bezelStyle = .roundRect
        nameBtn.identifier = NSUserInterfaceItemIdentifier(span.id)
        nameBtn.setAccessibilityLabel("\(span.label) (\(span.spanType.rawValue))")
        if selectedSpanId == span.id { nameBtn.contentTintColor = .controlAccentColor }
        row.addArrangedSubview(nameBtn)

        if let ms = span.durationMs {
            let dur = NSTextField(labelWithString: "\(ms)ms")
            dur.font = .monospacedDigitSystemFont(ofSize: 10, weight: .regular)
            dur.textColor = .tertiaryLabelColor
            row.addArrangedSubview(dur)
        }

        treeContainer.addArrangedSubview(row)

        if hasChildren && isExpanded {
            for child in span.children { addSpanNode(child, depth: depth + 1) }
        }
    }

    private func findSpan(_ id: String, in spans: [Span]) -> Span? {
        for span in spans {
            if span.id == id { return span }
            if let found = findSpan(id, in: span.children) { return found }
        }
        return nil
    }

    private func updateUI() {
        if state == .spanSelected, let id = selectedSpanId, let span = findSpan(id, in: spans) {
            detailPanel.isHidden = false
            detailLabelField.stringValue = span.label
            detailTypeField.stringValue = "Type: \(span.spanType.rawValue)"
            detailDurationField.stringValue = span.durationMs != nil ? "Duration: \(span.durationMs!)ms" : ""
            detailTokensField.stringValue = span.tokens != nil ? "Tokens: \(span.tokens!)" : ""
            detailStatusField.stringValue = "Status: \(span.status)"
        } else {
            detailPanel.isHidden = true
        }

        setAccessibilityValue("Trace tree, \(flatSpanIds.count) visible spans, \(state.rawValue)")
    }

    // MARK: - Actions

    @objc private func handleSpanClick(_ sender: NSButton) {
        if let id = sender.identifier?.rawValue { reduce("SELECT_SPAN", spanId: id) }
    }

    @objc private func handleToggle(_ sender: NSButton) {
        guard let rawId = sender.identifier?.rawValue, rawId.hasPrefix("toggle-") else { return }
        let id = String(rawId.dropFirst(7))
        if expandedIds.contains(id) { expandedIds.remove(id) } else { expandedIds.insert(id) }
        rebuildTree(); updateUI()
    }

    @objc private func handleFilterToggle(_ sender: NSButton) {
        guard let rawType = sender.identifier?.rawValue, let type = SpanType(rawValue: rawType) else { return }
        if sender.state == .on { typeFilter.insert(type) } else { typeFilter.remove(type) }
        rebuildTree(); updateUI()
    }

    // MARK: - Keyboard

    override var acceptsFirstResponder: Bool { true }

    override func keyDown(with event: NSEvent) {
        switch event.keyCode {
        case 125: focusIndex = min(focusIndex + 1, flatSpanIds.count - 1); if focusIndex < flatSpanIds.count { reduce("SELECT_SPAN", spanId: flatSpanIds[focusIndex]) }
        case 126: focusIndex = max(focusIndex - 1, 0); if focusIndex < flatSpanIds.count { reduce("SELECT_SPAN", spanId: flatSpanIds[focusIndex]) }
        case 124: if focusIndex < flatSpanIds.count { expandedIds.insert(flatSpanIds[focusIndex]); rebuildTree(); updateUI() }
        case 123: if focusIndex < flatSpanIds.count { expandedIds.remove(flatSpanIds[focusIndex]); rebuildTree(); updateUI() }
        case 53: reduce("DESELECT")
        default: super.keyDown(with: event)
        }
    }

    deinit {}
}

extension TraceTreeView.SpanType: CaseIterable {}
