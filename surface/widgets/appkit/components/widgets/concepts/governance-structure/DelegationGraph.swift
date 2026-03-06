import AppKit

class DelegationGraphView: NSView {

    enum State: String { case browsing; case searching; case selected; case delegating; case undelegating }

    struct Delegate {
        let id: String
        let name: String
        let avatar: String?
        let votingPower: Double
        let participation: Double
    }

    private(set) var state: State = .browsing
    private var delegates: [Delegate] = []
    private var filteredDelegates: [Delegate] = []
    private var selectedDelegateId: String? = nil
    private var currentDelegateId: String? = nil
    private var searchText: String = ""
    private var focusIndex: Int = 0
    private var trackingArea: NSTrackingArea?

    var onDelegate: ((String) -> Void)?
    var onUndelegate: ((String) -> Void)?
    var onSelect: ((String) -> Void)?

    private let rootStack = NSStackView()
    private let searchField = NSSearchField()
    private let sortPopup = NSPopUpButton()
    private let listScroll = NSScrollView()
    private let listContainer = NSStackView()
    private let currentInfoPanel = NSStackView()
    private let currentInfoLabel = NSTextField(labelWithString: "")
    private let detailPanel = NSStackView()
    private let detailNameLabel = NSTextField(labelWithString: "")
    private let detailPowerLabel = NSTextField(labelWithString: "")
    private let detailParticipationLabel = NSTextField(labelWithString: "")
    private let delegateBtn = NSButton(title: "Delegate", target: nil, action: nil)
    private let undelegateBtn = NSButton(title: "Undelegate", target: nil, action: nil)

    // MARK: - State machine

    func reduce(_ event: String, delegateId: String? = nil) {
        switch state {
        case .browsing:
            if event == "SEARCH" { state = .searching }
            if event == "SELECT", let id = delegateId { state = .selected; selectedDelegateId = id; onSelect?(id) }
        case .searching:
            if event == "CLEAR_SEARCH" { state = .browsing; searchText = ""; applyFilter() }
            if event == "SELECT", let id = delegateId { state = .selected; selectedDelegateId = id; onSelect?(id) }
        case .selected:
            if event == "DESELECT" { state = .browsing; selectedDelegateId = nil }
            if event == "DELEGATE" { state = .delegating }
            if event == "UNDELEGATE" { state = .undelegating }
        case .delegating:
            if event == "CONFIRM" {
                if let id = selectedDelegateId { onDelegate?(id) }
                state = .browsing; selectedDelegateId = nil
            }
            if event == "CANCEL" { state = .selected }
        case .undelegating:
            if event == "CONFIRM" {
                if let id = selectedDelegateId { onUndelegate?(id) }
                state = .browsing; selectedDelegateId = nil
            }
            if event == "CANCEL" { state = .selected }
        }
        updateUI()
    }

    // MARK: - Init

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Interactive visualization of delegation relationships")
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

        // Search bar
        searchField.placeholderString = "Search delegates..."
        searchField.target = self
        searchField.action = #selector(handleSearch(_:))
        searchField.setAccessibilityLabel("Search delegates")
        rootStack.addArrangedSubview(searchField)

        // Sort control
        let controlRow = NSStackView()
        controlRow.orientation = .horizontal
        controlRow.spacing = 8
        sortPopup.addItems(withTitles: ["By Power", "By Participation", "By Name"])
        sortPopup.target = self
        sortPopup.action = #selector(handleSort(_:))
        controlRow.addArrangedSubview(sortPopup)
        rootStack.addArrangedSubview(controlRow)

        // Current delegation info
        currentInfoPanel.orientation = .horizontal
        currentInfoPanel.spacing = 6
        currentInfoPanel.isHidden = true
        currentInfoLabel.font = .systemFont(ofSize: 12)
        currentInfoLabel.textColor = .secondaryLabelColor
        currentInfoPanel.addArrangedSubview(currentInfoLabel)
        rootStack.addArrangedSubview(currentInfoPanel)

        // Delegate list
        listScroll.hasVerticalScroller = true
        listScroll.drawsBackground = false
        listContainer.orientation = .vertical
        listContainer.spacing = 4
        listScroll.documentView = listContainer
        rootStack.addArrangedSubview(listScroll)

        // Detail panel
        detailPanel.orientation = .vertical
        detailPanel.spacing = 4
        detailPanel.isHidden = true
        detailNameLabel.font = .boldSystemFont(ofSize: 14)
        detailPowerLabel.font = .systemFont(ofSize: 12)
        detailParticipationLabel.font = .systemFont(ofSize: 12)
        detailParticipationLabel.textColor = .secondaryLabelColor
        delegateBtn.bezelStyle = .roundRect
        delegateBtn.target = self
        delegateBtn.action = #selector(handleDelegate(_:))
        delegateBtn.setAccessibilityLabel("Delegate to this person")
        undelegateBtn.bezelStyle = .roundRect
        undelegateBtn.target = self
        undelegateBtn.action = #selector(handleUndelegate(_:))
        undelegateBtn.setAccessibilityLabel("Remove delegation")
        detailPanel.addArrangedSubview(detailNameLabel)
        detailPanel.addArrangedSubview(detailPowerLabel)
        detailPanel.addArrangedSubview(detailParticipationLabel)
        let btnRow = NSStackView()
        btnRow.orientation = .horizontal
        btnRow.spacing = 6
        btnRow.addArrangedSubview(delegateBtn)
        btnRow.addArrangedSubview(undelegateBtn)
        detailPanel.addArrangedSubview(btnRow)
        rootStack.addArrangedSubview(detailPanel)

