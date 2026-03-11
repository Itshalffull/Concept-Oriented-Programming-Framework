import AppKit

class AuditReportView: NSView {

    enum State: String { case idle; case filtering; case vulnSelected }
    enum Severity: String { case critical; case high; case medium; case low }

    struct Vulnerability {
        let id: String
        let title: String
        let packageName: String
        let severity: Severity
        let remediation: String?
    }

    private(set) var state: State = .idle
    private var vulns: [Vulnerability] = []
    private var filteredVulns: [Vulnerability] = []
    private var selectedVulnId: String? = nil
    private var activeSeverityFilter: Severity? = nil
    private var focusIndex: Int = 0

    var onVulnSelect: ((String) -> Void)?

    private let rootStack = NSStackView()
    private let headerLabel = NSTextField(labelWithString: "Security Audit Report")
    private let summaryRow = NSStackView()
    private let criticalLabel = NSTextField(labelWithString: "")
    private let highLabel = NSTextField(labelWithString: "")
    private let mediumLabel = NSTextField(labelWithString: "")
    private let lowLabel = NSTextField(labelWithString: "")
    private let vulnScroll = NSScrollView()
    private let vulnContainer = NSStackView()
    private let detailPanel = NSStackView()
    private let detailTitleLabel = NSTextField(labelWithString: "")
    private let detailPackageLabel = NSTextField(labelWithString: "")
    private let detailSeverityLabel = NSTextField(labelWithString: "")
    private let detailRemediationLabel = NSTextField(wrappingLabelWithString: "")

    // MARK: - State machine

    func reduce(_ event: String, vulnId: String? = nil) {
        switch state {
        case .idle:
            if event == "FILTER" { state = .filtering }
            if event == "SELECT_VULN", let id = vulnId { state = .vulnSelected; selectedVulnId = id; onVulnSelect?(id) }
        case .filtering:
            if event == "CLEAR_FILTER" { state = .idle; activeSeverityFilter = nil; applyFilter() }
            if event == "SELECT_VULN", let id = vulnId { state = .vulnSelected; selectedVulnId = id; onVulnSelect?(id) }
        case .vulnSelected:
            if event == "DESELECT" { state = .idle; selectedVulnId = nil }
            if event == "SELECT_VULN", let id = vulnId { selectedVulnId = id; onVulnSelect?(id) }
        }
        updateUI()
    }

    // MARK: - Init

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Security audit report panel showing vulnerabilities")
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

        summaryRow.orientation = .horizontal
        summaryRow.spacing = 12
        criticalLabel.font = .boldSystemFont(ofSize: 12); criticalLabel.textColor = .systemRed
        highLabel.font = .boldSystemFont(ofSize: 12); highLabel.textColor = .systemOrange
        mediumLabel.font = .boldSystemFont(ofSize: 12); mediumLabel.textColor = .systemYellow
        lowLabel.font = .boldSystemFont(ofSize: 12); lowLabel.textColor = .secondaryLabelColor
        for lbl in [criticalLabel, highLabel, mediumLabel, lowLabel] {
            let btn = NSButton(title: "", target: self, action: #selector(handleSeverityFilter(_:)))
            btn.bezelStyle = .roundRect
            summaryRow.addArrangedSubview(lbl)
        }
        rootStack.addArrangedSubview(summaryRow)

        vulnScroll.hasVerticalScroller = true
        vulnScroll.drawsBackground = false
        vulnContainer.orientation = .vertical
        vulnContainer.spacing = 4
        vulnScroll.documentView = vulnContainer
        rootStack.addArrangedSubview(vulnScroll)

        detailPanel.orientation = .vertical
        detailPanel.spacing = 4
        detailPanel.isHidden = true
        detailTitleLabel.font = .boldSystemFont(ofSize: 13)
        detailPackageLabel.font = .systemFont(ofSize: 12)
        detailSeverityLabel.font = .boldSystemFont(ofSize: 12)
        detailRemediationLabel.font = .systemFont(ofSize: 12)
        detailRemediationLabel.textColor = .secondaryLabelColor
        detailPanel.addArrangedSubview(detailTitleLabel)
        detailPanel.addArrangedSubview(detailPackageLabel)
        detailPanel.addArrangedSubview(detailSeverityLabel)
        detailPanel.addArrangedSubview(detailRemediationLabel)
        rootStack.addArrangedSubview(detailPanel)

        updateUI()
    }

