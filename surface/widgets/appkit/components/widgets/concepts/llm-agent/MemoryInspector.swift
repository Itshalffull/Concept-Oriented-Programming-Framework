import AppKit

class MemoryInspectorView: NSView {

    enum State: String { case viewing; case searching; case entrySelected; case deleting }
    enum MemoryTab: String { case working; case longTerm; case episodic }

    struct MemoryEntry {
        let id: String
        let label: String
        let content: String
        let memoryType: MemoryTab
        let metadata: String?
    }

    private(set) var state: State = .viewing
    private var entries: [MemoryEntry] = []
    private var filteredEntries: [MemoryEntry] = []
    private var selectedEntryId: String? = nil
    private var activeTab: MemoryTab = .working
    private var searchText: String = ""
    private var focusIndex: Int = 0
    private var trackingArea: NSTrackingArea?

    var onEntrySelect: ((String) -> Void)?
    var onDelete: ((String) -> Void)?

    private let rootStack = NSStackView()
    private let tabBar = NSSegmentedControl()
    private let searchField = NSSearchField()
    private let entryScroll = NSScrollView()
    private let entryContainer = NSStackView()
    private let detailPanel = NSStackView()
    private let detailLabelField = NSTextField(labelWithString: "")
    private let detailContentField = NSTextField(wrappingLabelWithString: "")
    private let detailMetaField = NSTextField(labelWithString: "")
    private let deleteBtn = NSButton(title: "Delete", target: nil, action: nil)

    // MARK: - State machine

    func reduce(_ event: String, entryId: String? = nil) {
        switch state {
        case .viewing:
            if event == "SEARCH" { state = .searching }
            if event == "SELECT_ENTRY", let id = entryId { state = .entrySelected; selectedEntryId = id; onEntrySelect?(id) }
        case .searching:
            if event == "CLEAR_SEARCH" { state = .viewing; searchText = ""; applyFilter() }
            if event == "SELECT_ENTRY", let id = entryId { state = .entrySelected; selectedEntryId = id; onEntrySelect?(id) }
        case .entrySelected:
            if event == "DESELECT" { state = .viewing; selectedEntryId = nil }
            if event == "DELETE" { state = .deleting }
            if event == "SELECT_ENTRY", let id = entryId { selectedEntryId = id; onEntrySelect?(id) }
        case .deleting:
            if event == "CONFIRM_DELETE" {
                if let id = selectedEntryId { onDelete?(id) }
                state = .viewing; selectedEntryId = nil
            }
            if event == "CANCEL" { state = .entrySelected }
        }
        updateUI()
    }

    // MARK: - Init

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Inspector panel for viewing and managing agent memory")
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

        // Tab bar
        tabBar.segmentCount = 3
        tabBar.setLabel("Working", forSegment: 0)
        tabBar.setLabel("Long-term", forSegment: 1)
        tabBar.setLabel("Episodic", forSegment: 2)
        tabBar.selectedSegment = 0
        tabBar.target = self
        tabBar.action = #selector(handleTabChange(_:))
        tabBar.setAccessibilityLabel("Memory type tabs")
        rootStack.addArrangedSubview(tabBar)

        // Search
        searchField.placeholderString = "Search memory..."
        searchField.target = self
        searchField.action = #selector(handleSearch(_:))
        searchField.setAccessibilityLabel("Search memory entries")
        rootStack.addArrangedSubview(searchField)

        // Entry list
        entryScroll.hasVerticalScroller = true
        entryScroll.drawsBackground = false
        entryContainer.orientation = .vertical
        entryContainer.spacing = 4
        entryScroll.documentView = entryContainer
        rootStack.addArrangedSubview(entryScroll)

