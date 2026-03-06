import AppKit

class HitlInterruptView: NSView {

    enum State: String { case pending; case editing; case approving; case rejecting; case forking; case resolved }

    private(set) var state: State = .pending
    private var reason: String = ""
    private var context: String = ""
    private var editedContent: String = ""
    private var trackingArea: NSTrackingArea?

    var onApprove: (() -> Void)?
    var onReject: ((String) -> Void)?
    var onModify: ((String) -> Void)?
    var onFork: ((String) -> Void)?

    private let rootStack = NSStackView()
    private let headerLabel = NSTextField(labelWithString: "Human Review Required")
    private let reasonLabel = NSTextField(wrappingLabelWithString: "")
    private let contextLabel = NSTextField(wrappingLabelWithString: "")
    private let editorScroll = NSScrollView()
    private let editorTextView = NSTextView()
    private let actionBar = NSStackView()
    private let approveBtn = NSButton(title: "Approve", target: nil, action: nil)
    private let rejectBtn = NSButton(title: "Reject", target: nil, action: nil)
    private let modifyBtn = NSButton(title: "Modify", target: nil, action: nil)
    private let forkBtn = NSButton(title: "Fork", target: nil, action: nil)
    private let confirmBtn = NSButton(title: "Confirm", target: nil, action: nil)
    private let cancelBtn = NSButton(title: "Cancel", target: nil, action: nil)

    // MARK: - State machine

    func reduce(_ event: String) {
        switch state {
        case .pending:
            if event == "EDIT" { state = .editing }
            if event == "APPROVE" { state = .approving }
            if event == "REJECT" { state = .rejecting }
            if event == "FORK" { state = .forking }
        case .editing:
            if event == "CONFIRM" { state = .resolved; onModify?(editorTextView.string) }
            if event == "CANCEL" { state = .pending }
        case .approving:
            if event == "CONFIRM" { state = .resolved; onApprove?() }
            if event == "CANCEL" { state = .pending }
        case .rejecting:
            if event == "CONFIRM" { state = .resolved; onReject?(editorTextView.string) }
            if event == "CANCEL" { state = .pending }
        case .forking:
            if event == "CONFIRM" { state = .resolved; onFork?(editorTextView.string) }
            if event == "CANCEL" { state = .pending }
        case .resolved:
            break
        }
        updateUI()
    }

    // MARK: - Init

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Human-in-the-loop interrupt banner for agent review")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    // MARK: - Setup

