import SwiftUI

// State machine: idle | metricSelected
enum ExecutionMetricsPanelWatchState {
    case idle
    case metricSelected
}

enum ExecutionMetricsPanelWatchEvent {
    case selectMetric
    case deselect
}

func executionMetricsPanelWatchReduce(_ state: ExecutionMetricsPanelWatchState, _ event: ExecutionMetricsPanelWatchEvent) -> ExecutionMetricsPanelWatchState {
    switch state {
    case .idle:
        if case .selectMetric = event { return .metricSelected }
        return state
    case .metricSelected:
        if case .deselect = event { return .idle }
        if case .selectMetric = event { return .metricSelected }
        return state
    }
}

struct ExecutionMetricData: Identifiable {
    let id: String
    let label: String
    let value: String
    var unit: String? = nil
    var trend: String? = nil // "up", "down", "flat"
    var status: String? = nil // "ok", "warning", "critical"
}

struct ExecutionMetricsPanelWatchView: View {
    let metrics: [ExecutionMetricData]
    var title: String = "Execution Metrics"
    var lastUpdated: String? = nil

    @State private var state: ExecutionMetricsPanelWatchState = .idle
    @State private var selectedId: String? = nil

    private func statusColor(_ status: String?) -> Color {
        switch status {
        case "ok": return .green
        case "warning": return .orange
        case "critical": return .red
        default: return .primary
        }
    }

    private func trendIcon(_ trend: String?) -> String {
        switch trend {
        case "up": return "arrow.up.right"
        case "down": return "arrow.down.right"
        case "flat": return "arrow.right"
        default: return ""
        }
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
                    if let updated = lastUpdated {
                        Text(updated)
                            .font(.system(size: 7))
                            .foregroundColor(.secondary)
                    }
                }

                // Metrics list
                ForEach(metrics) { metric in
                    Button {
                        if selectedId == metric.id {
                            selectedId = nil
                            state = executionMetricsPanelWatchReduce(state, .deselect)
                        } else {
                            selectedId = metric.id
                            state = executionMetricsPanelWatchReduce(state, .selectMetric)
                        }
                    } label: {
                        HStack(spacing: 4) {
                            // Status dot
                            Circle()
                                .fill(statusColor(metric.status))
                                .frame(width: 5, height: 5)

                            // Label
                            Text(metric.label)
                                .font(.system(size: 9))
                                .lineLimit(1)

                            Spacer()

                            // Trend icon
                            if let trend = metric.trend, !trendIcon(trend).isEmpty {
                                Image(systemName: trendIcon(trend))
                                    .font(.system(size: 7))
                                    .foregroundColor(trend == "up" ? .green : trend == "down" ? .red : .secondary)
                            }

                            // Value
                            HStack(spacing: 1) {
                                Text(metric.value)
                                    .font(.system(size: 9, weight: .semibold, design: .monospaced))
                                    .foregroundColor(statusColor(metric.status))
                                if let unit = metric.unit {
                                    Text(unit)
                                        .font(.system(size: 7))
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                        .padding(4)
                        .background(selectedId == metric.id ? Color.blue.opacity(0.1) : Color.clear)
                        .cornerRadius(3)
                    }
                    .buttonStyle(.plain)

                    // Selected detail
                    if selectedId == metric.id {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(metric.label)
                                .font(.system(size: 8, weight: .semibold))
                            HStack {
                                Text("Value: \(metric.value)\(metric.unit ?? "")")
                                    .font(.system(size: 8))
                                if let trend = metric.trend {
                                    Text("Trend: \(trend)")
                                        .font(.system(size: 8))
                                        .foregroundColor(.secondary)
                                }
                            }
                            if let status = metric.status {
                                Text("Status: \(status)")
                                    .font(.system(size: 8))
                                    .foregroundColor(statusColor(status))
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
        .accessibilityLabel("Execution metrics, \(metrics.count) items")
    }
}
