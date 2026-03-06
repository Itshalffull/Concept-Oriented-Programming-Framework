import AppKit

class ArtifactPanelView: NSView {

    enum State: String { case open; case copied; case fullscreen; case closed }

    private(set) var state: State = .open
    private var titleText: String = ""
    private var artifactType: String = ""
    private var content: String = ""
    private var version: Int = 1
    private var copyTimer: Timer?
    private var trackingArea: NSTrackingArea?

    var onCopy: (() -> Void)?
    var onDownload: (() -> Void)?
    var onClose: (() -> Void)?
    var onFullscreen: ((Bool) -> Void)?

    private let rootStack = NSStackView()
    private let headerRow = NSStackView()
    private let titleLabel = NSTextField(labelWithString: "")
    private let typeBadge = NSTextField(labelWithString: "")
    private let toolbar = NSStackView()
    private let copyBtn = NSButton(title: "Copy", target: nil, action: nil)
    private let downloadBtn = NSButton(title: "Download", target: nil, action: nil)
    private let fullscreenBtn = NSButton(title: "Fullscreen", target: nil, action: nil)
    private let closeBtn = NSButton(title: "Close", target: nil, action: nil)
    private let contentScroll = NSScrollView()
    private let contentTextView = NSTextView()
    private let versionLabel = NSTextField(labelWithString: "")

    // MARK: - State machine

    func reduce(_ event: String) {
        switch state {
        case .open:
            if event == "COPY" { state = .copied; performCopy() }
            if event == "FULLSCREEN" { state = .fullscreen; onFullscreen?(true) }
            if event == "CLOSE" { state = .closed; onClose?() }
        case .copied:
            if event == "COPY_TIMEOUT" { state = .open }
            if event == "CLOSE" { state = .closed; onClose?() }
        case .fullscreen:
            if event == "EXIT_FULLSCREEN" { state = .open; onFullscreen?(false) }
            if event == "COPY" { performCopy() }
            if event == "CLOSE" { state = .closed; onClose?() }
        case .closed:
            if event == "OPEN" { state = .open }
        }
        updateUI()
    }

    // MARK: - Init

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Side panel for displaying and interacting with generated artifacts")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    // MARK: - Setup

    private func setupSubviews() {
        wantsLayer = true
        layer?.borderWidth = 1
        layer?.borderColor = NSColor.separatorColor.cgColor

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

        // Header
        headerRow.orientation = .horizontal
        headerRow.spacing = 8
        titleLabel.font = .boldSystemFont(ofSize: 14)
        typeBadge.font = .systemFont(ofSize: 11)
        typeBadge.textColor = .secondaryLabelColor
        headerRow.addArrangedSubview(titleLabel)
        headerRow.addArrangedSubview(typeBadge)
        rootStack.addArrangedSubview(headerRow)

        // Toolbar
        toolbar.orientation = .horizontal
        toolbar.spacing = 6
        copyBtn.bezelStyle = .roundRect; copyBtn.target = self; copyBtn.action = #selector(handleCopy(_:)); copyBtn.setAccessibilityLabel("Copy artifact")
        downloadBtn.bezelStyle = .roundRect; downloadBtn.target = self; downloadBtn.action = #selector(handleDownload(_:)); downloadBtn.setAccessibilityLabel("Download artifact")
        fullscreenBtn.bezelStyle = .roundRect; fullscreenBtn.target = self; fullscreenBtn.action = #selector(handleFullscreen(_:)); fullscreenBtn.setAccessibilityLabel("Toggle fullscreen")
        closeBtn.bezelStyle = .roundRect; closeBtn.target = self; closeBtn.action = #selector(handleClose(_:)); closeBtn.setAccessibilityLabel("Close panel")
        toolbar.addArrangedSubview(copyBtn)
        toolbar.addArrangedSubview(downloadBtn)
        toolbar.addArrangedSubview(fullscreenBtn)
        toolbar.addArrangedSubview(closeBtn)
        rootStack.addArrangedSubview(toolbar)

        // Content area
        contentScroll.hasVerticalScroller = true
        contentScroll.drawsBackground = false
        contentTextView.isEditable = false
        contentTextView.isSelectable = true
        contentTextView.font = .monospacedSystemFont(ofSize: 12, weight: .regular)
        contentScroll.documentView = contentTextView
        rootStack.addArrangedSubview(contentScroll)

        // Version bar
        versionLabel.font = .systemFont(ofSize: 11)
        versionLabel.textColor = .tertiaryLabelColor
        rootStack.addArrangedSubview(versionLabel)

        updateUI()
    }

    // MARK: - Configure

    func configure(title: String, type: String, content: String, version: Int = 1) {
        self.titleText = title
        self.artifactType = type
        self.content = content
        self.version = version
        titleLabel.stringValue = title
        typeBadge.stringValue = type
        contentTextView.string = content
        versionLabel.stringValue = "v\(version)"
        updateUI()
    }

    private func performCopy() {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(content, forType: .string)
        onCopy?()
        copyBtn.title = "Copied!"
        copyTimer?.invalidate()
        copyTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: false) { [weak self] _ in
            self?.reduce("COPY_TIMEOUT")
        }
    }

    private func updateUI() {
        let isClosed = state == .closed
        rootStack.isHidden = isClosed

        copyBtn.title = state == .copied ? "Copied!" : "Copy"
        fullscreenBtn.title = state == .fullscreen ? "Exit Fullscreen" : "Fullscreen"

        setAccessibilityValue("\(titleText), \(artifactType), \(state.rawValue)")
    }

    // MARK: - Actions

    @objc private func handleCopy(_ sender: NSButton) { reduce("COPY") }
    @objc private func handleDownload(_ sender: NSButton) { onDownload?() }
    @objc private func handleFullscreen(_ sender: NSButton) {
        if state == .fullscreen { reduce("EXIT_FULLSCREEN") } else { reduce("FULLSCREEN") }
    }
    @objc private func handleClose(_ sender: NSButton) { reduce("CLOSE") }

    // MARK: - Keyboard

    override var acceptsFirstResponder: Bool { true }

    override func keyDown(with event: NSEvent) {
        if event.modifierFlags.contains(.command) && event.keyCode == 8 { reduce("COPY") } // Cmd+C
        else if event.keyCode == 53 { reduce("CLOSE") } // Escape
        else { super.keyDown(with: event) }
    }

    deinit { copyTimer?.invalidate() }
}
