import AppKit

class PromptTemplateEditorView: NSView {

    enum State: String { case editing; case messageSelected; case compiling }

    struct Message {
        let id: String
        var role: String
        var content: String
    }

    private(set) var state: State = .editing
    private var messages: [Message] = []
    private var selectedMessageId: String? = nil
    private var variables: [String] = []
    private var tokenCount: Int = 0
    private var focusIndex: Int = 0

    var onMessagesChange: (([Message]) -> Void)?
    var onCompile: (() -> Void)?

    private let rootStack = NSStackView()
    private let messageScroll = NSScrollView()
    private let messageContainer = NSStackView()
    private let variablesStack = NSStackView()
    private let addBtn = NSButton(title: "+ Add Message", target: nil, action: nil)
    private let tokenCountLabel = NSTextField(labelWithString: "")
    private let compileBtn = NSButton(title: "Compile", target: nil, action: nil)
    private let parameterPanel = NSStackView()

    // MARK: - State machine

    func reduce(_ event: String, messageId: String? = nil) {
        switch state {
        case .editing:
            if event == "SELECT_MESSAGE", let id = messageId { state = .messageSelected; selectedMessageId = id }
            if event == "COMPILE" { state = .compiling; onCompile?() }
        case .messageSelected:
            if event == "DESELECT" { state = .editing; selectedMessageId = nil }
            if event == "SELECT_MESSAGE", let id = messageId { selectedMessageId = id }
            if event == "DELETE" { deleteSelectedMessage(); state = .editing; selectedMessageId = nil }
        case .compiling:
            if event == "COMPILE_COMPLETE" { state = .editing }
            if event == "COMPILE_ERROR" { state = .editing }
        }
        updateUI()
    }

    // MARK: - Init

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Multi-message prompt template editor with variable detection")
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

        messageScroll.hasVerticalScroller = true
        messageScroll.drawsBackground = false
        messageContainer.orientation = .vertical
        messageContainer.spacing = 6
        messageScroll.documentView = messageContainer
        rootStack.addArrangedSubview(messageScroll)

        addBtn.bezelStyle = .roundRect
        addBtn.target = self
        addBtn.action = #selector(handleAdd(_:))
        addBtn.setAccessibilityLabel("Add message block")
        rootStack.addArrangedSubview(addBtn)

        variablesStack.orientation = .horizontal
        variablesStack.spacing = 4
        variablesStack.setAccessibilityLabel("Detected template variables")
        rootStack.addArrangedSubview(variablesStack)

        let bottomRow = NSStackView()
        bottomRow.orientation = .horizontal
        bottomRow.spacing = 8
        tokenCountLabel.font = .monospacedDigitSystemFont(ofSize: 11, weight: .regular)
        tokenCountLabel.textColor = .tertiaryLabelColor
        compileBtn.bezelStyle = .roundRect
        compileBtn.target = self
        compileBtn.action = #selector(handleCompile(_:))
        compileBtn.setAccessibilityLabel("Compile prompt template")
        bottomRow.addArrangedSubview(tokenCountLabel)
        bottomRow.addArrangedSubview(compileBtn)
        rootStack.addArrangedSubview(bottomRow)

        parameterPanel.orientation = .vertical
        parameterPanel.spacing = 4
        parameterPanel.isHidden = true
        rootStack.addArrangedSubview(parameterPanel)

