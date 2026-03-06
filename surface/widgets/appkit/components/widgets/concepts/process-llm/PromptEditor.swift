import AppKit

class PromptEditorView: NSView, NSTextViewDelegate {

    enum State: String { case editing; case testing; case viewing }

    struct PromptMessage {
        let id: String
        var role: String   // system | user | assistant
        var content: String
    }

    struct PromptTool {
        let name: String
        let description: String?
    }

    private(set) var state: State = .editing
    private var systemText: String = ""
    private var userText: String = ""
    private var messages: [PromptMessage] = []
    private var model: String = ""
    private var tools: [PromptTool] = []
    private var detectedVariables: [String] = []
    private var lastTestResult: String? = nil
    private var lastTestError: String? = nil
    private var nextMsgId: Int = 1

    var onSystemPromptChange: ((String) -> Void)?
    var onUserPromptChange: ((String) -> Void)?
    var onMessagesChange: (([PromptMessage]) -> Void)?
    var onTest: (() -> Void)?

    private let rootStack = NSStackView()

    // System block
    private let systemLabel = NSTextField(labelWithString: "System")
    private let systemScroll = NSScrollView()
    private let systemTextView = NSTextView()

    // User block
    private let userLabel = NSTextField(labelWithString: "User")
    private let userScroll = NSScrollView()
    private let userTextView = NSTextView()

    // Messages
    private let messagesContainer = NSStackView()
    private let addMessageBtn = NSButton(title: "+ Add Message", target: nil, action: nil)

    // Variables
    private let variablesStack = NSStackView()
    private let variablesHeader = NSTextField(labelWithString: "Variables")

    // Model & token count
    private let metaStack = NSStackView()
    private let modelLabel = NSTextField(labelWithString: "")
    private let tokenLabel = NSTextField(labelWithString: "")

    // Test button & panel
    private let testBtn = NSButton(title: "Test Prompt", target: nil, action: nil)
    private let testPanelScroll = NSScrollView()
    private let testPanelContainer = NSStackView()
    private let editBtn = NSButton(title: "Edit", target: nil, action: nil)
    private let testErrorLabel = NSTextField(wrappingLabelWithString: "")

    // Tool list
    private let toolsHeader = NSTextField(labelWithString: "Tools")
    private let toolsContainer = NSStackView()

    func reduce(_ event: String, result: String? = nil, error: String? = nil) {
        switch state {
        case .editing:
            if event == "TEST" { state = .testing }
            if event == "INPUT" { /* stay */ }
        case .testing:
            if event == "TEST_COMPLETE" { state = .viewing; lastTestResult = result }
            if event == "TEST_ERROR" { state = .editing; lastTestError = error }
        case .viewing:
            if event == "EDIT" { state = .editing }
            if event == "TEST" { state = .testing }
        }
        updateUI()
    }

