import SwiftUI

enum PipelineStageStatus: String { case pending, active, complete, failed, skipped }

struct PipelineStage: Identifiable {
    let id: String; let name: String; let status: PipelineStageStatus
    var description: String?; var isTimelock: Bool = false
    var statusIcon: String {
        switch status {
        case .complete: return "\u{2713}"; case .failed: return "\u{2717}"
        case .skipped: return "\u{25B7}"; default: return "\u{25CF}"
        }
    }
}

enum ExecutionPipelineWidgetState { case idle, stageSelected, failed }

struct ExecutionPipelineView: View {
    let stages: [PipelineStage]
    let currentStage: String
    let status: String
    var showTimer: Bool = true
    var showActions: Bool = true
    var compact: Bool = false
    var onStageSelect: ((String) -> Void)?
    var onRetry: (() -> Void)?
    var onCancel: (() -> Void)?
    var onForceExecute: (() -> Void)?

    @State private var widgetState: ExecutionPipelineWidgetState = .idle
    @State private var selectedIndex: Int = -1

    private var isFailed: Bool { status == "failed" || widgetState == .failed }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Pipeline stages
            ScrollView(.horizontal) {
                HStack(spacing: 4) {
                    ForEach(Array(stages.enumerated()), id: \.element.id) { idx, stage in
                        let isCurrent = stage.id == currentStage
                        let isSelected = widgetState == .stageSelected && selectedIndex == idx
                        VStack(spacing: 2) {
                            Text(stage.statusIcon).font(.title3)
                                .foregroundColor(stage.status == .active ? .blue : stage.status == .failed ? .red : stage.status == .complete ? .green : .gray)
                            Text(stage.name).font(.caption).lineLimit(1)
                            if !compact, let desc = stage.description { Text(desc).font(.caption2).foregroundColor(.secondary) }
                        }
                        .padding(8)
                        .background(isSelected ? Color.accentColor.opacity(0.1) : isCurrent ? Color.blue.opacity(0.05) : Color.clear)
                        .cornerRadius(6)
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(isCurrent ? Color.blue.opacity(0.3) : Color.clear))
                        .contentShape(Rectangle())
                        .onTapGesture { selectedIndex = idx; widgetState = .stageSelected; onStageSelect?(stage.id) }
                        .accessibilityLabel("\(stage.name), \(stage.status.rawValue)")

                        if idx < stages.count - 1 { Image(systemName: "arrow.right").font(.caption).foregroundColor(.secondary) }
                    }
                }
            }

            // Detail panel
            if widgetState == .stageSelected && selectedIndex >= 0 && selectedIndex < stages.count {
                let stage = stages[selectedIndex]
                VStack(alignment: .leading, spacing: 4) {
                    Text(stage.name).fontWeight(.bold)
                    if let desc = stage.description { Text(desc).font(.subheadline) }
                    Text(stage.status.rawValue.capitalized).font(.caption).foregroundColor(.secondary)
                }.padding(8).overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.gray.opacity(0.3)))
            }

            // Failure banner
            if isFailed {
                HStack {
                    Text("Pipeline execution failed").foregroundColor(.red)
                    if let retry = onRetry { Button("Retry") { widgetState = .idle; retry() }.buttonStyle(.bordered) }
                }
            }

            // Action bar
            if showActions {
                HStack {
                    if let cancel = onCancel { Button("Cancel", action: cancel).buttonStyle(.bordered) }
                    if let force = onForceExecute { Button("Force Execute", action: force).buttonStyle(.bordered) }
                }
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Execution pipeline: \(status)")
    }
}
