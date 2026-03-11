import AppKit

class GuardrailConfigView: NSView {

    enum State: String { case viewing; case ruleSelected; case testing; case adding }

    struct Rule {
        let id: String
        let name: String
        let severity: String
        var enabled: Bool
        let description: String
    }

    private(set) var state: State = .viewing
    private var rules: [Rule] = []
    private var selectedRuleId: String? = nil
    private var focusIndex: Int = 0

    var onRuleToggle: ((String, Bool) -> Void)?
    var onTest: ((String) -> Void)?
    var onAddRule: (() -> Void)?

    private let rootStack = NSStackView()
    private let headerLabel = NSTextField(labelWithString: "Guardrail Configuration")
    private let ruleScroll = NSScrollView()
    private let ruleContainer = NSStackView()
    private let addBtn = NSButton(title: "+ Add Rule", target: nil, action: nil)
    private let detailPanel = NSStackView()
    private let detailNameLabel = NSTextField(labelWithString: "")
    private let detailDescLabel = NSTextField(wrappingLabelWithString: "")
    private let detailSeverityLabel = NSTextField(labelWithString: "")
    private let testBtn = NSButton(title: "Test", target: nil, action: nil)
    private let testResultLabel = NSTextField(wrappingLabelWithString: "")

    // MARK: - State machine

    func reduce(_ event: String, ruleId: String? = nil) {
        switch state {
        case .viewing:
            if event == "SELECT_RULE", let id = ruleId { state = .ruleSelected; selectedRuleId = id }
            if event == "ADD" { state = .adding; onAddRule?() }
        case .ruleSelected:
            if event == "DESELECT" { state = .viewing; selectedRuleId = nil }
            if event == "TEST" { state = .testing; if let id = selectedRuleId { onTest?(id) } }
            if event == "SELECT_RULE", let id = ruleId { selectedRuleId = id }
        case .testing:
            if event == "TEST_COMPLETE" { state = .ruleSelected }
            if event == "TEST_ERROR" { state = .ruleSelected }
        case .adding:
            if event == "ADD_COMPLETE" { state = .viewing }
            if event == "CANCEL" { state = .viewing }
        }
        updateUI()
    }

    // MARK: - Init

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Configuration panel for safety guardrail rules")
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

        ruleScroll.hasVerticalScroller = true
        ruleScroll.drawsBackground = false
        ruleContainer.orientation = .vertical
        ruleContainer.spacing = 4
        ruleScroll.documentView = ruleContainer
        rootStack.addArrangedSubview(ruleScroll)

        addBtn.bezelStyle = .roundRect
        addBtn.target = self
        addBtn.action = #selector(handleAdd(_:))
        addBtn.setAccessibilityLabel("Add guardrail rule")
        rootStack.addArrangedSubview(addBtn)

        detailPanel.orientation = .vertical
        detailPanel.spacing = 4
        detailPanel.isHidden = true
        detailNameLabel.font = .boldSystemFont(ofSize: 13)
        detailDescLabel.font = .systemFont(ofSize: 12)
        detailDescLabel.textColor = .secondaryLabelColor
        detailSeverityLabel.font = .systemFont(ofSize: 12)
        testBtn.bezelStyle = .roundRect; testBtn.target = self; testBtn.action = #selector(handleTest(_:))
        testBtn.setAccessibilityLabel("Test guardrail rule")
        testResultLabel.font = .systemFont(ofSize: 11)
        testResultLabel.isHidden = true
        detailPanel.addArrangedSubview(detailNameLabel)
        detailPanel.addArrangedSubview(detailDescLabel)
        detailPanel.addArrangedSubview(detailSeverityLabel)
        detailPanel.addArrangedSubview(testBtn)
        detailPanel.addArrangedSubview(testResultLabel)
        rootStack.addArrangedSubview(detailPanel)

        updateUI()
    }

    // MARK: - Configure

    func configure(rules: [Rule]) {
        self.rules = rules
        rebuildRules()
        updateUI()
    }

    private func rebuildRules() {
        ruleContainer.arrangedSubviews.forEach { $0.removeFromSuperview() }

        for (i, rule) in rules.enumerated() {
            let row = NSStackView()
            row.orientation = .horizontal
            row.spacing = 8

            let toggle = NSButton(checkboxWithTitle: "", target: self, action: #selector(handleToggle(_:)))
            toggle.state = rule.enabled ? .on : .off
            toggle.tag = i
            toggle.setAccessibilityLabel("\(rule.name) enabled")
            row.addArrangedSubview(toggle)

            let nameBtn = NSButton(title: rule.name, target: self, action: #selector(handleRuleClick(_:)))
            nameBtn.bezelStyle = .roundRect
            nameBtn.tag = i
            nameBtn.setAccessibilityLabel("\(rule.name) (\(rule.severity))")
            row.addArrangedSubview(nameBtn)

            let severityLabel = NSTextField(labelWithString: rule.severity)
            severityLabel.font = .boldSystemFont(ofSize: 11)
            switch rule.severity {
            case "critical": severityLabel.textColor = .systemRed
            case "high": severityLabel.textColor = .systemOrange
            case "medium": severityLabel.textColor = .systemYellow
            default: severityLabel.textColor = .secondaryLabelColor
            }
            row.addArrangedSubview(severityLabel)

            ruleContainer.addArrangedSubview(row)
        }
    }

    private func updateUI() {
        if (state == .ruleSelected || state == .testing), let id = selectedRuleId, let rule = rules.first(where: { $0.id == id }) {
            detailPanel.isHidden = false
            detailNameLabel.stringValue = rule.name
            detailDescLabel.stringValue = rule.description
            detailSeverityLabel.stringValue = "Severity: \(rule.severity)"
            testBtn.isEnabled = state != .testing
        } else {
            detailPanel.isHidden = true
        }

        setAccessibilityValue("\(rules.count) rules, \(state.rawValue)")
    }

    // MARK: - Actions

    @objc private func handleToggle(_ sender: NSButton) {
        let idx = sender.tag
        guard idx < rules.count else { return }
        rules[idx].enabled = sender.state == .on
        onRuleToggle?(rules[idx].id, rules[idx].enabled)
    }

    @objc private func handleRuleClick(_ sender: NSButton) {
        let idx = sender.tag
        guard idx < rules.count else { return }
        reduce("SELECT_RULE", ruleId: rules[idx].id)
    }

    @objc private func handleAdd(_ sender: NSButton) { reduce("ADD") }
    @objc private func handleTest(_ sender: NSButton) { reduce("TEST") }

    // MARK: - Keyboard

    override var acceptsFirstResponder: Bool { true }

    override func keyDown(with event: NSEvent) {
        switch event.keyCode {
        case 125: focusIndex = min(focusIndex + 1, rules.count - 1); if focusIndex < rules.count { reduce("SELECT_RULE", ruleId: rules[focusIndex].id) }
        case 126: focusIndex = max(focusIndex - 1, 0); if focusIndex < rules.count { reduce("SELECT_RULE", ruleId: rules[focusIndex].id) }
        case 53: reduce("DESELECT")
        default: super.keyDown(with: event)
        }
    }

    deinit {}
}
