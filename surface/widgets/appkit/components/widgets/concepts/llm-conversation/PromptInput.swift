import AppKit

class PromptInputView: NSView {

    enum State: String { case empty; case composing; case submitting }

    private(set) var state: State = .empty
    private var model: String = ""
    private var charCount: Int = 0
    private var trackingArea: NSTrackingArea?

    var onSubmit: ((String) -> Void)?
    var onAttach: (() -> Void)?
    var onModelChange: ((String) -> Void)?

    private let rootStack = NSStackView()
    private let textScroll = NSScrollView()
    private let textView = NSTextView()
    private let toolbarStack = NSStackView()
    private let attachBtn = NSButton(title: "\u{1F4CE}", target: nil, action: nil)
    private let modelPopup = NSPopUpButton()
    private let counterLabel = NSTextField(labelWithString: "0")
    private let submitBtn = NSButton(title: "Send", target: nil, action: nil)

    // MARK: - State machine

    func reduce(_ event: String) {
        switch state {
        case .empty:
            if event == "INPUT" { state = .composing }
        case .composing:
            if event == "CLEAR" { state = .empty }
            if event == "SUBMIT" { state = .submitting; performSubmit() }
        case .submitting:
            if event == "SUBMIT_COMPLETE" { state = .empty; textView.string = "" }
            if event == "SUBMIT_ERROR" { state = .composing }
        }
        updateUI()
    }

    // MARK: - Init

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Auto-expanding textarea for composing LLM prompts")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    // MARK: - Setup

    private func setupSubviews() {
        wantsLayer = true
        layer?.cornerRadius = 8
        layer?.borderWidth = 1
        layer?.borderColor = NSColor.separatorColor.cgColor

        rootStack.orientation = .vertical
        rootStack.spacing = 4
        rootStack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(rootStack)
        NSLayoutConstraint.activate([
            rootStack.topAnchor.constraint(equalTo: topAnchor, constant: 8),
            rootStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 8),
            rootStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -8),
            rootStack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -8),
        ])

        // Text area
        textScroll.hasVerticalScroller = true
        textScroll.drawsBackground = false
        textView.isEditable = true
        textView.isRichText = false
        textView.font = .systemFont(ofSize: 14)
        textView.delegate = self
        textView.setAccessibilityLabel("Prompt input")
        textScroll.documentView = textView
        textScroll.heightAnchor.constraint(greaterThanOrEqualToConstant: 40).isActive = true
        rootStack.addArrangedSubview(textScroll)

        // Toolbar
        toolbarStack.orientation = .horizontal
        toolbarStack.spacing = 8

        attachBtn.bezelStyle = .roundRect
        attachBtn.target = self
        attachBtn.action = #selector(handleAttach(_:))
        attachBtn.setAccessibilityLabel("Attach file")

        modelPopup.addItems(withTitles: ["Default Model"])
        modelPopup.target = self
        modelPopup.action = #selector(handleModelChange(_:))

        counterLabel.font = .monospacedDigitSystemFont(ofSize: 11, weight: .regular)
        counterLabel.textColor = .tertiaryLabelColor

        submitBtn.bezelStyle = .roundRect
        submitBtn.target = self
        submitBtn.action = #selector(handleSubmit(_:))
        submitBtn.setAccessibilityLabel("Send prompt")

        toolbarStack.addArrangedSubview(attachBtn)
        toolbarStack.addArrangedSubview(modelPopup)
        toolbarStack.addArrangedSubview(counterLabel)
        toolbarStack.addArrangedSubview(submitBtn)
        rootStack.addArrangedSubview(toolbarStack)

        updateUI()
    }

    // MARK: - Configure

    func configure(models: [String], selectedModel: String = "") {
        modelPopup.removeAllItems()
        modelPopup.addItems(withTitles: models)
        if !selectedModel.isEmpty { modelPopup.selectItem(withTitle: selectedModel) }
        self.model = selectedModel
        updateUI()
    }

    private func performSubmit() {
        let text = textView.string.trimmingCharacters(in: .whitespacesAndNewlines)
        onSubmit?(text)
    }

    private func updateUI() {
        charCount = textView.string.count
        counterLabel.stringValue = "\(charCount)"
        submitBtn.isEnabled = state == .composing
        submitBtn.title = state == .submitting ? "Sending..." : "Send"

        setAccessibilityValue("\(charCount) characters, \(state.rawValue)")
    }

    // MARK: - Actions

    @objc private func handleAttach(_ sender: NSButton) { onAttach?() }
    @objc private func handleSubmit(_ sender: NSButton) { reduce("SUBMIT") }
    @objc private func handleModelChange(_ sender: NSPopUpButton) {
        model = sender.titleOfSelectedItem ?? ""
        onModelChange?(model)
    }

    // MARK: - Keyboard

    override var acceptsFirstResponder: Bool { true }

    deinit {}
}

extension PromptInputView: NSTextViewDelegate {
    func textDidChange(_ notification: Notification) {
        let text = textView.string.trimmingCharacters(in: .whitespacesAndNewlines)
        if text.isEmpty && state == .composing { reduce("CLEAR") }
        else if !text.isEmpty && state == .empty { reduce("INPUT") }
        updateUI()
    }

    func textView(_ textView: NSTextView, doCommandBy commandSelector: Selector) -> Bool {
        // Cmd+Enter to submit
        if commandSelector == #selector(insertNewline(_:)) {
            if NSApp.currentEvent?.modifierFlags.contains(.command) == true {
                reduce("SUBMIT")
                return true
            }
        }
        return false
    }
}
