import SwiftUI

// State machine: idle | stageSelected | failed
enum ExecutionPipelineWatchState {
    case idle
    case stageSelected
    case failed
}

enum ExecutionPipelineWatchEvent {
    case advance
    case selectStage(String)
    case fail
    case deselect
    case retry
    case reset
}

func executionPipelineWatchReduce(_ state: ExecutionPipelineWatchState, _ event: ExecutionPipelineWatchEvent) -> ExecutionPipelineWatchState {
    switch state {
    case .idle:
        switch event {
        case .selectStage: return .stageSelected
        case .fail: return .failed
        default: return state
        }
    case .stageSelected:
        if case .deselect = event { return .idle }
        return state
    case .failed:
        switch event {
        case .retry, .reset: return .idle
        default: return state
        }
    }
}

struct PipelineStageData: Identifiable {
    let id: String
    let name: String
    let status: String // "pending", "active", "complete", "failed", "skipped"
    var description: String? = nil
    var isTimelock: Bool = false
}

struct ExecutionPipelineWatchView: View {
    let stages: [PipelineStageData]
    let currentStage: String
    let status: String
    var onStageSelect: ((String) -> Void)? = nil
    var onRetry: (() -> Void)? = nil

    @State private var state: ExecutionPipelineWatchState = .idle
    @State private var selectedStageId: String? = nil

    private func statusIcon(_ status: String) -> String {
        switch status {
        case "complete": return "\u{2713}"
        case "failed": return "\u{2717}"
        case "active": return "\u{25CF}"
        case "skipped": return "\u{25B6}"
        default: return "\u{25CB}"
        }
    }

    private func statusColor(_ status: String) -> Color {
        switch status {
        case "complete": return .green
        case "failed": return .red
        case "active": return .blue
        case "skipped": return .secondary
        default: return .gray
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                // Header
                HStack {
                    Text("Pipeline")
                        .font(.caption2).fontWeight(.bold)
                    Spacer()
                    Text(status)
                        .font(.system(size: 8))
                        .foregroundColor(status == "failed" ? .red : status == "complete" ? .green : .blue)
                }

                // Stages list (vertical on watch)
                ForEach(stages) { stage in
                    let isCurrent = stage.id == currentStage
                    let isSelected = selectedStageId == stage.id

                    Button {
                        if isSelected {
                            selectedStageId = nil
                            state = executionPipelineWatchReduce(state, .deselect)
                        } else {
                            selectedStageId = stage.id
                            state = executionPipelineWatchReduce(state, .selectStage(stage.id))
                            onStageSelect?(stage.id)
                        }
                    } label: {
                        HStack(spacing: 4) {
                            Text(statusIcon(stage.status))
                                .font(.system(size: 10))
                                .foregroundColor(statusColor(stage.status))
                            VStack(alignment: .leading, spacing: 1) {
                                Text(stage.name)
                                    .font(.caption2)
                                    .fontWeight(isCurrent ? .bold : .regular)
                                if let desc = stage.description, isSelected {
                                    Text(desc)
                                        .font(.system(size: 8))
                                        .foregroundColor(.secondary)
                                }
                            }
                            Spacer()
                            if isCurrent {
                                Text("current")
                                    .font(.system(size: 7))
                                    .foregroundColor(.blue)
                            }
                        }
                        .padding(.vertical, 2)
                        .background(isSelected ? Color.blue.opacity(0.1) : Color.clear)
                        .cornerRadius(3)
                    }
                    .buttonStyle(.plain)
                }

                // Failure banner
                if status == "failed" {
                    Divider()
                    HStack {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .font(.caption2).foregroundColor(.red)
                        Text("Failed")
                            .font(.caption2).foregroundColor(.red)
                        Spacer()
                        if onRetry != nil {
                            Button("Retry") { onRetry?() }
                                .font(.caption2)
                        }
                    }
                }
            }
            .padding(.horizontal, 4)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Execution pipeline: \(status)")
    }
}
