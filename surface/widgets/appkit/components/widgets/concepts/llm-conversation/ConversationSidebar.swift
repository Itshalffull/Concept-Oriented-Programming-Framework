import AppKit

class ConversationSidebarView: NSView {

    enum State: String { case idle; case searching; case contextOpen }

    struct Conversation {
        let id: String
        let title: String
        let preview: String
        let timestamp: String
        let model: String?
        let group: String?
    }

    private(set) var state: State = .idle
    private var conversations: [Conversation] = []
    private var filteredConversations: [Conversation] = []
    private var selectedConversationId: String? = nil
    private var searchText: String = ""
    private var focusIndex: Int = 0
    private var trackingArea: NSTrackingArea?

    var onSelect: ((String) -> Void)?
    var onNew: (() -> Void)?
    var onDelete: ((String) -> Void)?

    private let rootStack = NSStackView()
    private let searchField = NSSearchField()
    private let newBtn = NSButton(title: "New", target: nil, action: nil)
    private let listScroll = NSScrollView()
    private let listContainer = NSStackView()

    // MARK: - State machine

    func reduce(_ event: String) {
        switch state {
        case .idle:
            if event == "SEARCH" { state = .searching }
            if event == "CONTEXT_OPEN" { state = .contextOpen }
        case .searching:
            if event == "CLEAR_SEARCH" { state = .idle; searchText = ""; applyFilter() }
        case .contextOpen:
            if event == "CONTEXT_CLOSE" { state = .idle }
        }
        updateUI()
    }

    // MARK: - Init

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Sidebar panel listing conversation history")
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

        let topRow = NSStackView()
        topRow.orientation = .horizontal
        topRow.spacing = 6
        searchField.placeholderString = "Search conversations..."
        searchField.target = self
        searchField.action = #selector(handleSearch(_:))
        searchField.setAccessibilityLabel("Search conversations")
        newBtn.bezelStyle = .roundRect
        newBtn.target = self
        newBtn.action = #selector(handleNew(_:))
        newBtn.setAccessibilityLabel("New conversation")
        topRow.addArrangedSubview(searchField)
        topRow.addArrangedSubview(newBtn)
        rootStack.addArrangedSubview(topRow)

        listScroll.hasVerticalScroller = true
        listScroll.drawsBackground = false
        listContainer.orientation = .vertical
        listContainer.spacing = 2
        listScroll.documentView = listContainer
        rootStack.addArrangedSubview(listScroll)

        updateUI()
    }

    // MARK: - Configure

    func configure(conversations: [Conversation], selectedId: String? = nil) {
        self.conversations = conversations
        self.selectedConversationId = selectedId
        applyFilter()
        updateUI()
    }

    private func applyFilter() {
        if searchText.isEmpty {
            filteredConversations = conversations
        } else {
            filteredConversations = conversations.filter { $0.title.localizedCaseInsensitiveContains(searchText) || $0.preview.localizedCaseInsensitiveContains(searchText) }
        }
        rebuildList()
    }

    private func rebuildList() {
        listContainer.arrangedSubviews.forEach { $0.removeFromSuperview() }

        // Group by date group
        var currentGroup = ""
        for (i, conv) in filteredConversations.enumerated() {
            let group = conv.group ?? "Other"
            if group != currentGroup {
                currentGroup = group
                let groupLabel = NSTextField(labelWithString: group)
                groupLabel.font = .boldSystemFont(ofSize: 11)
                groupLabel.textColor = .tertiaryLabelColor
                listContainer.addArrangedSubview(groupLabel)
            }

            let row = NSStackView()
            row.orientation = .vertical
            row.spacing = 2
            row.wantsLayer = true
            row.layer?.cornerRadius = 4
            if selectedConversationId == conv.id {
                row.layer?.backgroundColor = NSColor.controlAccentColor.withAlphaComponent(0.1).cgColor
            }

            let titleBtn = NSButton(title: conv.title, target: self, action: #selector(handleConvClick(_:)))
            titleBtn.bezelStyle = .roundRect
            titleBtn.tag = i
            titleBtn.setAccessibilityLabel(conv.title)
            row.addArrangedSubview(titleBtn)

            let previewLabel = NSTextField(labelWithString: String(conv.preview.prefix(60)))
            previewLabel.font = .systemFont(ofSize: 11)
            previewLabel.textColor = .secondaryLabelColor
            row.addArrangedSubview(previewLabel)

            let metaRow = NSStackView()
            metaRow.orientation = .horizontal
            metaRow.spacing = 8
            let timeLabel = NSTextField(labelWithString: conv.timestamp)
            timeLabel.font = .systemFont(ofSize: 10)
            timeLabel.textColor = .tertiaryLabelColor
            metaRow.addArrangedSubview(timeLabel)
            if let model = conv.model {
                let modelLabel = NSTextField(labelWithString: model)
                modelLabel.font = .systemFont(ofSize: 10)
                modelLabel.textColor = .tertiaryLabelColor
                metaRow.addArrangedSubview(modelLabel)
            }
            row.addArrangedSubview(metaRow)

            listContainer.addArrangedSubview(row)
        }
    }

    private func updateUI() {
        setAccessibilityValue("\(filteredConversations.count) conversations, \(state.rawValue)")
    }

    // MARK: - Actions

    @objc private func handleSearch(_ sender: NSSearchField) {
        searchText = sender.stringValue
        if searchText.isEmpty { reduce("CLEAR_SEARCH") } else { reduce("SEARCH"); applyFilter() }
    }

    @objc private func handleNew(_ sender: NSButton) { onNew?() }

    @objc private func handleConvClick(_ sender: NSButton) {
        let idx = sender.tag
        guard idx < filteredConversations.count else { return }
        selectedConversationId = filteredConversations[idx].id
        onSelect?(filteredConversations[idx].id)
        rebuildList()
    }

    // MARK: - Keyboard

    override var acceptsFirstResponder: Bool { true }

    override func keyDown(with event: NSEvent) {
        switch event.keyCode {
        case 125: focusIndex = min(focusIndex + 1, filteredConversations.count - 1); if focusIndex < filteredConversations.count { selectedConversationId = filteredConversations[focusIndex].id; onSelect?(filteredConversations[focusIndex].id); rebuildList() }
        case 126: focusIndex = max(focusIndex - 1, 0); if focusIndex < filteredConversations.count { selectedConversationId = filteredConversations[focusIndex].id; onSelect?(filteredConversations[focusIndex].id); rebuildList() }
        default: super.keyDown(with: event)
        }
    }

    deinit {}
}