    private func setupSubviews() {
        wantsLayer = true
        layer?.backgroundColor = NSColor.systemYellow.withAlphaComponent(0.1).cgColor
        layer?.cornerRadius = 8
        layer?.borderWidth = 2
        layer?.borderColor = NSColor.systemYellow.cgColor

        rootStack.orientation = .vertical
        rootStack.spacing = 8
        rootStack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(rootStack)
        NSLayoutConstraint.activate([
            rootStack.topAnchor.constraint(equalTo: topAnchor, constant: 12),
            rootStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 12),
            rootStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -12),
            rootStack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -12),
        ])

        headerLabel.font = .boldSystemFont(ofSize: 15)
        headerLabel.textColor = .systemOrange
        rootStack.addArrangedSubview(headerLabel)

        reasonLabel.font = .systemFont(ofSize: 13)
        rootStack.addArrangedSubview(reasonLabel)

        contextLabel.font = .systemFont(ofSize: 12)
        contextLabel.textColor = .secondaryLabelColor
        rootStack.addArrangedSubview(contextLabel)

        // Editor
        editorScroll.hasVerticalScroller = true
        editorTextView.isEditable = true
        editorTextView.isRichText = false
        editorTextView.font = .systemFont(ofSize: 13)
        editorScroll.documentView = editorTextView
        editorScroll.heightAnchor.constraint(greaterThanOrEqualToConstant: 60).isActive = true
        editorScroll.isHidden = true
        rootStack.addArrangedSubview(editorScroll)

        // Primary action bar
        actionBar.orientation = .horizontal
        actionBar.spacing = 8
        approveBtn.bezelStyle = .roundRect; approveBtn.target = self; approveBtn.action = #selector(handleApprove(_:))
        approveBtn.setAccessibilityLabel("Approve agent action")
        rejectBtn.bezelStyle = .roundRect; rejectBtn.target = self; rejectBtn.action = #selector(handleReject(_:))
        rejectBtn.setAccessibilityLabel("Reject agent action")
        modifyBtn.bezelStyle = .roundRect; modifyBtn.target = self; modifyBtn.action = #selector(handleModify(_:))
        modifyBtn.setAccessibilityLabel("Modify agent action")
        forkBtn.bezelStyle = .roundRect; forkBtn.target = self; forkBtn.action = #selector(handleFork(_:))
        forkBtn.setAccessibilityLabel("Fork agent action")
        actionBar.addArrangedSubview(approveBtn)
        actionBar.addArrangedSubview(rejectBtn)
        actionBar.addArrangedSubview(modifyBtn)
        actionBar.addArrangedSubview(forkBtn)
        rootStack.addArrangedSubview(actionBar)

        // Confirm/Cancel bar
        let confirmBar = NSStackView()
        confirmBar.orientation = .horizontal
        confirmBar.spacing = 8
        confirmBtn.bezelStyle = .roundRect; confirmBtn.target = self; confirmBtn.action = #selector(handleConfirm(_:))
        confirmBtn.setAccessibilityLabel("Confirm action")
        cancelBtn.bezelStyle = .roundRect; cancelBtn.target = self; cancelBtn.action = #selector(handleCancel(_:))
        cancelBtn.setAccessibilityLabel("Cancel and go back")
        confirmBar.addArrangedSubview(confirmBtn)
        confirmBar.addArrangedSubview(cancelBtn)
        confirmBtn.isHidden = true
        cancelBtn.isHidden = true
        rootStack.addArrangedSubview(confirmBar)

        updateUI()
    }

    // MARK: - Configure

    func configure(reason: String, context: String = "", editContent: String = "") {
        self.reason = reason
        self.context = context
        self.editedContent = editContent
        reasonLabel.stringValue = reason
        contextLabel.stringValue = context
        editorTextView.string = editContent
        updateUI()
    }

    private func updateUI() {
        let isPending = state == .pending
        let isEditing = state == .editing || state == .rejecting || state == .forking
        let isConfirming = state == .approving || state == .editing || state == .rejecting || state == .forking
        let isResolved = state == .resolved

        actionBar.isHidden = !isPending
        editorScroll.isHidden = !isEditing
        confirmBtn.isHidden = !isConfirming
        cancelBtn.isHidden = !isConfirming

        if isResolved {
            headerLabel.stringValue = "Resolved"
            headerLabel.textColor = .systemGreen
            layer?.borderColor = NSColor.systemGreen.cgColor
        }

        setAccessibilityValue("HITL interrupt: \(state.rawValue)")
    }

    // MARK: - Actions

    @objc private func handleApprove(_ sender: NSButton) { reduce("APPROVE") }
    @objc private func handleReject(_ sender: NSButton) { reduce("REJECT") }
    @objc private func handleModify(_ sender: NSButton) { reduce("EDIT") }
    @objc private func handleFork(_ sender: NSButton) { reduce("FORK") }
    @objc private func handleConfirm(_ sender: NSButton) { reduce("CONFIRM") }
    @objc private func handleCancel(_ sender: NSButton) { reduce("CANCEL") }

    // MARK: - Keyboard

    override var acceptsFirstResponder: Bool { true }

    override func keyDown(with event: NSEvent) {
        switch event.keyCode {
        case 53: reduce("CANCEL") // Escape
        default: super.keyDown(with: event)
        }
    }

    deinit {}
}
