import SwiftUI

enum ExecutionMetricsPanelWidgetState {
    case idle, updating
}

enum ExecutionMetricsPanelEvent {
    case update, updateComplete
}

func executionMetricsPanelReduce(state: ExecutionMetricsPanelWidgetState, event: ExecutionMetricsPanelEvent) -> ExecutionMetricsPanelWidgetState {
    switch state {
    case .idle:
        if event == .update { return .updating }
        return state
    case .updating:
        if event == .updateComplete { return .idle }
        return state
    }
}

struct ExecutionMetricsPanelView: View {
    var totalTokens: Int
    var totalCost: Double
    var stepCount: Int
    var errorRate: Double
    var tokenLimit: Int? = nil
    var showLatency: Bool = true
    var compact: Bool = false
    var latencyAvg: Double? = nil
    var latencyP95: Double? = nil

    @State private var widgetState: ExecutionMetricsPanelWidgetState = .idle

    private var tokenPct: Double? {
        guard let limit = tokenLimit, limit > 0 else { return nil }
        return min(Double(totalTokens) / Double(limit) * 100, 100)
    }

    private var gaugeColor: Color {
        guard let limit = tokenLimit, limit > 0 else { return .green }
        let pct = Double(totalTokens) / Double(limit) * 100
        if pct >= 90 { return .red }
        if pct >= 70 { return .orange }
        return .green
    }

    private var errorColor: Color {
        if errorRate >= 5 { return .red }
        if errorRate >= 1 { return .orange }
        return .green
    }

    var body: some View {
        let layout = compact ? AnyLayout(HStackLayout(spacing: 8)) : AnyLayout(VStackLayout(alignment: .leading, spacing: 12))

        layout {
            // Step counter
            HStack(spacing: 4) {
                Image(systemName: "list.clipboard")
                    .accessibilityHidden(true)
                Text("\(stepCount) step\(stepCount != 1 ? "s" : "")")
            }
            .accessibilityLabel("Steps: \(stepCount)")

            // Token gauge
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 4) {
                    Text("\(totalTokens)")
                    if let limit = tokenLimit {
                        Text("/ \(limit)")
                    }
                    Text("tokens")
                }
                .foregroundColor(gaugeColor)

                if let pct = tokenPct {
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            RoundedRectangle(cornerRadius: 3)
                                .fill(Color.gray.opacity(0.2))
                                .frame(height: 6)
                            RoundedRectangle(cornerRadius: 3)
                                .fill(gaugeColor)
                                .frame(width: geo.size.width * CGFloat(pct / 100), height: 6)
                        }
                    }
                    .frame(height: 6)

                    Text(String(format: "%.1f%%", pct))
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }
            .accessibilityLabel("Tokens: \(totalTokens)")
            .accessibilityValue(tokenPct.map { String(format: "%.1f percent", $0) } ?? "")

            // Cost display
            Text(String(format: "$%.2f", totalCost))
                .accessibilityLabel(String(format: "Cost: $%.2f", totalCost))

            // Latency card
            if showLatency {
                if let avg = latencyAvg, let p95 = latencyP95 {
                    Text(String(format: "avg %.1fs / p95 %.1fs", avg, p95))
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .accessibilityLabel(String(format: "Latency: average %.1f seconds, p95 %.1f seconds", avg, p95))
                } else {
                    Text("No latency data")
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .accessibilityLabel("Latency: no data")
                }
            }

            // Error rate
            Text(String(format: "%.1f%%", errorRate))
                .foregroundColor(errorColor)
                .accessibilityLabel(String(format: "Error rate: %.1f percent", errorRate))
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Execution metrics")
    }
}
