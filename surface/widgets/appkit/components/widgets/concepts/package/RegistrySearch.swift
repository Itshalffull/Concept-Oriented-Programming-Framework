import AppKit

class RegistrySearchView: NSView {

    enum State: String { case idle; case searching }

    struct SearchResult {
        let name: String
        let version: String
        let description: String
        let keywords: [String]
        let downloads: Int
        let date: String
    }

    private(set) var state: State = .idle
    private var results: [SearchResult] = []
    private var searchText: String = ""
    private var focusIndex: Int = 0

    var onSearch: ((String) -> Void)?
    var onSelect: ((String) -> Void)?

    private let rootStack = NSStackView()
    private let searchField = NSSearchField()
    private let resultScroll = NSScrollView()
    private let resultContainer = NSStackView()
    private let emptyLabel = NSTextField(labelWithString: "Search the package registry")

    func reduce(_ event: String) {
        switch state {
        case .idle: if event == "SEARCH" { state = .searching }
        case .searching: if event == "RESULTS" { state = .idle }; if event == "CLEAR" { state = .idle; searchText = "" }
        }
        updateUI()
    }

    override init(frame: NSRect) {
        super.init(frame: frame); setupSubviews()
        setAccessibilityRole(.group); setAccessibilityLabel("Search interface for the package registry")
    }
    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        wantsLayer = true
        rootStack.orientation = .vertical; rootStack.spacing = 6
        rootStack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(rootStack)
        NSLayoutConstraint.activate([
            rootStack.topAnchor.constraint(equalTo: topAnchor, constant: 8),
            rootStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
            rootStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
            rootStack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -8),
        ])

        searchField.placeholderString = "Search packages..."; searchField.target = self; searchField.action = #selector(handleSearch(_:))
        searchField.setAccessibilityLabel("Search packages")
        rootStack.addArrangedSubview(searchField)

        resultScroll.hasVerticalScroller = true; resultScroll.drawsBackground = false
        resultContainer.orientation = .vertical; resultContainer.spacing = 6
        resultScroll.documentView = resultContainer
        rootStack.addArrangedSubview(resultScroll)

        emptyLabel.font = .systemFont(ofSize: 13); emptyLabel.textColor = .secondaryLabelColor; emptyLabel.alignment = .center
        rootStack.addArrangedSubview(emptyLabel)
        updateUI()
    }

    func configure(results: [SearchResult]) {
        self.results = results; rebuildResults(); reduce("RESULTS")
    }

    private func rebuildResults() {
        resultContainer.arrangedSubviews.forEach { $0.removeFromSuperview() }
        for (i, result) in results.enumerated() {
            let card = NSStackView(); card.orientation = .vertical; card.spacing = 2
            card.wantsLayer = true; card.layer?.cornerRadius = 6; card.layer?.borderWidth = 1; card.layer?.borderColor = NSColor.separatorColor.cgColor

            let nameRow = NSStackView(); nameRow.orientation = .horizontal; nameRow.spacing = 8
            let nameBtn = NSButton(title: result.name, target: self, action: #selector(handleResultClick(_:)))
            nameBtn.bezelStyle = .roundRect; nameBtn.tag = i; nameBtn.setAccessibilityLabel(result.name)
            let versionLabel = NSTextField(labelWithString: "v\(result.version)")
            versionLabel.font = .systemFont(ofSize: 11); versionLabel.textColor = .secondaryLabelColor
            nameRow.addArrangedSubview(nameBtn); nameRow.addArrangedSubview(versionLabel)
            card.addArrangedSubview(nameRow)

            let descLabel = NSTextField(wrappingLabelWithString: result.description)
            descLabel.font = .systemFont(ofSize: 12); descLabel.textColor = .secondaryLabelColor; descLabel.maximumNumberOfLines = 2
            card.addArrangedSubview(descLabel)

            let metaRow = NSStackView(); metaRow.orientation = .horizontal; metaRow.spacing = 12
            let dlLabel = NSTextField(labelWithString: "\(result.downloads) downloads")
            dlLabel.font = .systemFont(ofSize: 10); dlLabel.textColor = .tertiaryLabelColor
            let dateLabel = NSTextField(labelWithString: result.date)
            dateLabel.font = .systemFont(ofSize: 10); dateLabel.textColor = .tertiaryLabelColor
            metaRow.addArrangedSubview(dlLabel); metaRow.addArrangedSubview(dateLabel)
            card.addArrangedSubview(metaRow)

            resultContainer.addArrangedSubview(card)
        }
    }

    private func updateUI() {
        emptyLabel.isHidden = !results.isEmpty || state == .searching
        if state == .searching { emptyLabel.stringValue = "Searching..." } else if results.isEmpty { emptyLabel.stringValue = "Search the package registry" }
        setAccessibilityValue("\(results.count) results, \(state.rawValue)")
    }

    @objc private func handleSearch(_ sender: NSSearchField) {
        searchText = sender.stringValue
        if searchText.isEmpty { reduce("CLEAR") } else { reduce("SEARCH"); onSearch?(searchText) }
    }
    @objc private func handleResultClick(_ sender: NSButton) {
        let idx = sender.tag; guard idx < results.count else { return }; onSelect?(results[idx].name)
    }

    override var acceptsFirstResponder: Bool { true }
    override func keyDown(with event: NSEvent) {
        switch event.keyCode {
        case 125: focusIndex = min(focusIndex + 1, results.count - 1)
        case 126: focusIndex = max(focusIndex - 1, 0)
        default: super.keyDown(with: event)
        }
    }
    deinit {}
}