        updateUI()
    }

    // MARK: - Configure

    func configure(messages: [Message]) {
        self.messages = messages
        rebuildMessages()
        updateUI()
    }

    private func rebuildMessages() {
        messageContainer.arrangedSubviews.forEach { $0.removeFromSuperview() }

        for (i, msg) in messages.enumerated() {
            let block = NSStackView()
            block.orientation = .vertical
            block.spacing = 4
            block.wantsLayer = true
            block.layer?.cornerRadius = 6
            block.layer?.borderWidth = selectedMessageId == msg.id ? 2 : 1
            block.layer?.borderColor = selectedMessageId == msg.id ? NSColor.controlAccentColor.cgColor : NSColor.separatorColor.cgColor

            let headerRow = NSStackView()
            headerRow.orientation = .horizontal
            headerRow.spacing = 6

            let rolePopup = NSPopUpButton()
            rolePopup.addItems(withTitles: ["system", "user", "assistant"])
            rolePopup.selectItem(withTitle: msg.role)
            rolePopup.tag = i
            rolePopup.target = self
            rolePopup.action = #selector(handleRoleChange(_:))
            headerRow.addArrangedSubview(rolePopup)

            let selectBtn = NSButton(title: "Select", target: self, action: #selector(handleSelectMessage(_:)))
            selectBtn.bezelStyle = .roundRect
            selectBtn.tag = i
            headerRow.addArrangedSubview(selectBtn)

            let deleteBtn = NSButton(title: "\u{2715}", target: self, action: #selector(handleDeleteMessage(_:)))
            deleteBtn.bezelStyle = .roundRect
            deleteBtn.tag = i
            deleteBtn.setAccessibilityLabel("Delete message \(i + 1)")
            headerRow.addArrangedSubview(deleteBtn)

            block.addArrangedSubview(headerRow)

            let contentField = NSTextField(wrappingLabelWithString: msg.content)
            contentField.font = .monospacedSystemFont(ofSize: 12, weight: .regular)
            contentField.isEditable = true
            block.addArrangedSubview(contentField)

            messageContainer.addArrangedSubview(block)
        }

        extractVariables()
    }

    private func extractVariables() {
        var allText = ""
        for msg in messages { allText += msg.content }
        let regex = try? NSRegularExpression(pattern: "\\{\\{(\\w+)\\}\\}", options: [])
        let range = NSRange(allText.startIndex..., in: allText)
        var vars = Set<String>()
        regex?.enumerateMatches(in: allText, range: range) { match, _, _ in
            if let match = match, let r = Range(match.range(at: 1), in: allText) {
                vars.insert(String(allText[r]))
            }
        }
        variables = vars.sorted()
        tokenCount = allText.count / 4

        variablesStack.arrangedSubviews.forEach { $0.removeFromSuperview() }
        for v in variables {
            let pill = NSTextField(labelWithString: "{{\(v)}}")
            pill.font = .monospacedSystemFont(ofSize: 11, weight: .medium)
            pill.textColor = .controlAccentColor
            pill.wantsLayer = true
            pill.layer?.cornerRadius = 8
            pill.layer?.backgroundColor = NSColor.controlAccentColor.withAlphaComponent(0.1).cgColor
            variablesStack.addArrangedSubview(pill)
        }
    }

    private func deleteSelectedMessage() {
        guard let id = selectedMessageId else { return }
        messages.removeAll { $0.id == id }
        onMessagesChange?(messages)
        rebuildMessages()
    }

    private func updateUI() {
        tokenCountLabel.stringValue = "~\(tokenCount) tokens"
        compileBtn.isEnabled = state != .compiling

        setAccessibilityValue("\(messages.count) messages, \(variables.count) variables, \(state.rawValue)")
    }

    // MARK: - Actions

    @objc private func handleAdd(_ sender: NSButton) {
        let newMsg = Message(id: "msg-\(messages.count + 1)", role: "user", content: "")
        messages.append(newMsg)
        onMessagesChange?(messages)
        rebuildMessages()
    }

    @objc private func handleRoleChange(_ sender: NSPopUpButton) {
        let idx = sender.tag
        guard idx < messages.count, let role = sender.titleOfSelectedItem else { return }
        messages[idx].role = role
        onMessagesChange?(messages)
    }

    @objc private func handleSelectMessage(_ sender: NSButton) {
        let idx = sender.tag
        guard idx < messages.count else { return }
        reduce("SELECT_MESSAGE", messageId: messages[idx].id)
    }

    @objc private func handleDeleteMessage(_ sender: NSButton) {
        let idx = sender.tag
        guard idx < messages.count else { return }
        messages.remove(at: idx)
        onMessagesChange?(messages)
        rebuildMessages()
    }

    @objc private func handleCompile(_ sender: NSButton) { reduce("COMPILE") }

    // MARK: - Keyboard

    override var acceptsFirstResponder: Bool { true }

    override func keyDown(with event: NSEvent) {
        switch event.keyCode {
        case 53: reduce("DESELECT")
        default: super.keyDown(with: event)
        }
    }

    deinit {}
}
