import AppKit

// MARK: - Formula language types

enum FormulaLanguage: String, CaseIterable {
    case smtlib, tlaplus, alloy, lean, dafny, cvl

    var displayLabel: String {
        switch self {
        case .smtlib: return "SMT-LIB"
        case .tlaplus: return "TLA+"
        case .alloy: return "Alloy"
        case .lean: return "Lean"
        case .dafny: return "Dafny"
        case .cvl: return "CVL"
        }
    }
}

// MARK: - FormulaDisplayView

class FormulaDisplayView: NSView {

    enum State: String { case idle, copied, rendering }

    private var widgetState: State = .idle
    private var formula: String = ""
    private var language: FormulaLanguage = .smtlib
    private var scope: String?
    private var formulaName: String?
    private var formulaDescription: String?
    private var expanded: Bool = false
    private var descriptionOpen: Bool = false
    private var copyTimer: Timer?
    private var trackingArea: NSTrackingArea?

    var onCopy: (() -> Void)?

    private let rootStack = NSStackView()
    private let headerStack = NSStackView()
    private let langBadge = NSTextField(labelWithString: "")
    private let scopeBadge = NSTextField(labelWithString: "")
    private let copyButton = NSButton(title: "Copy", target: nil, action: nil)
    private let nameLabel = NSTextField(labelWithString: "")
    private let codeScrollView = NSScrollView()
    private let codeTextView = NSTextView()
    private let expandToggle = NSButton(title: "Show more", target: nil, action: nil)
    private let descToggle = NSButton(title: "Show description", target: nil, action: nil)
    private let descLabel = NSTextField(wrappingLabelWithString: "")

    private let collapseThreshold = 200

    // MARK: - State machine

    func reduce(_ event: String) {
        switch widgetState {
        case .idle:
            if event == "COPY" { widgetState = .copied; handleCopy() }
            if event == "RENDER_LATEX" { widgetState = .rendering }
        case .copied:
            if event == "TIMEOUT" { widgetState = .idle }
        case .rendering:
            if event == "RENDER_COMPLETE" { widgetState = .idle }
        }
        updateUI()
    }

    // MARK: - Init

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Read-only renderer for formal logic expressions")
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

        // Header: lang badge, scope badge, copy button
        headerStack.orientation = .horizontal
        headerStack.spacing = 8
        headerStack.alignment = .centerY

        langBadge.font = .monospacedSystemFont(ofSize: 11, weight: .regular)
        langBadge.isBordered = false
        langBadge.isEditable = false
        langBadge.drawsBackground = false
        langBadge.wantsLayer = true
        langBadge.layer?.borderWidth = 1
        langBadge.layer?.borderColor = NSColor.secondaryLabelColor.cgColor
        langBadge.layer?.cornerRadius = 4
        headerStack.addArrangedSubview(langBadge)

        scopeBadge.font = .systemFont(ofSize: 11)
        scopeBadge.textColor = .secondaryLabelColor
        scopeBadge.isBordered = false
        scopeBadge.isEditable = false
        scopeBadge.drawsBackground = false
        scopeBadge.isHidden = true
        headerStack.addArrangedSubview(scopeBadge)

        // Spacer
        let spacer = NSView()
        spacer.setContentHuggingPriority(.defaultLow, for: .horizontal)
        headerStack.addArrangedSubview(spacer)

        copyButton.bezelStyle = .roundRect
        copyButton.target = self
        copyButton.action = #selector(copyClicked)
        copyButton.setAccessibilityLabel("Copy formula to clipboard")
        headerStack.addArrangedSubview(copyButton)

        rootStack.addArrangedSubview(headerStack)

        // Name label
        nameLabel.font = .systemFont(ofSize: 14, weight: .semibold)
        nameLabel.isHidden = true
        rootStack.addArrangedSubview(nameLabel)

        // Code block
        codeTextView.isEditable = false
        codeTextView.isSelectable = true
        codeTextView.font = .monospacedSystemFont(ofSize: 13, weight: .regular)
        codeTextView.backgroundColor = NSColor(white: 0.95, alpha: 1)
        codeTextView.textContainerInset = NSSize(width: 8, height: 8)
        codeTextView.isVerticallyResizable = true
        codeTextView.isHorizontallyResizable = false
        codeTextView.textContainer?.widthTracksTextView = true
        codeTextView.setAccessibilityRole(.staticText)
        codeTextView.setAccessibilityLabel("Formula text")

