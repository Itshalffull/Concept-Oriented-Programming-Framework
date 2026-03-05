import SwiftUI

// State machine: idle | resultSelected
enum EvalResultsTableWatchState {
    case idle
    case resultSelected
}

enum EvalResultsTableWatchEvent {
    case selectResult
    case deselect
}

func evalResultsTableWatchReduce(_ state: EvalResultsTableWatchState, _ event: EvalResultsTableWatchEvent) -> EvalResultsTableWatchState {
    switch state {
    case .idle:
        if case .selectResult = event { return .resultSelected }
        return state
    case .resultSelected:
        if case .deselect = event { return .idle }
        if case .selectResult = event { return .resultSelected }
        return state
    }
}

struct EvalResultData: Identifiable {
    let id: String
    let testCase: String
    let score: Double // 0.0 - 1.0
    var status: String = "pass" // "pass", "fail", "error", "skip"
    var expected: String? = nil
    var actual: String? = nil
    var latency: String? = nil
    var model: String? = nil
}

struct EvalResultsTableWatchView: View {
    let results: [EvalResultData]
    var title: String = "Eval Results"
    var overallScore: Double? = nil

    @State private var state: EvalResultsTableWatchState = .idle
    @State private var selectedId: String? = nil
    @State private var filterStatus: String = "all"

    private func statusIcon(_ status: String) -> String {
        switch status {
        case "pass": return "checkmark.circle.fill"
        case "fail": return "xmark.circle.fill"
        case "error": return "exclamationmark.triangle.fill"
        case "skip": return "forward.fill"
        default: return "questionmark.circle"
        }
    }

    private func statusColor(_ status: String) -> Color {
        switch status {
        case "pass": return .green
        case "fail": return .red
        case "error": return .orange
        case "skip": return .secondary
        default: return .secondary
        }
    }

    private func scoreColor(_ score: Double) -> Color {
        if score >= 0.8 { return .green }
        if score >= 0.5 { return .yellow }
        return .red
    }

    private var filteredResults: [EvalResultData] {
        if filterStatus == "all" { return results }
        return results.filter { $0.status == filterStatus }
    }

    private var passCount: Int {
        results.filter { $0.status == "pass" }.count
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
                    Text("\(passCount)/\(results.count) pass")
                        .font(.system(size: 8))
                        .foregroundColor(.secondary)
                }

                // Overall score gauge
                if let overall = overallScore {
                    HStack(spacing: 6) {
                        Gauge(value: overall) {
                            EmptyView()
                        } currentValueLabel: {
                            Text("\(Int(overall * 100))%")
                                .font(.system(size: 10, weight: .bold, design: .monospaced))
                                .foregroundColor(scoreColor(overall))
                        }
                        .gaugeStyle(.accessoryCircular)
                        .tint(scoreColor(overall))
                        .frame(width: 40, height: 40)

                        VStack(alignment: .leading) {
                            Text("Overall Score")
                                .font(.system(size: 8))
                                .foregroundColor(.secondary)
                            Text("\(passCount) pass, \(results.count - passCount) other")
                                .font(.system(size: 7))
                                .foregroundColor(.secondary)
                        }
                    }
                }

                // Filter
                Picker("Status", selection: $filterStatus) {
                    Text("All").tag("all")
                    Text("Pass").tag("pass")
                    Text("Fail").tag("fail")
                    Text("Error").tag("error")
                }
                .pickerStyle(.menu)
                .font(.system(size: 8))

                // Results list
                ForEach(filteredResults) { result in
                    Button {
                        if selectedId == result.id {
                            selectedId = nil
                            state = evalResultsTableWatchReduce(state, .deselect)
                        } else {
                            selectedId = result.id
                            state = evalResultsTableWatchReduce(state, .selectResult)
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Image(systemName: statusIcon(result.status))
                                .font(.system(size: 8))
                                .foregroundColor(statusColor(result.status))

                            Text(result.testCase)
                                .font(.system(size: 9))
                                .lineLimit(1)

                            Spacer()

                            // Score
                            Text("\(Int(result.score * 100))%")
                                .font(.system(size: 8, weight: .semibold, design: .monospaced))
                                .foregroundColor(scoreColor(result.score))
                        }
                        .padding(3)
                        .background(selectedId == result.id ? Color.blue.opacity(0.1) : Color.clear)
                        .cornerRadius(3)
                    }
                    .buttonStyle(.plain)

                    // Selected detail
                    if selectedId == result.id {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(result.testCase)
                                .font(.system(size: 8, weight: .semibold))

                            HStack {
                                Text("Score: \(Int(result.score * 100))%")
                                    .font(.system(size: 8))
                                    .foregroundColor(scoreColor(result.score))
                                Text("Status: \(result.status)")
                                    .font(.system(size: 8))
                                    .foregroundColor(statusColor(result.status))
                            }

                            if let expected = result.expected {
                                VStack(alignment: .leading, spacing: 1) {
                                    Text("Expected:")
                                        .font(.system(size: 7, weight: .bold))
                                        .foregroundColor(.secondary)
                                    Text(expected)
                                        .font(.system(size: 7, design: .monospaced))
                                        .lineLimit(3)
                                }
                            }

                            if let actual = result.actual {
                                VStack(alignment: .leading, spacing: 1) {
                                    Text("Actual:")
                                        .font(.system(size: 7, weight: .bold))
                                        .foregroundColor(.secondary)
                                    Text(actual)
                                        .font(.system(size: 7, design: .monospaced))
                                        .foregroundColor(result.status == "fail" ? .red : .primary)
                                        .lineLimit(3)
                                }
                            }

                            HStack {
                                if let latency = result.latency {
                                    Text(latency)
                                        .font(.system(size: 7))
                                        .foregroundColor(.secondary)
                                }
                                if let model = result.model {
                                    Text(model)
                                        .font(.system(size: 7))
                                        .foregroundColor(.secondary)
                                }
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
        .accessibilityLabel("Eval results, \(passCount) of \(results.count) passing")
    }
}
