import AppKit

class AuditReportView: NSView {
    enum State: String { case idle; case filtering; case vulnSelected }
    private var state: State = .idle

    override init(frame: NSRect) {
        super.init(frame: frame)
        setupSubviews()
        setAccessibilityRole(.group)
        setAccessibilityLabel("Security audit report panel showing vuln")
    }

    required init?(coder: NSCoder) { super.init(coder: coder) }

    private func setupSubviews() {
        // Parts: root, header, severityChart, criticalCount, highCount, mediumCount, lowCount, vulnList, vulnItem, vulnTitle, vulnPackage, vulnSeverity, vulnRemediation
    }

    func send(_ event: String) {
        // State machine dispatch
    }
}
