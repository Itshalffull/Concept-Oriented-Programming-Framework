import SwiftUI

enum AuditReportWidgetState {
    case idle, filtering, vulnSelected
}

enum AuditReportEvent {
    case filter, selectVuln, clear, deselect
}

func auditReportReduce(state: AuditReportWidgetState, event: AuditReportEvent) -> AuditReportWidgetState {
    switch state {
    case .idle:
        if event == .filter { return .filtering }
        if event == .selectVuln { return .vulnSelected }
        return state
    case .filtering:
        if event == .clear { return .idle }
        return state
    case .vulnSelected:
        if event == .deselect { return .idle }
        return state
    }
}

struct AuditVulnerability: Identifiable {
    var id: String
    var title: String
    var severity: String // "critical", "high", "moderate", "low"
    var package: String
    var installedVersion: String
    var patchedVersion: String?
    var description: String
    var url: String?
}

struct AuditReportView: View {
    var vulnerabilities: [AuditVulnerability]
    var lastScan: String
    var status: String
    var filterSeverity: String? = nil
    var showRemediation: Bool = true

    @State private var widgetState: AuditReportWidgetState = .idle
    @State private var activeFilter: String? = nil
    @State private var selectedId: String? = nil

    private let allSeverities = ["critical", "high", "moderate", "low"]

    private func severityColor(_ sev: String) -> Color {
        switch sev {
        case "critical": return .red
        case "high": return .orange
        case "moderate": return .yellow
        case "low": return .blue
        default: return .secondary
        }
    }

    private func severityBg(_ sev: String) -> Color {
        severityColor(sev).opacity(0.1)
    }

    private var counts: [String: Int] {
        var result: [String: Int] = [:]
        for sev in allSeverities { result[sev] = 0 }
        for v in vulnerabilities {
            result[v.severity, default: 0] += 1
        }
        return result
    }

    private var total: Int { counts.values.reduce(0, +) }

    private var sorted: [AuditVulnerability] {
        let order = ["critical": 0, "high": 1, "moderate": 2, "low": 3]
        return vulnerabilities.sorted { (order[$0.severity] ?? 4) < (order[$1.severity] ?? 4) }
    }

    private var displayed: [AuditVulnerability] {
        guard widgetState == .filtering, let filter = activeFilter else { return sorted }
        return sorted.filter { $0.severity == filter }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                Text(status)
                    .font(.headline)
                Spacer()
                Text("Last scan: \(lastScan)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            // Severity distribution bar
            if total > 0 {
                GeometryReader { geo in
                    HStack(spacing: 0) {
                        ForEach(allSeverities, id: \.self) { sev in
                            let count = counts[sev] ?? 0
                            if count > 0 {
                                Rectangle()
                                    .fill(severityColor(sev))
                                    .frame(width: geo.size.width * CGFloat(count) / CGFloat(total))
                            }
                        }
                    }
                    .cornerRadius(4)
                }
                .frame(height: 8)
                .accessibilityLabel("Vulnerability severity distribution")
            }

            // Severity filter badges
            HStack(spacing: 8) {
                ForEach(allSeverities, id: \.self) { sev in
                    let count = counts[sev] ?? 0
                    Button {
                        if activeFilter == sev && widgetState == .filtering {
                            activeFilter = nil
                            widgetState = auditReportReduce(state: widgetState, event: .clear)
                        } else {
                            activeFilter = sev
                            widgetState = .idle
                            widgetState = auditReportReduce(state: widgetState, event: .filter)
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Text("\(count)")
                            Text(sev)
                        }
                        .font(.caption)
                        .fontWeight(.semibold)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(activeFilter == sev && widgetState == .filtering ? severityColor(sev) : severityBg(sev))
                        .foregroundColor(activeFilter == sev && widgetState == .filtering ? .white : severityColor(sev))
                        .cornerRadius(12)
                        .overlay(Capsule().stroke(severityColor(sev), lineWidth: 1))
                    }
                    .accessibilityLabel("\(count) \(sev)")
                    .accessibilityValue(activeFilter == sev ? "active filter" : "")
                }
            }

            // Vulnerability list
            if displayed.isEmpty {
                Text(widgetState == .filtering ? "No vulnerabilities match the selected severity." : "No vulnerabilities found.")
                    .font(.body)
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity)
                    .padding()
            } else {
                LazyVStack(spacing: 8) {
                    ForEach(displayed) { vuln in
                        let isExpanded = selectedId == vuln.id && widgetState == .vulnSelected

                        VStack(alignment: .leading, spacing: 8) {
                            // Summary row
                            HStack(spacing: 8) {
                                Text(vuln.severity.uppercased())
                                    .font(.caption2)
                                    .fontWeight(.bold)
                                    .padding(.horizontal, 8)
                                    .padding(.vertical, 2)
                                    .background(severityColor(vuln.severity))
                                    .foregroundColor(.white)
                                    .cornerRadius(12)

                                Text(vuln.title)
                                    .fontWeight(.semibold)
                                    .lineLimit(1)

                                Spacer()

                                Text("\(vuln.package)@\(vuln.installedVersion)")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                                    .font(.system(.caption, design: .monospaced))
                            }

                            // Expanded detail
                            if isExpanded {
                                Text(vuln.description)
                                    .font(.subheadline)

                                if showRemediation {
                                    if let patched = vuln.patchedVersion {
                                        HStack(spacing: 4) {
                                            Text("Fix:").fontWeight(.bold)
                                            Text("Upgrade")
                                            Text(vuln.package)
                                                .font(.system(.caption, design: .monospaced))
                                                .padding(.horizontal, 4)
                                                .background(Color.gray.opacity(0.1))
                                                .cornerRadius(2)
                                            Text("to")
                                            Text(patched)
                                                .font(.system(.caption, design: .monospaced))
                                                .padding(.horizontal, 4)
                                                .background(Color.gray.opacity(0.1))
                                                .cornerRadius(2)
                                        }
                                        .font(.caption)
                                    } else {
                                        Text("No patch available")
                                            .font(.caption)
                                            .foregroundColor(.red)
                                    }
                                }

                                if let url = vuln.url {
                                    Link("View advisory", destination: URL(string: url)!)
                                        .font(.caption)
                                }
                            }
                        }
                        .padding(12)
                        .background(
                            RoundedRectangle(cornerRadius: 6)
                                .stroke(isExpanded ? severityColor(vuln.severity) : Color.gray.opacity(0.2), lineWidth: 1)
                        )
                        .overlay(
                            Rectangle()
                                .fill(severityColor(vuln.severity))
                                .frame(width: 4),
                            alignment: .leading
                        )
                        .background(isExpanded ? severityBg(vuln.severity) : Color.clear)
                        .cornerRadius(6)
                        .onTapGesture {
                            if selectedId == vuln.id {
                                selectedId = nil
                                widgetState = auditReportReduce(state: .vulnSelected, event: .deselect)
                            } else {
                                selectedId = vuln.id
                                widgetState = .idle
                                widgetState = auditReportReduce(state: widgetState, event: .selectVuln)
                            }
                        }
                        .accessibilityLabel("\(vuln.title) \u{2014} \(vuln.severity)")
                    }
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Security audit report")
        .onAppear {
            activeFilter = filterSeverity
            if filterSeverity != nil {
                widgetState = .filtering
            }
        }
    }
}
