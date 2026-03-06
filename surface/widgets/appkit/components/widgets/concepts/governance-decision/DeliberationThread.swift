import AppKit

class DeliberationThreadView: NSView {

    enum State: String { case viewing; case composing; case entrySelected }
    enum ArgumentTag: String { case forTag = "for"; case against; case question; case amendment }
    enum SortMode: String { case time; case tag; case relevance }

    struct Entry {
        let id: String
        let author: String
        let avatar: String?
        let content: String
        let timestamp: String
        let tag: ArgumentTag
        let parentId: String?
        let relevance: Int
    }

    private(set) var state: State = .viewing
    private var entries: [Entry] = []
    private var status: String = ""
    private var summary: String? = nil
    private var showSentiment: Bool = true
    private var showTags: Bool = true
    private var maxNesting: Int = 3
    private var sortMode: SortMode = .time
    private var replyTargetId: String? = nil
    private var selectedEntryId: String? = nil
    private var collapsedIds: Set<String> = []
    private var focusIndex: Int = 0
    private var flatEntryIds: [String] = []
    private var trackingArea: NSTrackingArea?

    var onReply: ((String, String) -> Void)?
    var onSortChange: ((SortMode) -> Void)?
    var onEntrySelect: ((String) -> Void)?

    private let rootStack = NSStackView()
    private let headerStack = NSStackView()
    private let statusLabel = NSTextField(labelWithString: "")
    private let summaryLabel = NSTextField(labelWithString: "")
    private let sortStack = NSStackView()
    private let sentimentBar = NSView()
    private let sentimentForView = NSView()
    private let sentimentAgainstView = NSView()
    private let entryScroll = NSScrollView()
    private let entryContainer = NSStackView()
    private let composeBox = NSStackView()
    private let composeTextView = NSTextView()
    private let composeScrollView = NSScrollView()

    private var sentimentForWidth: NSLayoutConstraint?

    // MARK: - State machine

    func reduce(_ event: String, entryId: String? = nil) {
        switch state {
        case .viewing:
            if event == "REPLY_TO", let id = entryId { state = .composing; replyTargetId = id }
            if event == "SELECT_ENTRY", let id = entryId { state = .entrySelected; selectedEntryId = id; onEntrySelect?(id) }
        case .composing:
            if event == "SEND" { handleSend(); state = .viewing; replyTargetId = nil }
            if event == "CANCEL" { state = .viewing; replyTargetId = nil }
        case .entrySelected:
            if event == "DESELECT" { state = .viewing; selectedEntryId = nil }
            if event == "REPLY_TO", let id = entryId { state = .composing; replyTargetId = id; selectedEntryId = nil }
        }
        updateUI()
    }

    // MARK: - Init

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Threaded discussion view for governance deliberation")
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

        // Header
        headerStack.orientation = .vertical
        headerStack.spacing = 4
        statusLabel.font = .boldSystemFont(ofSize: 14)
        summaryLabel.font = .systemFont(ofSize: 12)
        summaryLabel.textColor = .secondaryLabelColor
        summaryLabel.maximumNumberOfLines = 3
        headerStack.addArrangedSubview(statusLabel)
        headerStack.addArrangedSubview(summaryLabel)