        codeScrollView.documentView = codeTextView
        codeScrollView.hasVerticalScroller = true
        codeScrollView.autohidesScrollers = true
        codeScrollView.translatesAutoresizingMaskIntoConstraints = false
        rootStack.addArrangedSubview(codeScrollView)
        NSLayoutConstraint.activate([
            codeScrollView.heightAnchor.constraint(greaterThanOrEqualToConstant: 40),
        ])

        // Expand toggle
        expandToggle.bezelStyle = .inline
        expandToggle.isBordered = false
        expandToggle.target = self
        expandToggle.action = #selector(toggleExpand)
        expandToggle.isHidden = true
        rootStack.addArrangedSubview(expandToggle)

        // Description toggle + label
        descToggle.bezelStyle = .inline
        descToggle.isBordered = false
        descToggle.target = self
        descToggle.action = #selector(toggleDescription)
        descToggle.isHidden = true
        rootStack.addArrangedSubview(descToggle)

        descLabel.font = .systemFont(ofSize: 13)
        descLabel.textColor = .secondaryLabelColor
        descLabel.isHidden = true
        rootStack.addArrangedSubview(descLabel)

        setupTrackingArea()
    }

    // MARK: - Configure

    func configure(formula: String, language: FormulaLanguage, scope: String? = nil, name: String? = nil, description: String? = nil) {
        self.formula = formula
        self.language = language
        self.scope = scope
        self.formulaName = name
        self.formulaDescription = description
        self.expanded = false
        self.descriptionOpen = false

        langBadge.stringValue = " \(language.displayLabel) "

        if let s = scope {
            scopeBadge.stringValue = s
            scopeBadge.isHidden = false
        } else {
            scopeBadge.isHidden = true
        }

        if let n = name {
            nameLabel.stringValue = n
            nameLabel.isHidden = false
        } else {
            nameLabel.isHidden = true
        }

        descToggle.isHidden = (description == nil)
        expandToggle.isHidden = formula.count <= collapseThreshold

        updateUI()
    }

    private func updateUI() {
        let displayFormula: String
        if formula.count > collapseThreshold && !expanded {
            displayFormula = String(formula.prefix(collapseThreshold)) + "\u{2026}"
        } else {
            displayFormula = formula
        }

        codeTextView.string = displayFormula
        copyButton.title = widgetState == .copied ? "Copied!" : "Copy"

        expandToggle.title = expanded ? "Show less" : "Show more"

        if descriptionOpen, let desc = formulaDescription {
            descLabel.stringValue = desc
            descLabel.isHidden = false
            descToggle.title = "Hide description"
        } else {
            descLabel.isHidden = true
            descToggle.title = "Show description"
        }
    }

    // MARK: - Actions

    private func handleCopy() {
        let pb = NSPasteboard.general
        pb.clearContents()
        pb.setString(formula, forType: .string)
        onCopy?()

        copyTimer?.invalidate()
        copyTimer = Timer.scheduledTimer(withTimeInterval: 2.0, repeats: false) { [weak self] _ in
            self?.reduce("TIMEOUT")
        }
    }

    @objc private func copyClicked() { reduce("COPY") }
    @objc private func toggleExpand() { expanded.toggle(); updateUI() }
    @objc private func toggleDescription() { descriptionOpen.toggle(); updateUI() }

    // MARK: - Keyboard

    override var acceptsFirstResponder: Bool { true }

    override func keyDown(with event: NSEvent) {
        if event.modifierFlags.contains(.control) && event.charactersIgnoringModifiers == "c" {
            reduce("COPY")
        } else if event.keyCode == 36 && formula.count > collapseThreshold {
            expanded.toggle()
            updateUI()
        } else {
            super.keyDown(with: event)
        }
    }

    // MARK: - Tracking

    private func setupTrackingArea() {
        let area = NSTrackingArea(rect: bounds, options: [.mouseEnteredAndExited, .activeInKeyWindow, .inVisibleRect], owner: self, userInfo: nil)
        addTrackingArea(area)
        trackingArea = area
    }

    override func updateTrackingAreas() {
        super.updateTrackingAreas()
        if let ta = trackingArea { removeTrackingArea(ta) }
        setupTrackingArea()
    }

    // MARK: - Cleanup

    deinit {
        copyTimer?.invalidate()
        if let ta = trackingArea { removeTrackingArea(ta) }
    }
}