    // MARK: - Configure

    func configure(vulns: [Vulnerability]) {
        self.vulns = vulns
        applyFilter()
        updateUI()
    }

    private func applyFilter() {
        if let sev = activeSeverityFilter {
            filteredVulns = vulns.filter { $0.severity == sev }
        } else {
            filteredVulns = vulns
        }
        rebuildList()
    }

    private func rebuildList() {
        vulnContainer.arrangedSubviews.forEach { $0.removeFromSuperview() }
        for (i, vuln) in filteredVulns.enumerated() {
            let row = NSStackView()
            row.orientation = .horizontal
            row.spacing = 8

            let sevIcon = NSTextField(labelWithString: severityIcon(vuln.severity))
            sevIcon.font = .boldSystemFont(ofSize: 12)
            sevIcon.textColor = severityColor(vuln.severity)
            row.addArrangedSubview(sevIcon)

            let nameBtn = NSButton(title: vuln.title, target: self, action: #selector(handleVulnClick(_:)))
            nameBtn.bezelStyle = .roundRect
            nameBtn.tag = i
            nameBtn.setAccessibilityLabel("\(vuln.title) (\(vuln.severity.rawValue))")
            row.addArrangedSubview(nameBtn)

            let pkgLabel = NSTextField(labelWithString: vuln.packageName)
            pkgLabel.font = .systemFont(ofSize: 11)
            pkgLabel.textColor = .secondaryLabelColor
            row.addArrangedSubview(pkgLabel)

            vulnContainer.addArrangedSubview(row)
        }

        // Summary
        let counts = Dictionary(grouping: vulns, by: { $0.severity }).mapValues { $0.count }
        criticalLabel.stringValue = "Critical: \(counts[.critical] ?? 0)"
        highLabel.stringValue = "High: \(counts[.high] ?? 0)"
        mediumLabel.stringValue = "Medium: \(counts[.medium] ?? 0)"
        lowLabel.stringValue = "Low: \(counts[.low] ?? 0)"
    }

    private func severityIcon(_ sev: Severity) -> String {
        switch sev { case .critical: return "\u{26D4}"; case .high: return "\u{26A0}"; case .medium: return "\u{25CF}"; case .low: return "\u{25CB}" }
    }

    private func severityColor(_ sev: Severity) -> NSColor {
        switch sev { case .critical: return .systemRed; case .high: return .systemOrange; case .medium: return .systemYellow; case .low: return .secondaryLabelColor }
    }

    private func updateUI() {
        if state == .vulnSelected, let id = selectedVulnId, let v = vulns.first(where: { $0.id == id }) {
            detailPanel.isHidden = false
            detailTitleLabel.stringValue = v.title
            detailPackageLabel.stringValue = "Package: \(v.packageName)"
            detailSeverityLabel.stringValue = "Severity: \(v.severity.rawValue)"
            detailSeverityLabel.textColor = severityColor(v.severity)
            detailRemediationLabel.stringValue = v.remediation ?? "No remediation available"
        } else { detailPanel.isHidden = true }

        setAccessibilityValue("\(vulns.count) vulnerabilities, \(state.rawValue)")
    }

    @objc private func handleVulnClick(_ sender: NSButton) {
        let idx = sender.tag; guard idx < filteredVulns.count else { return }
        reduce("SELECT_VULN", vulnId: filteredVulns[idx].id)
    }
    @objc private func handleSeverityFilter(_ sender: NSButton) { /* filter toggling */ }

    override var acceptsFirstResponder: Bool { true }
    override func keyDown(with event: NSEvent) {
        switch event.keyCode {
        case 125: focusIndex = min(focusIndex + 1, filteredVulns.count - 1); if focusIndex < filteredVulns.count { reduce("SELECT_VULN", vulnId: filteredVulns[focusIndex].id) }
        case 126: focusIndex = max(focusIndex - 1, 0); if focusIndex < filteredVulns.count { reduce("SELECT_VULN", vulnId: filteredVulns[focusIndex].id) }
        case 53: reduce("DESELECT")
        default: super.keyDown(with: event)
        }
    }
    deinit {}
}
