import AppKit

class ApprovalStepperView: NSView {

    enum State: String { case viewing; case stepFocused; case acting }

    struct Step {
        let id: String
        let label: String
        let approver: String?
        let status: String   // pending | approved | rejected | skipped | active
        let timestamp: String?
        let quorumRequired: Int?
        let quorumCurrent: Int?
    }

    private(set) var state: State = .viewing
    private var steps: [Step] = []
    private var currentStepId: String? = nil
    private var focusedStepId: String? = nil
    private var actingStepId: String? = nil
    private var focusIndex: Int = 0
    private var dueAt: Date? = nil
    private var slaTimer: Timer?

    var onApprove: ((String) -> Void)?
    var onReject: ((String) -> Void)?
    var onDelegate: ((String) -> Void)?
    var onClaim: ((String) -> Void)?

    private let rootStack = NSStackView()
    private let stepScroll = NSScrollView()
    private let stepContainer = NSStackView()
    private let actionBar = NSStackView()
    private let approveBtn = NSButton(title: "Approve", target: nil, action: nil)
    private let rejectBtn = NSButton(title: "Reject", target: nil, action: nil)
    private let delegateBtn = NSButton(title: "Delegate", target: nil, action: nil)
    private let cancelBtn = NSButton(title: "Cancel", target: nil, action: nil)
    private let slaLabel = NSTextField(labelWithString: "")

    func reduce(_ event: String, stepId: String? = nil) {
        switch state {
        case .viewing:
            if event == "FOCUS_STEP", let id = stepId { state = .stepFocused; focusedStepId = id }
            if event == "START_ACTION" { state = .acting; actingStepId = stepId ?? focusedStepId }
        case .stepFocused:
            if event == "BLUR" { state = .viewing; focusedStepId = nil }
            if event == "START_ACTION" { state = .acting; actingStepId = stepId ?? focusedStepId }
            if event == "FOCUS_STEP", let id = stepId { focusedStepId = id }
        case .acting:
            if event == "COMPLETE" { state = .viewing; actingStepId = nil }
            if event == "CANCEL" { state = .viewing; actingStepId = nil }
        }
        updateUI()
    }

    override init(frame: NSRect) {
        super.init(frame: frame); setupSubviews()
        setAccessibilityRole(.list); setAccessibilityLabel("Multi-step approval flow visualization")
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

        stepScroll.hasVerticalScroller = true; stepScroll.drawsBackground = false
        stepContainer.orientation = .vertical; stepContainer.spacing = 4
        stepScroll.documentView = stepContainer
        rootStack.addArrangedSubview(stepScroll)

        // Action bar
        actionBar.orientation = .horizontal; actionBar.spacing = 6
        approveBtn.bezelStyle = .roundRect; approveBtn.target = self; approveBtn.action = #selector(handleApprove(_:))
        rejectBtn.bezelStyle = .roundRect; rejectBtn.target = self; rejectBtn.action = #selector(handleReject(_:))
        delegateBtn.bezelStyle = .roundRect; delegateBtn.target = self; delegateBtn.action = #selector(handleDelegate(_:))
        cancelBtn.bezelStyle = .roundRect; cancelBtn.target = self; cancelBtn.action = #selector(handleCancel(_:))
        actionBar.addArrangedSubview(approveBtn); actionBar.addArrangedSubview(rejectBtn)
        actionBar.addArrangedSubview(delegateBtn); actionBar.addArrangedSubview(cancelBtn)
        actionBar.isHidden = true
        rootStack.addArrangedSubview(actionBar)

        // SLA indicator
        slaLabel.font = .systemFont(ofSize: 11); slaLabel.textColor = .secondaryLabelColor
        slaLabel.isHidden = true
        rootStack.addArrangedSubview(slaLabel)

        updateUI()
    }

    func configure(steps: [Step], currentStep: String, dueAt: Date? = nil) {
        self.steps = steps; self.currentStepId = currentStep; self.dueAt = dueAt
        rebuildSteps(); startSLATimer(); updateUI()
    }

    private func stepStatusIcon(_ status: String) -> String {
        switch status {
        case "approved": return "\u{2713}"
        case "rejected": return "\u{2717}"
        case "skipped": return "\u{2014}"
        case "active": return "\u{25CF}"
        default: return "\u{25CB}"
        }
    }

    private func statusColor(_ status: String) -> NSColor {
        switch status {
        case "approved": return .systemGreen
        case "rejected": return .systemRed
        case "active": return .systemBlue
        case "skipped": return .secondaryLabelColor
        default: return .tertiaryLabelColor
        }
    }

