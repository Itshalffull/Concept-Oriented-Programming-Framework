import SwiftUI

// State machine: idle | findingSelected
enum AuditReportWatchState {
    case idle
    case findingSelected
}

enum AuditReportWatchEvent {
    case selectFinding
    case deselect
}

func auditReportWatchReduce(_ state: AuditReportWatchState, _ event: AuditReportWatchEvent) -> AuditReportWatchState {
    switch state {
    case .idle:
        if case .selectFinding = event { return .findingSelected }
        return state
    case .findingSelected:
        if case .deselect = event { return .idle }
        if case .selectFinding = event { return .findingSelected }
        return state
    }
}

struct AuditFindingData: Identifiable {
    let id: String
    let title: String
    let severity: String // "critical", "high", "medium", "low", "info"
    var description: String? = nil
    var packageName: String? = nil
    var fixAvailable: Bool = false
}

struct AuditReportWatchView: View {
    let findings: [AuditFindingData]
    var title: String = "Audit Report"
    var scannedAt: String? = nil
    var packageCount: Int? = nil

    @State private var state: AuditReportWatchState = .idle
    @State private var selectedId: String? = nil
    @State private var filterSeverity: String = "all"

    private func severityColor(_ severity: String) -> Color {
        switch severity {
        case "critical": return .red
        case "high": return .orange
        case "medium": return .yellow
        case "low": return .blue
        case "info": return .secondary
        default: return .secondary
        }
    }

    private func severityIcon(_ severity: String) -> String {
        switch severity {
        case "critical": return "exclamationmark.shield.fill"
        case "high": return "exclamationmark.triangle.fill"
        case "medium": return "exclamationmark.triangle"
        case "low": return "info.circle"
        case "info": return "info.circle"
        default: return "questionmark.circle"
        }
    }

    private var filteredFindings: [AuditFindingData] {
        if filterSeverity == "all" { return findings }
        return findings.filter { $0.severity == filterSeverity }
    }

    private var criticalCount: Int {
        findings.filter { $0.severity == "critical" || $0.severity == "high" }.count
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 6) {
                // Header
                HStack {
                    Text(title)
                        .font(.caption2)
                        .fontWeight(.bold)
                    Spacer()
                    Text("\(findings.count) findings")
                        .font(.system(size: 8))
                        .foregroundColor(.secondary)
                }

                // Summary bar
                HStack(spacing: 6) {
                    if criticalCount > 0 {
                        HStack(spacing: 2) {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .font(.system(size: 8))
                                .foregroundColor(.red)
                            Text("\(criticalCount) critical/high")
                                .font(.system(size: 8))
                                .foregroundColor(.red)
                        }
                    }
                    if let count = packageCount {
                        Text("\(count) packages")
                            .font(.system(size: 8))
                            .foregroundColor(.secondary)
                    }
                }

                // Filter
                Picker("Severity", selection: $filterSeverity) {
                    Text("All").tag("all")
                    Text("Critical").tag("critical")
                    Text("High").tag("high")
                    Text("Medium").tag("medium")
                    Text("Low").tag("low")
                }
                .pickerStyle(.menu)
                .font(.system(size: 8))

                // Findings list
                ForEach(filteredFindings) { finding in
                    Button {
                        if selectedId == finding.id {
                            selectedId = nil
                            state = auditReportWatchReduce(state, .deselect)
                        } else {
                            selectedId = finding.id
                            state = auditReportWatchReduce(state, .selectFinding)
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: severityIcon(finding.severity))
                                .font(.system(size: 8))
                                .foregroundColor(severityColor(finding.severity))

                            Text(finding.title)
                                .font(.system(size: 9))
                                .lineLimit(1)

                            Spacer()

                            if finding.fixAvailable {
                                Image(systemName: "wrench.fill")
                                    .font(.system(size: 7))
                                    .foregroundColor(.green)
                            }
                        }
                        .padding(4)
                        .background(selectedId == finding.id ? Color.blue.opacity(0.1) : Color.clear)
                        .cornerRadius(3)
                    }
                    .buttonStyle(.plain)

                    // Selected detail
                    if selectedId == finding.id {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(finding.title)
                                .font(.system(size: 8, weight: .semibold))
                            HStack {
                                Text("Severity: \(finding.severity)")
                                    .font(.system(size: 8))
                                    .foregroundColor(severityColor(finding.severity))
                                if finding.fixAvailable {
                                    Text("Fix available")
                                        .font(.system(size: 7))
                                        .foregroundColor(.green)
                                }
                            }
                            if let pkg = finding.packageName {
                                Text("Package: \(pkg)")
                                    .font(.system(size: 8))
                                    .foregroundColor(.secondary)
                            }
                            if let desc = finding.description {
                                Text(desc)
                                    .font(.system(size: 8))
                                    .foregroundColor(.secondary)
                                    .lineLimit(4)
                            }
                        }
                        .padding(4)
                        .background(Color.secondary.opacity(0.05))
                        .cornerRadius(3)
                    }
                }
            }
            .padding(.horizontal, 2)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Audit report, \(findings.count) findings")
    }
}