        updateUI()
    }

    // MARK: - Configure

    func configure(delegates: [Delegate], currentDelegateId: String? = nil) {
        self.delegates = delegates
        self.currentDelegateId = currentDelegateId
        applyFilter()

        currentInfoPanel.isHidden = currentDelegateId == nil
        if let id = currentDelegateId, let d = delegates.first(where: { $0.id == id }) {
            currentInfoLabel.stringValue = "Currently delegated to: \(d.name)"
        }

        updateUI()
    }

    private func applyFilter() {
        if searchText.isEmpty {
            filteredDelegates = delegates
        } else {
            filteredDelegates = delegates.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
        }
        rebuildList()
    }

    private func rebuildList() {
        listContainer.arrangedSubviews.forEach { $0.removeFromSuperview() }

        for (i, del) in filteredDelegates.enumerated() {
            let row = NSStackView()
            row.orientation = .horizontal
            row.spacing = 8

            let avatar = NSTextField(labelWithString: String(del.name.prefix(1)).uppercased())
            avatar.font = .boldSystemFont(ofSize: 12)
            avatar.alignment = .center
            avatar.widthAnchor.constraint(equalToConstant: 28).isActive = true
            row.addArrangedSubview(avatar)

            let nameBtn = NSButton(title: del.name, target: self, action: #selector(handleDelegateClick(_:)))
            nameBtn.bezelStyle = .roundRect
            nameBtn.tag = i
            nameBtn.setAccessibilityLabel("\(del.name), power: \(String(format: "%.1f", del.votingPower))")
            row.addArrangedSubview(nameBtn)

            let power = NSTextField(labelWithString: String(format: "%.1f%%", del.votingPower * 100))
            power.font = .monospacedDigitSystemFont(ofSize: 11, weight: .regular)
            row.addArrangedSubview(power)

            let participation = NSTextField(labelWithString: String(format: "%.0f%%", del.participation * 100))
            participation.font = .systemFont(ofSize: 11)
            participation.textColor = .secondaryLabelColor
            row.addArrangedSubview(participation)

            listContainer.addArrangedSubview(row)
        }
    }

    private func updateUI() {
        if state == .selected || state == .delegating || state == .undelegating,
           let id = selectedDelegateId, let d = delegates.first(where: { $0.id == id }) {
            detailPanel.isHidden = false
            detailNameLabel.stringValue = d.name
            detailPowerLabel.stringValue = "Voting Power: \(String(format: "%.1f%%", d.votingPower * 100))"
            detailParticipationLabel.stringValue = "Participation: \(String(format: "%.0f%%", d.participation * 100))"
            delegateBtn.isHidden = state == .delegating || state == .undelegating
            undelegateBtn.isHidden = state == .delegating || state == .undelegating || currentDelegateId != id
        } else {
            detailPanel.isHidden = true
        }

        setAccessibilityValue("\(delegates.count) delegates, \(state.rawValue)")
    }

    // MARK: - Actions

    @objc private func handleSearch(_ sender: NSSearchField) {
        searchText = sender.stringValue
        if searchText.isEmpty { reduce("CLEAR_SEARCH") }
        else { reduce("SEARCH"); applyFilter() }
    }

    @objc private func handleSort(_ sender: NSPopUpButton) {
        switch sender.indexOfSelectedItem {
        case 0: filteredDelegates.sort { $0.votingPower > $1.votingPower }
        case 1: filteredDelegates.sort { $0.participation > $1.participation }
        case 2: filteredDelegates.sort { $0.name < $1.name }
        default: break
        }
        rebuildList()
    }

    @objc private func handleDelegateClick(_ sender: NSButton) {
        let idx = sender.tag
        guard idx < filteredDelegates.count else { return }
        reduce("SELECT", delegateId: filteredDelegates[idx].id)
    }

    @objc private func handleDelegate(_ sender: NSButton) { reduce("DELEGATE") }
    @objc private func handleUndelegate(_ sender: NSButton) { reduce("UNDELEGATE") }

    // MARK: - Keyboard

    override var acceptsFirstResponder: Bool { true }

    override func keyDown(with event: NSEvent) {
        switch event.keyCode {
        case 125: // Down
            focusIndex = min(focusIndex + 1, filteredDelegates.count - 1)
            if focusIndex < filteredDelegates.count { reduce("SELECT", delegateId: filteredDelegates[focusIndex].id) }
        case 126: // Up
            focusIndex = max(focusIndex - 1, 0)
            if focusIndex < filteredDelegates.count { reduce("SELECT", delegateId: filteredDelegates[focusIndex].id) }
        case 53: reduce("DESELECT") // Escape
        default: super.keyDown(with: event)
        }
    }

    // MARK: - Cleanup

    deinit {}
}
