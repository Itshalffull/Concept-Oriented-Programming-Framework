import SwiftUI

// State machine: idle | runSelected
enum RunListTableWatchState {
    case idle
    case runSelected
}

enum RunListTableWatchEvent {
    case selectRun
    case deselect
}

func runListTableWatchReduce(_ state: RunListTableWatchState, _ event: RunListTableWatchEvent) -> RunListTableWatchState {
    switch state {
    case .idle:
        if case .selectRun = event { return .runSelected }
        return state
    case .runSelected:
        if case .deselect = event { return .idle }
        if case .selectRun = event { return .runSelected }
        return state
    }
}

struct ProcessRunData: Identifiable {
    let id: String
    let name: String
    let status: String // "running", "completed", "failed", "pending", "cancelled"
    var startedAt: String? = nil
    var duration: String? = nil
    var triggeredBy: String? = nil
}

struct RunListTableWatchView: View {
    let runs: [ProcessRunData]
    var title: String = "Process Runs"
    var onSelect: ((String) -> Void)? = nil

    @State private var state: RunListTableWatchState = .idle
    @State private var selectedId: String? = nil
    @State private var filterStatus: String = "all"

    private func statusIcon(_ status: String) -> String {
        switch status {
        case "running": return "play.circle.fill"
        case "completed": return "checkmark.circle.fill"
        case "failed": return "xmark.circle.fill"
        case "pending": return "clock"
        case "cancelled": return "stop.circle"
        default: return "questionmark.circle"
        }
    }

    private func statusColor(_ status: String) -> Color {
        switch status {
        case "running": return .blue
        case "completed": return .green
        case "failed": return .red
        case "pending": return .orange
        case "cancelled": return .secondary
        default: return .secondary
        }
    }

    private var filteredRuns: [ProcessRunData] {
        if filterStatus == "all" { return runs }
        return runs.filter { $0.status == filterStatus }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                // Header
                HStack {
                    Text(title)
                        .font(.caption2)
                        .fontWeight(.bold)
                    Spacer()
                    Text("\(runs.count) runs")
                        .font(.system(size: 8))
                        .foregroundColor(.secondary)
                }

                // Filter
                Picker("Status", selection: $filterStatus) {
                    Text("All").tag("all")
                    Text("Running").tag("running")
                    Text("Done").tag("completed")
                    Text("Failed").tag("failed")
                }
                .pickerStyle(.menu)
                .font(.system(size: 8))

                // Runs list
                ForEach(filteredRuns) { run in
                    Button {
                        if selectedId == run.id {
                            selectedId = nil
                            state = runListTableWatchReduce(state, .deselect)
                        } else {
                            selectedId = run.id
                            state = runListTableWatchReduce(state, .selectRun)
                            onSelect?(run.id)
                        }
                    } label: {
                        HStack(spacing: 4) {
                            // Status icon
                            if run.status == "running" {
                                ProgressView()
                                    .scaleEffect(0.3)
                                    .frame(width: 10, height: 10)
                            } else {
                                Image(systemName: statusIcon(run.status))
                                    .font(.system(size: 8))
                                    .foregroundColor(statusColor(run.status))
                            }

                            // Run name
                            Text(run.name)
                                .font(.system(size: 9))
                                .lineLimit(1)

                            Spacer()

                            // Duration
                            if let duration = run.duration {
                                Text(duration)
                                    .font(.system(size: 7, design: .monospaced))
                                    .foregroundColor(.secondary)
                            }
                        }
                        .padding(3)
                        .background(selectedId == run.id ? Color.blue.opacity(0.1) : Color.clear)
                        .cornerRadius(3)
                    }
                    .buttonStyle(.plain)

                    // Selected detail
                    if selectedId == run.id {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(run.name)
                                .font(.system(size: 8, weight: .semibold))
                            HStack {
                                Text("Status:")
                                    .font(.system(size: 8))
                                    .foregroundColor(.secondary)
                                Text(run.status.capitalized)
                                    .font(.system(size: 8, weight: .semibold))
                                    .foregroundColor(statusColor(run.status))
                            }
                            if let started = run.startedAt {
                                Text("Started: \(started)")
                                    .font(.system(size: 8))
                                    .foregroundColor(.secondary)
                            }
                            if let duration = run.duration {
                                Text("Duration: \(duration)")
                                    .font(.system(size: 8))
                                    .foregroundColor(.secondary)
                            }
                            if let trigger = run.triggeredBy {
                                Text("Triggered by: \(trigger)")
                                    .font(.system(size: 8))
                                    .foregroundColor(.secondary)
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
        .accessibilityLabel("Process runs, \(runs.count) items")
    }
}