        // Detail panel
        detailPanel.orientation = .vertical
        detailPanel.spacing = 4
        detailPanel.isHidden = true
        detailLabelField.font = .boldSystemFont(ofSize: 13)
        detailContentField.font = .systemFont(ofSize: 12)
        detailMetaField.font = .systemFont(ofSize: 11)
        detailMetaField.textColor = .tertiaryLabelColor
        deleteBtn.bezelStyle = .roundRect
        deleteBtn.contentTintColor = .systemRed
        deleteBtn.target = self
        deleteBtn.action = #selector(handleDelete(_:))
        deleteBtn.setAccessibilityLabel("Delete memory entry")
        detailPanel.addArrangedSubview(detailLabelField)
        detailPanel.addArrangedSubview(detailContentField)
        detailPanel.addArrangedSubview(detailMetaField)
        detailPanel.addArrangedSubview(deleteBtn)
        rootStack.addArrangedSubview(detailPanel)

        updateUI()
    }

    // MARK: - Configure

    func configure(entries: [MemoryEntry]) {
        self.entries = entries
        applyFilter()
        updateUI()
    }

    private func applyFilter() {
        filteredEntries = entries.filter { $0.memoryType == activeTab }
        if !searchText.isEmpty {
            filteredEntries = filteredEntries.filter {
                $0.label.localizedCaseInsensitiveContains(searchText) || $0.content.localizedCaseInsensitiveContains(searchText)
            }
        }
        rebuildList()
    }

    private func rebuildList() {
        entryContainer.arrangedSubviews.forEach { $0.removeFromSuperview() }

        for (i, entry) in filteredEntries.enumerated() {
            let row = NSStackView()
            row.orientation = .horizontal
            row.spacing = 8

            let btn = NSButton(title: entry.label, target: self, action: #selector(handleEntryClick(_:)))
            btn.bezelStyle = .roundRect
            btn.tag = i
            btn.setAccessibilityLabel(entry.label)
            if selectedEntryId == entry.id { btn.contentTintColor = .controlAccentColor }
            row.addArrangedSubview(btn)

            let preview = NSTextField(labelWithString: String(entry.content.prefix(40)))
            preview.font = .systemFont(ofSize: 11)
            preview.textColor = .secondaryLabelColor
            row.addArrangedSubview(preview)

            entryContainer.addArrangedSubview(row)
        }
    }

    private func updateUI() {
        if state == .entrySelected || state == .deleting,
           let id = selectedEntryId, let entry = entries.first(where: { $0.id == id }) {
            detailPanel.isHidden = false
            detailLabelField.stringValue = entry.label
            detailContentField.stringValue = entry.content
            detailMetaField.stringValue = entry.metadata ?? ""
            deleteBtn.isHidden = state == .deleting
        } else {
            detailPanel.isHidden = true
        }

        setAccessibilityValue("\(filteredEntries.count) entries, \(activeTab.rawValue) tab, \(state.rawValue)")
    }

    // MARK: - Actions

    @objc private func handleTabChange(_ sender: NSSegmentedControl) {
        activeTab = [MemoryTab.working, .longTerm, .episodic][sender.selectedSegment]
        applyFilter()
        updateUI()
    }

    @objc private func handleSearch(_ sender: NSSearchField) {
        searchText = sender.stringValue
        if searchText.isEmpty { reduce("CLEAR_SEARCH") } else { reduce("SEARCH"); applyFilter() }
    }

    @objc private func handleEntryClick(_ sender: NSButton) {
        let idx = sender.tag
        guard idx < filteredEntries.count else { return }
        reduce("SELECT_ENTRY", entryId: filteredEntries[idx].id)
    }

    @objc private func handleDelete(_ sender: NSButton) { reduce("DELETE") }

    // MARK: - Keyboard

    override var acceptsFirstResponder: Bool { true }

    override func keyDown(with event: NSEvent) {
        switch event.keyCode {
        case 125: focusIndex = min(focusIndex + 1, filteredEntries.count - 1); if focusIndex < filteredEntries.count { reduce("SELECT_ENTRY", entryId: filteredEntries[focusIndex].id) }
        case 126: focusIndex = max(focusIndex - 1, 0); if focusIndex < filteredEntries.count { reduce("SELECT_ENTRY", entryId: filteredEntries[focusIndex].id) }
        case 53: reduce("DESELECT")
        case 51: reduce("DELETE") // Backspace
        default: super.keyDown(with: event)
        }
    }

    deinit {}
}