    private func rebuildSteps() {
        stepContainer.arrangedSubviews.forEach { $0.removeFromSuperview() }
        for (i, step) in steps.enumerated() {
            let isCurrent = step.id == currentStepId
            let isFocused = focusIndex == i

            let row = NSStackView(); row.orientation = .horizontal; row.spacing = 8
            row.wantsLayer = true
            if isFocused || isCurrent { row.layer?.backgroundColor = NSColor.controlAccentColor.withAlphaComponent(0.08).cgColor }

            // Indicator
            let indicator = NSTextField(labelWithString: (step.status == "pending" || step.status == "active") ? "\(i + 1)" : stepStatusIcon(step.status))
            indicator.font = .boldSystemFont(ofSize: 13); indicator.textColor = statusColor(step.status)
            indicator.widthAnchor.constraint(equalToConstant: 24).isActive = true; indicator.alignment = .center
            row.addArrangedSubview(indicator)

            // Label button
            let nameBtn = NSButton(title: step.label, target: self, action: #selector(handleStepClick(_:)))
            nameBtn.bezelStyle = .roundRect; nameBtn.tag = i
            nameBtn.setAccessibilityLabel("Step \(i + 1): \(step.label) \u{2014} \(step.status)")
            row.addArrangedSubview(nameBtn)

            // Status badge
            let statusLabel = NSTextField(labelWithString: step.status.capitalized)
            statusLabel.font = .systemFont(ofSize: 10); statusLabel.textColor = statusColor(step.status)
            statusLabel.widthAnchor.constraint(equalToConstant: 60).isActive = true
            row.addArrangedSubview(statusLabel)

            // Approver
            if let approver = step.approver {
                let approverLabel = NSTextField(labelWithString: approver)
                approverLabel.font = .systemFont(ofSize: 10); approverLabel.textColor = .secondaryLabelColor
                row.addArrangedSubview(approverLabel)
            }

            // Quorum
            if let required = step.quorumRequired {
                let current = step.quorumCurrent ?? 0
                let quorumLabel = NSTextField(labelWithString: "\(current)/\(required)")
                quorumLabel.font = .monospacedDigitSystemFont(ofSize: 10, weight: .regular)
                quorumLabel.textColor = .secondaryLabelColor
                quorumLabel.setAccessibilityLabel("\(current) of \(required) approvals")
                row.addArrangedSubview(quorumLabel)
            }

            // Timestamp
            if let ts = step.timestamp {
                let tsLabel = NSTextField(labelWithString: ts)
                tsLabel.font = .systemFont(ofSize: 10); tsLabel.textColor = .tertiaryLabelColor
                row.addArrangedSubview(tsLabel)
            }

            stepContainer.addArrangedSubview(row)

            // Connector line between steps
            if i < steps.count - 1 {
                let connector = NSTextField(labelWithString: "\u{2502}")
                connector.font = .systemFont(ofSize: 10); connector.alignment = .center
                connector.textColor = statusColor(step.status)
                stepContainer.addArrangedSubview(connector)
            }
        }
    }

    private func startSLATimer() {
        slaTimer?.invalidate(); slaTimer = nil
        guard dueAt != nil else { slaLabel.isHidden = true; return }
        slaLabel.isHidden = false
        updateSLA()
        slaTimer = Timer.scheduledTimer(withTimeInterval: 60, repeats: true) { [weak self] _ in self?.updateSLA() }
    }

    private func updateSLA() {
        guard let due = dueAt else { return }
        let diff = due.timeIntervalSinceNow
        if diff <= 0 { slaLabel.stringValue = "SLA: Overdue"; slaLabel.textColor = .systemRed; return }
        let hours = Int(diff) / 3600; let minutes = (Int(diff) % 3600) / 60
        if hours > 24 { slaLabel.stringValue = "SLA: \(hours / 24)d \(hours % 24)h"; slaLabel.textColor = .secondaryLabelColor }
        else if hours > 0 { slaLabel.stringValue = "SLA: \(hours)h \(minutes)m"; slaLabel.textColor = hours < 4 ? .systemOrange : .secondaryLabelColor }
        else { slaLabel.stringValue = "SLA: \(minutes)m"; slaLabel.textColor = .systemRed }
    }

    private func updateUI() {
        actionBar.isHidden = state != .acting
        rebuildSteps()
        setAccessibilityValue("\(steps.count) steps, \(state.rawValue)")
    }

    @objc private func handleStepClick(_ sender: NSButton) {
        let idx = sender.tag; guard idx < steps.count else { return }
        focusIndex = idx
        reduce("FOCUS_STEP", stepId: steps[idx].id)
    }
    @objc private func handleApprove(_ sender: NSButton) {
        if let id = actingStepId { onApprove?(id) }; reduce("COMPLETE")
    }
    @objc private func handleReject(_ sender: NSButton) {
        if let id = actingStepId { onReject?(id) }; reduce("COMPLETE")
    }
    @objc private func handleDelegate(_ sender: NSButton) {
        if let id = actingStepId { onDelegate?(id) }; reduce("COMPLETE")
    }
    @objc private func handleCancel(_ sender: NSButton) { reduce("CANCEL") }

    override var acceptsFirstResponder: Bool { true }
    override func keyDown(with event: NSEvent) {
        switch event.keyCode {
        case 125: // down
            focusIndex = min(focusIndex + 1, steps.count - 1)
            if focusIndex < steps.count { reduce("FOCUS_STEP", stepId: steps[focusIndex].id) }
        case 126: // up
            focusIndex = max(focusIndex - 1, 0)
            if focusIndex < steps.count { reduce("FOCUS_STEP", stepId: steps[focusIndex].id) }
        case 36: // enter
            let step = steps[focusIndex]
            if step.status == "active" || step.id == currentStepId { reduce("START_ACTION", stepId: step.id) }
        case 53: // escape
            if state == .acting { reduce("CANCEL") } else { reduce("BLUR") }
        default: super.keyDown(with: event)
        }
    }
    deinit { slaTimer?.invalidate() }
}
