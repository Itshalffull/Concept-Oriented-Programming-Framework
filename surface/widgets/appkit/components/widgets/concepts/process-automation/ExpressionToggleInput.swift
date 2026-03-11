import AppKit

class ExpressionToggleInputView: NSView {

    enum State: String { case fixed; case expression; case autocompleting }

    private(set) var state: State = .fixed
    private var fixedValue: String = ""
    private var expressionValue: String = ""
    private var autocompleteSuggestions: [String] = []
    private var trackingArea: NSTrackingArea?

    var onValueChange: ((String) -> Void)?
    var onExpressionChange: ((String) -> Void)?
    var onAutocompleteRequest: ((String) -> Void)?

    private let rootStack = NSStackView()
    private let modeToggle = NSSegmentedControl()
    private let fixedInput = NSTextField()
    private let expressionInput = NSTextField()
    private let autocompleteScroll = NSScrollView()
    private let autocompleteContainer = NSStackView()
    private let previewLabel = NSTextField(labelWithString: "")

    func reduce(_ event: String) {
        switch state {
        case .fixed:
            if event == "SWITCH_EXPRESSION" { state = .expression }
        case .expression:
            if event == "SWITCH_FIXED" { state = .fixed }
            if event == "AUTOCOMPLETE" { state = .autocompleting }
        case .autocompleting:
            if event == "SELECT" { state = .expression }
            if event == "DISMISS" { state = .expression }
            if event == "SWITCH_FIXED" { state = .fixed }
        }
        updateUI()
    }

    override init(frame: NSRect) {
        super.init(frame: frame); setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Dual-mode input field that switches between fixed value and expression")
    }
    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        wantsLayer = true
        rootStack.orientation = .vertical; rootStack.spacing = 4
        rootStack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(rootStack)
        NSLayoutConstraint.activate([
            rootStack.topAnchor.constraint(equalTo: topAnchor, constant: 4),
            rootStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
            rootStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
            rootStack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -4),
        ])

        modeToggle.segmentCount = 2
        modeToggle.setLabel("Fixed", forSegment: 0); modeToggle.setLabel("Expression", forSegment: 1)
        modeToggle.selectedSegment = 0; modeToggle.target = self; modeToggle.action = #selector(handleModeToggle(_:))
        modeToggle.setAccessibilityLabel("Input mode")
        rootStack.addArrangedSubview(modeToggle)

        fixedInput.placeholderString = "Enter value..."
        fixedInput.target = self; fixedInput.action = #selector(handleFixedInput(_:))
        fixedInput.setAccessibilityLabel("Fixed value input")
        rootStack.addArrangedSubview(fixedInput)

        expressionInput.placeholderString = "Enter expression..."
        expressionInput.target = self; expressionInput.action = #selector(handleExpressionInput(_:))
        expressionInput.font = .monospacedSystemFont(ofSize: 13, weight: .regular)
        expressionInput.setAccessibilityLabel("Expression input")
        expressionInput.isHidden = true
        rootStack.addArrangedSubview(expressionInput)

        autocompleteScroll.hasVerticalScroller = true; autocompleteScroll.drawsBackground = false
        autocompleteContainer.orientation = .vertical; autocompleteContainer.spacing = 2
        autocompleteScroll.documentView = autocompleteContainer
        autocompleteScroll.isHidden = true
        autocompleteScroll.heightAnchor.constraint(lessThanOrEqualToConstant: 120).isActive = true
        rootStack.addArrangedSubview(autocompleteScroll)

        previewLabel.font = .systemFont(ofSize: 11); previewLabel.textColor = .tertiaryLabelColor
        previewLabel.isHidden = true
        rootStack.addArrangedSubview(previewLabel)
        updateUI()
    }

    func configure(fixedValue: String = "", expressionValue: String = "", mode: State = .fixed) {
        self.fixedValue = fixedValue; self.expressionValue = expressionValue; self.state = mode
        fixedInput.stringValue = fixedValue; expressionInput.stringValue = expressionValue
        modeToggle.selectedSegment = mode == .fixed ? 0 : 1
        updateUI()
    }

    func setSuggestions(_ suggestions: [String]) {
        autocompleteSuggestions = suggestions
        autocompleteContainer.arrangedSubviews.forEach { $0.removeFromSuperview() }
        for (i, s) in suggestions.enumerated() {
            let btn = NSButton(title: s, target: self, action: #selector(handleSuggestionClick(_:)))
            btn.bezelStyle = .roundRect; btn.tag = i
            autocompleteContainer.addArrangedSubview(btn)
        }
        if !suggestions.isEmpty && state == .expression { reduce("AUTOCOMPLETE") }
    }

    private func updateUI() {
        let isFixed = state == .fixed
        fixedInput.isHidden = !isFixed
        expressionInput.isHidden = isFixed
        autocompleteScroll.isHidden = state != .autocompleting
        previewLabel.isHidden = isFixed
        if !isFixed { previewLabel.stringValue = "Preview: \(expressionValue)" }
        setAccessibilityValue("\(state.rawValue) mode")
    }

    @objc private func handleModeToggle(_ sender: NSSegmentedControl) {
        if sender.selectedSegment == 0 { reduce("SWITCH_FIXED") } else { reduce("SWITCH_EXPRESSION") }
    }
    @objc private func handleFixedInput(_ sender: NSTextField) { fixedValue = sender.stringValue; onValueChange?(fixedValue) }
    @objc private func handleExpressionInput(_ sender: NSTextField) {
        expressionValue = sender.stringValue; onExpressionChange?(expressionValue); onAutocompleteRequest?(expressionValue)
    }
    @objc private func handleSuggestionClick(_ sender: NSButton) {
        let idx = sender.tag; guard idx < autocompleteSuggestions.count else { return }
        expressionValue = autocompleteSuggestions[idx]; expressionInput.stringValue = expressionValue
        onExpressionChange?(expressionValue); reduce("SELECT")
    }

    override var acceptsFirstResponder: Bool { true }
    override func keyDown(with event: NSEvent) {
        if event.keyCode == 53 && state == .autocompleting { reduce("DISMISS") }
        else { super.keyDown(with: event) }
    }
    deinit {}
}