        // Sort controls
        sortStack.orientation = .horizontal
        sortStack.spacing = 4
        for mode in [SortMode.time, .tag, .relevance] {
            let btn = NSButton(title: mode.rawValue.capitalized, target: self, action: #selector(handleSortClick(_:)))
            btn.bezelStyle = .roundRect
            btn.tag = mode == .time ? 0 : mode == .tag ? 1 : 2
            btn.setAccessibilityLabel("Sort by \(mode.rawValue)")
            sortStack.addArrangedSubview(btn)
        }
        headerStack.addArrangedSubview(sortStack)
        rootStack.addArrangedSubview(headerStack)

        // Sentiment bar
        sentimentBar.wantsLayer = true
        sentimentBar.layer?.cornerRadius = 4
        sentimentBar.heightAnchor.constraint(equalToConstant: 8).isActive = true
        sentimentForView.wantsLayer = true
        sentimentForView.layer?.backgroundColor = NSColor.systemGreen.cgColor
        sentimentAgainstView.wantsLayer = true
        sentimentAgainstView.layer?.backgroundColor = NSColor.systemRed.cgColor
        sentimentBar.addSubview(sentimentForView)
        sentimentBar.addSubview(sentimentAgainstView)
        sentimentForView.translatesAutoresizingMaskIntoConstraints = false
        sentimentAgainstView.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            sentimentForView.topAnchor.constraint(equalTo: sentimentBar.topAnchor),
            sentimentForView.bottomAnchor.constraint(equalTo: sentimentBar.bottomAnchor),
            sentimentForView.leadingAnchor.constraint(equalTo: sentimentBar.leadingAnchor),
            sentimentAgainstView.topAnchor.constraint(equalTo: sentimentBar.topAnchor),
            sentimentAgainstView.bottomAnchor.constraint(equalTo: sentimentBar.bottomAnchor),
            sentimentAgainstView.leadingAnchor.constraint(equalTo: sentimentForView.trailingAnchor),
            sentimentAgainstView.trailingAnchor.constraint(equalTo: sentimentBar.trailingAnchor),
        ])
        sentimentForWidth = sentimentForView.widthAnchor.constraint(equalTo: sentimentBar.widthAnchor, multiplier: 0.5)
        sentimentForWidth?.isActive = true
        sentimentBar.setAccessibilityRole(.image)
        rootStack.addArrangedSubview(sentimentBar)

        // Entry list
        entryScroll.hasVerticalScroller = true
        entryScroll.drawsBackground = false
        entryContainer.orientation = .vertical
        entryContainer.spacing = 6
        entryScroll.documentView = entryContainer
        rootStack.addArrangedSubview(entryScroll)

        // Compose box (hidden by default)
        composeBox.orientation = .vertical
        composeBox.spacing = 4
        composeBox.isHidden = true
        composeScrollView.hasVerticalScroller = true
        composeScrollView.documentView = composeTextView
        composeTextView.isEditable = true
        composeTextView.isRichText = false
        composeTextView.font = .systemFont(ofSize: 13)
        composeScrollView.heightAnchor.constraint(greaterThanOrEqualToConstant: 60).isActive = true
        composeBox.addArrangedSubview(composeScrollView)

        let actionStack = NSStackView()
        actionStack.orientation = .horizontal
        actionStack.spacing = 6
        let sendBtn = NSButton(title: "Send", target: self, action: #selector(handleSendClick(_:)))
        sendBtn.bezelStyle = .roundRect
        sendBtn.setAccessibilityLabel("Send reply")
        let cancelBtn = NSButton(title: "Cancel", target: self, action: #selector(handleCancelClick(_:)))
        cancelBtn.bezelStyle = .roundRect
        cancelBtn.setAccessibilityLabel("Cancel reply")
        actionStack.addArrangedSubview(sendBtn)
        actionStack.addArrangedSubview(cancelBtn)
        composeBox.addArrangedSubview(actionStack)
        rootStack.addArrangedSubview(composeBox)

        updateUI()
    }

    // MARK: - Configure

    func configure(entries: [Entry], status: String, summary: String? = nil, showSentiment: Bool = true, showTags: Bool = true, maxNesting: Int = 3, sortMode: SortMode = .time) {
        self.entries = entries
        self.status = status
        self.summary = summary
        self.showSentiment = showSentiment
        self.showTags = showTags
        self.maxNesting = maxNesting
        self.sortMode = sortMode
        rebuildEntryList()
        updateUI()
    }

    private func sortedEntries() -> [Entry] {
        switch sortMode {
        case .time: return entries.sorted { $0.timestamp < $1.timestamp }
        case .tag: return entries.sorted { tagOrder($0.tag) < tagOrder($1.tag) }
        case .relevance: return entries.sorted { $0.relevance > $1.relevance }
        }
    }

    private func tagOrder(_ tag: ArgumentTag) -> Int {
        switch tag { case .forTag: return 0; case .against: return 1; case .question: return 2; case .amendment: return 3 }
    }

    private func tagColor(_ tag: ArgumentTag) -> NSColor {
        switch tag { case .forTag: return .systemGreen; case .against: return .systemRed; case .question: return .systemBlue; case .amendment: return .systemYellow }
    }

    private func tagLabel(_ tag: ArgumentTag) -> String {
        switch tag { case .forTag: return "For"; case .against: return "Against"; case .question: return "Question"; case .amendment: return "Amendment" }
    }

    private func rebuildEntryList() {
        entryContainer.arrangedSubviews.forEach { $0.removeFromSuperview() }
        flatEntryIds = []

        let sorted = sortedEntries()
        let topLevel = sorted.filter { $0.parentId == nil }

        for entry in topLevel {
            addEntryView(entry, depth: 0, sorted: sorted)
        }
    }

    private func addEntryView(_ entry: Entry, depth: Int, sorted: [Entry]) {
        flatEntryIds.append(entry.id)
        let isCollapsed = collapsedIds.contains(entry.id)

        let entryStack = NSStackView()
        entryStack.orientation = .vertical
        entryStack.spacing = 2
        entryStack.edgeInsets = NSEdgeInsets(top: 4, left: CGFloat(depth * 24) + 4, bottom: 4, right: 4)

        // Author + tag row
        let headerRow = NSStackView()
        headerRow.orientation = .horizontal
        headerRow.spacing = 6

        let avatarLabel = NSTextField(labelWithString: String(entry.author.prefix(1)).uppercased())
        avatarLabel.font = .boldSystemFont(ofSize: 12)
        avatarLabel.alignment = .center
        avatarLabel.widthAnchor.constraint(equalToConstant: 28).isActive = true
        headerRow.addArrangedSubview(avatarLabel)

        let authorLabel = NSTextField(labelWithString: entry.author)
        authorLabel.font = .boldSystemFont(ofSize: 13)
        headerRow.addArrangedSubview(authorLabel)

        if showTags {
            let tagBadge = NSTextField(labelWithString: tagLabel(entry.tag))
            tagBadge.font = .boldSystemFont(ofSize: 11)
            tagBadge.textColor = .white
            tagBadge.wantsLayer = true
            tagBadge.layer?.backgroundColor = tagColor(entry.tag).cgColor
            tagBadge.layer?.cornerRadius = 8
            headerRow.addArrangedSubview(tagBadge)
        }

        entryStack.addArrangedSubview(headerRow)

        // Content
        let contentLabel = NSTextField(wrappingLabelWithString: entry.content)
        contentLabel.font = .systemFont(ofSize: 13)
        entryStack.addArrangedSubview(contentLabel)

        // Timestamp + reply button
        let footerRow = NSStackView()
        footerRow.orientation = .horizontal
        footerRow.spacing = 8
        let timeLabel = NSTextField(labelWithString: entry.timestamp)
        timeLabel.font = .systemFont(ofSize: 11)
        timeLabel.textColor = .secondaryLabelColor
        footerRow.addArrangedSubview(timeLabel)

        let replyBtn = NSButton(title: "Reply", target: self, action: #selector(handleReplyClick(_:)))
        replyBtn.bezelStyle = .roundRect
        replyBtn.font = .systemFont(ofSize: 11)
        replyBtn.identifier = NSUserInterfaceItemIdentifier(entry.id)
        replyBtn.setAccessibilityLabel("Reply to \(entry.author)")
        footerRow.addArrangedSubview(replyBtn)

        entryStack.addArrangedSubview(footerRow)

        // Highlight if selected
        if selectedEntryId == entry.id {
            entryStack.wantsLayer = true
            entryStack.layer?.borderWidth = 2
            entryStack.layer?.borderColor = NSColor.controlAccentColor.cgColor
            entryStack.layer?.cornerRadius = 4
        }

        entryStack.setAccessibilityRole(.group)
        entryStack.setAccessibilityLabel("\(entry.author): \(tagLabel(entry.tag)) \u{2014} \(entry.timestamp)")

        entryContainer.addArrangedSubview(entryStack)

        // Children
        if depth < maxNesting && !isCollapsed {
            let children = sorted.filter { $0.parentId == entry.id }
            for child in children {
                addEntryView(child, depth: depth + 1, sorted: sorted)
            }
        }
    }

    private func handleSend() {
        let text = composeTextView.string.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, let targetId = replyTargetId else { return }
        onReply?(targetId, text)
        composeTextView.string = ""
    }

    private func updateUI() {
        statusLabel.stringValue = status.capitalized
        summaryLabel.stringValue = summary ?? ""
        summaryLabel.isHidden = summary == nil

        // Sentiment
        sentimentBar.isHidden = !showSentiment
        if showSentiment {
            let forCount = entries.filter { $0.tag == .forTag }.count
            let againstCount = entries.filter { $0.tag == .against }.count
            let total = forCount + againstCount
            let ratio: CGFloat = total > 0 ? CGFloat(forCount) / CGFloat(total) : 0.5
            sentimentForWidth?.isActive = false
            sentimentForWidth = sentimentForView.widthAnchor.constraint(equalTo: sentimentBar.widthAnchor, multiplier: ratio)
            sentimentForWidth?.isActive = true
            sentimentBar.setAccessibilityLabel("Sentiment: \(forCount) for, \(againstCount) against")
        }

        // Compose box
        composeBox.isHidden = state != .composing

        setAccessibilityValue("Deliberation thread, \(state.rawValue), \(entries.count) entries")
    }

    // MARK: - Actions

    @objc private func handleSortClick(_ sender: NSButton) {
        let mode: SortMode = sender.tag == 0 ? .time : sender.tag == 1 ? .tag : .relevance
        sortMode = mode
        onSortChange?(mode)
        rebuildEntryList()
        updateUI()
    }

    @objc private func handleReplyClick(_ sender: NSButton) {
        if let id = sender.identifier?.rawValue {
            reduce("REPLY_TO", entryId: id)
        }
    }

    @objc private func handleSendClick(_ sender: NSButton) { reduce("SEND") }
    @objc private func handleCancelClick(_ sender: NSButton) { reduce("CANCEL") }

    // MARK: - Keyboard

    override var acceptsFirstResponder: Bool { true }

    override func keyDown(with event: NSEvent) {
        switch event.keyCode {
        case 125: // Down
            focusIndex = min(focusIndex + 1, flatEntryIds.count - 1)
        case 126: // Up
            focusIndex = max(focusIndex - 1, 0)
        case 36: // Enter
            if focusIndex < flatEntryIds.count { reduce("REPLY_TO", entryId: flatEntryIds[focusIndex]) }
        case 53: // Escape
            if state == .composing { reduce("CANCEL") }
            else if state == .entrySelected { reduce("DESELECT") }
        default: super.keyDown(with: event)
        }
    }

    // MARK: - Cleanup

    deinit {}
}
