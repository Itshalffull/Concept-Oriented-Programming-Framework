import AppKit

class MessageBranchNavView: NSView {

    enum State: String { case viewing; case editing }

    private(set) var state: State = .viewing
    private var currentBranch: Int = 1
    private var totalBranches: Int = 1
    private var trackingArea: NSTrackingArea?

    var onPrev: (() -> Void)?
    var onNext: (() -> Void)?
    var onEdit: (() -> Void)?

    private let rootStack = NSStackView()
    private let prevBtn = NSButton(title: "\u{25C4}", target: nil, action: nil)
    private let indicatorLabel = NSTextField(labelWithString: "1/1")
    private let nextBtn = NSButton(title: "\u{25BA}", target: nil, action: nil)
    private let editBtn = NSButton(title: "Edit", target: nil, action: nil)

    // MARK: - State machine

    func reduce(_ event: String) {
        switch state {
        case .viewing:
            if event == "PREV" { navigatePrev() }
            if event == "NEXT" { navigateNext() }
            if event == "EDIT" { state = .editing; onEdit?() }
        case .editing:
            if event == "DONE" { state = .viewing }
        }
        updateUI()
    }

    // MARK: - Init

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Navigation control for conversation branches")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    // MARK: - Setup

    private func setupSubviews() {
        wantsLayer = true

        rootStack.orientation = .horizontal
        rootStack.spacing = 4
        rootStack.alignment = .centerY
        rootStack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(rootStack)
        NSLayoutConstraint.activate([
            rootStack.topAnchor.constraint(equalTo: topAnchor, constant: 4),
            rootStack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 4),
            rootStack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -4),
            rootStack.bottomAnchor.constraint(equalTo: bottomAnchor, constant: -4),
        ])

        prevBtn.bezelStyle = .roundRect
        prevBtn.target = self
        prevBtn.action = #selector(handlePrev(_:))
        prevBtn.setAccessibilityLabel("Previous branch")

        indicatorLabel.font = .monospacedDigitSystemFont(ofSize: 12, weight: .regular)
        indicatorLabel.alignment = .center
        indicatorLabel.setAccessibilityRole(.staticText)

        nextBtn.bezelStyle = .roundRect
        nextBtn.target = self
        nextBtn.action = #selector(handleNext(_:))
        nextBtn.setAccessibilityLabel("Next branch")

        editBtn.bezelStyle = .roundRect
        editBtn.target = self
        editBtn.action = #selector(handleEdit(_:))
        editBtn.setAccessibilityLabel("Edit message")

        rootStack.addArrangedSubview(prevBtn)
        rootStack.addArrangedSubview(indicatorLabel)
        rootStack.addArrangedSubview(nextBtn)
        rootStack.addArrangedSubview(editBtn)

        updateUI()
    }

    // MARK: - Configure

    func configure(currentBranch: Int, totalBranches: Int) {
        self.currentBranch = currentBranch
        self.totalBranches = totalBranches
        updateUI()
    }

    private func navigatePrev() {
        guard currentBranch > 1 else { return }
        currentBranch -= 1
        onPrev?()
    }

    private func navigateNext() {
        guard currentBranch < totalBranches else { return }
        currentBranch += 1
        onNext?()
    }

    private func updateUI() {
        indicatorLabel.stringValue = "\(currentBranch)/\(totalBranches)"
        prevBtn.isEnabled = currentBranch > 1
        nextBtn.isEnabled = currentBranch < totalBranches
        editBtn.title = state == .editing ? "Done" : "Edit"

        setAccessibilityValue("Branch \(currentBranch) of \(totalBranches)")
    }

    // MARK: - Actions

    @objc private func handlePrev(_ sender: NSButton) { reduce("PREV") }
    @objc private func handleNext(_ sender: NSButton) { reduce("NEXT") }
    @objc private func handleEdit(_ sender: NSButton) {
        if state == .editing { reduce("DONE") } else { reduce("EDIT") }
    }

    // MARK: - Keyboard

    override var acceptsFirstResponder: Bool { true }

    override func keyDown(with event: NSEvent) {
        switch event.keyCode {
        case 123: reduce("PREV")  // Left
        case 124: reduce("NEXT")  // Right
        default: super.keyDown(with: event)
        }
    }

    deinit {}
}
