import AppKit

class VariableInspectorView: NSView {

    enum State: String { case idle; case filtering; case varSelected }

    struct Variable {
        let name: String
        let type: String
        let value: String
        let isWatched: Bool
    }

    private(set) var state: State = .idle
    private var variables: [Variable] = []
    private var filteredVariables: [Variable] = []
    private var selectedVarName: String? = nil
    private var searchText: String = ""
    private var focusIndex: Int = 0

    var onVarSelect: ((String) -> Void)?
    var onWatch: ((String) -> Void)?

    private let rootStack = NSStackView()
    private let searchField = NSSearchField()
    private let varScroll = NSScrollView()
    private let varContainer = NSStackView()
    private let watchHeader = NSTextField(labelWithString: "Watched")
    private let watchContainer = NSStackView()

    func reduce(_ event: String, varName: String? = nil) {
        switch state {
        case .idle:
            if event == "FILTER" { state = .filtering }
            if event == "SELECT_VAR", let name = varName { state = .varSelected; selectedVarName = name; onVarSelect?(name) }
        case .filtering:
            if event == "CLEAR_FILTER" { state = .idle; searchText = ""; applyFilter() }
            if event == "SELECT_VAR", let name = varName { state = .varSelected; selectedVarName = name; onVarSelect?(name) }
        case .varSelected:
            if event == "DESELECT" { state = .idle; selectedVarName = nil }
            if event == "SELECT_VAR", let name = varName { selectedVarName = name; onVarSelect?(name) }
        }
        updateUI()
    }

    override init(frame: NSRect) {
        super.init(frame: frame); setupSubviews()
        setAccessibilityRole(.group); setAccessibilityLabel("Key-value inspector panel for process runtime variables")
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

        searchField.placeholderString = "Filter variables..."; searchField.target = self; searchField.action = #selector(handleSearch(_:))
        rootStack.addArrangedSubview(searchField)

        varScroll.hasVerticalScroller = true; varScroll.drawsBackground = false
        varContainer.orientation = .vertical; varContainer.spacing = 2
        varScroll.documentView = varContainer
        rootStack.addArrangedSubview(varScroll)

        watchHeader.font = .boldSystemFont(ofSize: 12); watchHeader.textColor = .secondaryLabelColor
        rootStack.addArrangedSubview(watchHeader)
        watchContainer.orientation = .vertical; watchContainer.spacing = 2
        rootStack.addArrangedSubview(watchContainer)
        updateUI()
    }

    func configure(variables: [Variable]) {
        self.variables = variables; applyFilter(); updateUI()
    }

    private func applyFilter() {
        if searchText.isEmpty { filteredVariables = variables }
        else { filteredVariables = variables.filter { $0.name.localizedCaseInsensitiveContains(searchText) || $0.type.localizedCaseInsensitiveContains(searchText) } }
        rebuildList()
    }

    private func rebuildList() {
        varContainer.arrangedSubviews.forEach { $0.removeFromSuperview() }
        watchContainer.arrangedSubviews.forEach { $0.removeFromSuperview() }

        for (i, v) in filteredVariables.enumerated() {
            let row = NSStackView(); row.orientation = .horizontal; row.spacing = 8
            row.wantsLayer = true
            if selectedVarName == v.name { row.layer?.backgroundColor = NSColor.controlAccentColor.withAlphaComponent(0.1).cgColor }

            let nameBtn = NSButton(title: v.name, target: self, action: #selector(handleVarClick(_:)))
            nameBtn.bezelStyle = .roundRect; nameBtn.tag = i
            nameBtn.setAccessibilityLabel("\(v.name): \(v.type) = \(v.value)")
            row.addArrangedSubview(nameBtn)

            let typeLabel = NSTextField(labelWithString: v.type)
            typeLabel.font = .systemFont(ofSize: 10); typeLabel.textColor = .tertiaryLabelColor
            row.addArrangedSubview(typeLabel)

            let valueLabel = NSTextField(labelWithString: v.value)
            valueLabel.font = .monospacedSystemFont(ofSize: 11, weight: .regular)
            row.addArrangedSubview(valueLabel)

            varContainer.addArrangedSubview(row)

            if v.isWatched {
                let watchRow = NSStackView(); watchRow.orientation = .horizontal; watchRow.spacing = 8
                let wn = NSTextField(labelWithString: v.name); wn.font = .boldSystemFont(ofSize: 11)
                let wv = NSTextField(labelWithString: v.value); wv.font = .monospacedSystemFont(ofSize: 11, weight: .regular)
                watchRow.addArrangedSubview(wn); watchRow.addArrangedSubview(wv)
                watchContainer.addArrangedSubview(watchRow)
            }
        }

        let watchedCount = variables.filter { $0.isWatched }.count
        watchHeader.isHidden = watchedCount == 0
        watchContainer.isHidden = watchedCount == 0
    }

    private func updateUI() { setAccessibilityValue("\(filteredVariables.count) variables, \(state.rawValue)") }

    @objc private func handleSearch(_ sender: NSSearchField) {
        searchText = sender.stringValue
        if searchText.isEmpty { reduce("CLEAR_FILTER") } else { reduce("FILTER"); applyFilter() }
    }
    @objc private func handleVarClick(_ sender: NSButton) {
        let idx = sender.tag; guard idx < filteredVariables.count else { return }
        reduce("SELECT_VAR", varName: filteredVariables[idx].name)
    }

    override var acceptsFirstResponder: Bool { true }
    override func keyDown(with event: NSEvent) {
        switch event.keyCode {
        case 125: focusIndex = min(focusIndex + 1, filteredVariables.count - 1); if focusIndex < filteredVariables.count { reduce("SELECT_VAR", varName: filteredVariables[focusIndex].name) }
        case 126: focusIndex = max(focusIndex - 1, 0); if focusIndex < filteredVariables.count { reduce("SELECT_VAR", varName: filteredVariables[focusIndex].name) }
        case 53: reduce("DESELECT")
        default: super.keyDown(with: event)
        }
    }
    deinit {}
}