    override init(frame: NSRect) {
        super.init(frame: frame); setupSubviews()
        setAccessibilityRole(.group); setAccessibilityLabel("Multi-message prompt template editor for LLM steps")
    }
    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        wantsLayer = true
        rootStack.orientation = .vertical; rootStack.spacing = 8
        rootStack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(rootStack)
        NSLayoutConstraint.activate([
            rootStack.topAnchor.constraint(equalTo: topAnchor, constant: 8),
            rootStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
            rootStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
            rootStack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -8),
        ])

        // System block
        systemLabel.font = .boldSystemFont(ofSize: 12); systemLabel.textColor = .systemPurple
        rootStack.addArrangedSubview(systemLabel)
        configureTextView(systemTextView, scrollView: systemScroll, placeholder: "System instructions...", height: 60)
        systemTextView.delegate = self
        rootStack.addArrangedSubview(systemScroll)

        // User block
        userLabel.font = .boldSystemFont(ofSize: 12); userLabel.textColor = .systemBlue
        rootStack.addArrangedSubview(userLabel)
        configureTextView(userTextView, scrollView: userScroll, placeholder: "User prompt template...", height: 80)
        userTextView.delegate = self
        rootStack.addArrangedSubview(userScroll)

        // Additional messages
        messagesContainer.orientation = .vertical; messagesContainer.spacing = 6
        rootStack.addArrangedSubview(messagesContainer)
        addMessageBtn.bezelStyle = .roundRect; addMessageBtn.target = self; addMessageBtn.action = #selector(handleAddMessage(_:))
        rootStack.addArrangedSubview(addMessageBtn)

        // Variables
        variablesHeader.font = .boldSystemFont(ofSize: 11); variablesHeader.textColor = .secondaryLabelColor
        rootStack.addArrangedSubview(variablesHeader)
        variablesStack.orientation = .horizontal; variablesStack.spacing = 4
        rootStack.addArrangedSubview(variablesStack)

        // Model & tokens
        metaStack.orientation = .horizontal; metaStack.spacing = 12
        modelLabel.font = .systemFont(ofSize: 11); modelLabel.textColor = .secondaryLabelColor
        tokenLabel.font = .monospacedDigitSystemFont(ofSize: 11, weight: .regular); tokenLabel.textColor = .tertiaryLabelColor
        metaStack.addArrangedSubview(modelLabel); metaStack.addArrangedSubview(tokenLabel)
        rootStack.addArrangedSubview(metaStack)

        // Test button
        testBtn.bezelStyle = .roundRect; testBtn.target = self; testBtn.action = #selector(handleTest(_:))
        rootStack.addArrangedSubview(testBtn)

        // Test panel
        testPanelScroll.hasVerticalScroller = true; testPanelScroll.drawsBackground = false
        testPanelContainer.orientation = .vertical; testPanelContainer.spacing = 4
        testPanelScroll.documentView = testPanelContainer
        testPanelScroll.isHidden = true
        rootStack.addArrangedSubview(testPanelScroll)

        editBtn.bezelStyle = .roundRect; editBtn.target = self; editBtn.action = #selector(handleEdit(_:))
        editBtn.isHidden = true
        rootStack.addArrangedSubview(editBtn)

        testErrorLabel.font = .systemFont(ofSize: 11); testErrorLabel.textColor = .systemRed; testErrorLabel.isHidden = true
        rootStack.addArrangedSubview(testErrorLabel)

        // Tools
        toolsHeader.font = .boldSystemFont(ofSize: 11); toolsHeader.textColor = .secondaryLabelColor
        rootStack.addArrangedSubview(toolsHeader)
        toolsContainer.orientation = .vertical; toolsContainer.spacing = 2
        rootStack.addArrangedSubview(toolsContainer)

        updateUI()
    }

    private func configureTextView(_ textView: NSTextView, scrollView: NSScrollView, placeholder: String, height: CGFloat) {
        scrollView.hasVerticalScroller = true; scrollView.drawsBackground = false
        scrollView.heightAnchor.constraint(greaterThanOrEqualToConstant: height).isActive = true
        textView.isEditable = true; textView.isSelectable = true
        textView.font = .monospacedSystemFont(ofSize: 12, weight: .regular)
        textView.isRichText = false; textView.isAutomaticQuoteSubstitutionEnabled = false
        textView.isVerticallyResizable = true; textView.isHorizontallyResizable = false
        textView.autoresizingMask = [.width]
        textView.textContainer?.widthTracksTextView = true
        scrollView.documentView = textView
    }

    func configure(systemPrompt: String = "", userPrompt: String, model: String, tools: [PromptTool] = [], messages: [PromptMessage] = []) {
        self.systemText = systemPrompt; self.userText = userPrompt
        self.model = model; self.tools = tools; self.messages = messages
        systemTextView.string = systemPrompt; userTextView.string = userPrompt
        rebuildMessages(); rebuildTools(); extractVariables(); updateUI()
    }

    func setTestResult(_ result: String) { reduce("TEST_COMPLETE", result: result) }
    func setTestError(_ error: String) { reduce("TEST_ERROR", error: error) }

    private func extractVariables() {
        let allText = systemText + userText + messages.map { $0.content }.joined()
        let regex = try? NSRegularExpression(pattern: "\\{\\{(\\w+)\\}\\}", options: [])
        let matches = regex?.matches(in: allText, range: NSRange(allText.startIndex..., in: allText)) ?? []
        var vars = [String]()
        for match in matches {
            if let range = Range(match.range(at: 1), in: allText) {
                let v = String(allText[range])
                if !vars.contains(v) { vars.append(v) }
            }
        }
        detectedVariables = vars
    }

    private func estimateTokens() -> Int {
        let allText = systemText + userText + messages.map { $0.content }.joined()
        return Int(ceil(Double(allText.count) / 4.0))
    }

    private func rebuildMessages() {
        messagesContainer.arrangedSubviews.forEach { $0.removeFromSuperview() }
        for (i, msg) in messages.enumerated() {
            let block = NSStackView(); block.orientation = .vertical; block.spacing = 4
            block.wantsLayer = true; block.layer?.cornerRadius = 4; block.layer?.borderWidth = 1; block.layer?.borderColor = NSColor.separatorColor.cgColor

            // Header with role selector and actions
            let header = NSStackView(); header.orientation = .horizontal; header.spacing = 6
            let rolePopup = NSPopUpButton()
            rolePopup.addItems(withTitles: ["System", "User", "Assistant"])
            switch msg.role {
            case "system": rolePopup.selectItem(at: 0)
            case "user": rolePopup.selectItem(at: 1)
            case "assistant": rolePopup.selectItem(at: 2)
            default: rolePopup.selectItem(at: 1)
            }
            rolePopup.tag = i; rolePopup.target = self; rolePopup.action = #selector(handleRoleChange(_:))
            rolePopup.setAccessibilityLabel("Message \(i + 1) role")
            header.addArrangedSubview(rolePopup)

            let moveUpBtn = NSButton(title: "\u{2191}", target: self, action: #selector(handleMoveUp(_:)))
            moveUpBtn.bezelStyle = .roundRect; moveUpBtn.tag = i; moveUpBtn.isEnabled = i > 0
            let moveDownBtn = NSButton(title: "\u{2193}", target: self, action: #selector(handleMoveDown(_:)))
            moveDownBtn.bezelStyle = .roundRect; moveDownBtn.tag = i; moveDownBtn.isEnabled = i < messages.count - 1
            let removeBtn = NSButton(title: "\u{2715}", target: self, action: #selector(handleRemoveMessage(_:)))
            removeBtn.bezelStyle = .roundRect; removeBtn.tag = i
            header.addArrangedSubview(moveUpBtn); header.addArrangedSubview(moveDownBtn); header.addArrangedSubview(removeBtn)
            block.addArrangedSubview(header)

            // Content text field
            let contentField = NSTextField()
            contentField.placeholderString = "Message content..."; contentField.stringValue = msg.content
            contentField.font = .monospacedSystemFont(ofSize: 12, weight: .regular)
            contentField.tag = i; contentField.target = self; contentField.action = #selector(handleMessageContentChange(_:))
            block.addArrangedSubview(contentField)

            messagesContainer.addArrangedSubview(block)
        }
    }

    private func rebuildVariables() {
        variablesStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
        if detectedVariables.isEmpty {
            let lbl = NSTextField(labelWithString: "No template variables detected")
            lbl.font = .systemFont(ofSize: 10); lbl.textColor = .tertiaryLabelColor
            variablesStack.addArrangedSubview(lbl)
        } else {
            for v in detectedVariables {
                let pill = NSTextField(labelWithString: "{{\(v)}}")
                pill.font = .monospacedSystemFont(ofSize: 10, weight: .medium)
                pill.wantsLayer = true; pill.layer?.cornerRadius = 4; pill.layer?.backgroundColor = NSColor.controlAccentColor.withAlphaComponent(0.1).cgColor
                pill.setAccessibilityLabel("Variable: \(v)")
                variablesStack.addArrangedSubview(pill)
            }
        }
    }

    private func rebuildTools() {
        toolsContainer.arrangedSubviews.forEach { $0.removeFromSuperview() }
        toolsHeader.stringValue = "Tools (\(tools.count))"
        toolsHeader.isHidden = tools.isEmpty; toolsContainer.isHidden = tools.isEmpty
        for tool in tools {
            let row = NSStackView(); row.orientation = .horizontal; row.spacing = 8
            let nameLabel = NSTextField(labelWithString: tool.name)
            nameLabel.font = .boldSystemFont(ofSize: 11)
            row.addArrangedSubview(nameLabel)
            if let desc = tool.description {
                let descLabel = NSTextField(labelWithString: desc)
                descLabel.font = .systemFont(ofSize: 10); descLabel.textColor = .secondaryLabelColor
                row.addArrangedSubview(descLabel)
            }
            toolsContainer.addArrangedSubview(row)
        }
    }

    private func rebuildTestPanel() {
        testPanelContainer.arrangedSubviews.forEach { $0.removeFromSuperview() }
        if state == .viewing, let result = lastTestResult {
            testPanelScroll.isHidden = false; editBtn.isHidden = false
            let header = NSTextField(labelWithString: "Test Result")
            header.font = .boldSystemFont(ofSize: 12)
            testPanelContainer.addArrangedSubview(header)
            let resultLabel = NSTextField(wrappingLabelWithString: result)
            resultLabel.font = .monospacedSystemFont(ofSize: 11, weight: .regular)
            testPanelContainer.addArrangedSubview(resultLabel)
        } else {
            testPanelScroll.isHidden = true; editBtn.isHidden = true
        }
        if let error = lastTestError {
            testErrorLabel.stringValue = error; testErrorLabel.isHidden = false
        } else {
            testErrorLabel.isHidden = true
        }
    }

    private func updateUI() {
        modelLabel.stringValue = model
        tokenLabel.stringValue = "~\(estimateTokens()) tokens"
        testBtn.title = state == .testing ? "Testing..." : "Test Prompt"
        testBtn.isEnabled = state != .testing
        extractVariables(); rebuildVariables(); rebuildTestPanel()
        setAccessibilityValue("\(state.rawValue), ~\(estimateTokens()) tokens")
    }

    // NSTextViewDelegate
    func textDidChange(_ notification: Notification) {
        guard let textView = notification.object as? NSTextView else { return }
        if textView === systemTextView {
            systemText = textView.string; onSystemPromptChange?(systemText)
        } else if textView === userTextView {
            userText = textView.string; onUserPromptChange?(userText)
        }
        reduce("INPUT")
    }

    @objc private func handleAddMessage(_ sender: NSButton) {
        let msg = PromptMessage(id: "msg-\(nextMsgId)", role: "user", content: "")
        nextMsgId += 1; messages.append(msg); onMessagesChange?(messages)
        rebuildMessages(); updateUI()
    }
    @objc private func handleRemoveMessage(_ sender: NSButton) {
        let idx = sender.tag; guard idx < messages.count else { return }
        messages.remove(at: idx); onMessagesChange?(messages)
        rebuildMessages(); updateUI()
    }
    @objc private func handleMoveUp(_ sender: NSButton) {
        let idx = sender.tag; guard idx > 0 && idx < messages.count else { return }
        messages.swapAt(idx, idx - 1); onMessagesChange?(messages)
        rebuildMessages(); updateUI()
    }
    @objc private func handleMoveDown(_ sender: NSButton) {
        let idx = sender.tag; guard idx < messages.count - 1 else { return }
        messages.swapAt(idx, idx + 1); onMessagesChange?(messages)
        rebuildMessages(); updateUI()
    }
    @objc private func handleRoleChange(_ sender: NSPopUpButton) {
        let idx = sender.tag; guard idx < messages.count else { return }
        let roles = ["system", "user", "assistant"]
        messages[idx].role = roles[sender.indexOfSelectedItem]; onMessagesChange?(messages)
    }
    @objc private func handleMessageContentChange(_ sender: NSTextField) {
        let idx = sender.tag; guard idx < messages.count else { return }
        messages[idx].content = sender.stringValue; onMessagesChange?(messages)
        reduce("INPUT")
    }
    @objc private func handleTest(_ sender: NSButton) { reduce("TEST"); onTest?() }
    @objc private func handleEdit(_ sender: NSButton) { reduce("EDIT") }

    override var acceptsFirstResponder: Bool { true }
    override func keyDown(with event: NSEvent) {
        // Ctrl+Enter to test
        if event.modifierFlags.contains(.control) && event.keyCode == 36 { handleTest(testBtn) }
        else { super.keyDown(with: event) }
    }
    deinit {}
}
