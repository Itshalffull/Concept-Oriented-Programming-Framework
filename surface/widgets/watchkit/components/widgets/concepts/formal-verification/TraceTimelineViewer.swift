import SwiftUI

// State machine: idle | playing | cellSelected
enum TraceTimelineWatchState {
    case idle
    case playing
    case cellSelected
}

enum TraceTimelineWatchEvent {
    case play
    case pause
    case stepForward
    case stepBackward
    case selectCell
    case deselect
    case stepEnd
}

func traceTimelineWatchReduce(_ state: TraceTimelineWatchState, _ event: TraceTimelineWatchEvent) -> TraceTimelineWatchState {
    switch state {
    case .idle:
        switch event {
        case .play: return .playing
        case .selectCell: return .cellSelected
        default: return state
        }
    case .playing:
        switch event {
        case .pause, .stepEnd: return .idle
        default: return state
        }
    case .cellSelected:
        switch event {
        case .deselect: return .idle
        case .selectCell: return .cellSelected
        default: return state
        }
    }
}

struct TraceStep: Identifiable {
    let id: Int
    let label: String
    let stateValues: [String: String]
    var isError: Bool = false
    var timestamp: String? = nil
}

struct TraceTimelineViewerWatchView: View {
    let steps: [TraceStep]
    var variables: [String]? = nil
    var onStepChange: ((Int) -> Void)? = nil

    @State private var state: TraceTimelineWatchState = .idle
    @State private var activeStep: Int = 0
    @State private var selectedVariable: String? = nil

    private var resolvedVariables: [String] {
        if let vars = variables { return vars }
        var keys = Set<String>()
        for step in steps {
            for key in step.stateValues.keys { keys.insert(key) }
        }
        return Array(keys).sorted()
    }

    private var currentStepData: TraceStep? {
        guard activeStep >= 0 && activeStep < steps.count else { return nil }
        return steps[activeStep]
    }

    private func didValueChange(at stepIdx: Int, variable: String) -> Bool {
        guard stepIdx > 0, stepIdx < steps.count else { return false }
        return steps[stepIdx].stateValues[variable] != steps[stepIdx - 1].stateValues[variable]
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 4) {
                // Step counter and controls
                HStack {
                    Text("Step \(activeStep + 1)/\(steps.count)")
                        .font(.caption2)
                        .fontWeight(.semibold)
                    Spacer()
                    if currentStepData?.isError == true {
                        Text("ERR")
                            .font(.system(size: 8))
                            .foregroundColor(.red)
                            .fontWeight(.bold)
                    }
                }

                // Navigation buttons
                HStack(spacing: 12) {
                    Button {
                        if activeStep > 0 {
                            activeStep -= 1
                            onStepChange?(activeStep)
                        }
                    } label: {
                        Image(systemName: "chevron.left")
                            .font(.caption2)
                    }
                    .disabled(activeStep <= 0)

                    ProgressView(value: steps.isEmpty ? 0 : Double(activeStep + 1) / Double(steps.count))
                        .tint(.blue)

                    Button {
                        if activeStep < steps.count - 1 {
                            activeStep += 1
                            onStepChange?(activeStep)
                        }
                    } label: {
                        Image(systemName: "chevron.right")
                            .font(.caption2)
                    }
                    .disabled(activeStep >= steps.count - 1)
                }

                // Current step label
                if let stepData = currentStepData {
                    Text(stepData.label)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }

                Divider()

                // Variable values for current step
                ForEach(resolvedVariables, id: \.self) { variable in
                    let value = currentStepData?.stateValues[variable] ?? ""
                    let changed = didValueChange(at: activeStep, variable: variable)

                    Button {
                        selectedVariable = variable
                        state = traceTimelineWatchReduce(state, .selectCell)
                    } label: {
                        HStack(spacing: 4) {
                            Text(variable)
                                .font(.system(size: 9))
                                .foregroundColor(.secondary)
                                .lineLimit(1)
                            Spacer()
                            Text(value)
                                .font(.system(size: 9, design: .monospaced))
                                .fontWeight(changed ? .bold : .regular)
                                .foregroundColor(changed ? .yellow : .primary)
                                .lineLimit(1)
                        }
                        .padding(.vertical, 1)
                        .background(selectedVariable == variable ? Color.blue.opacity(0.15) : Color.clear)
                        .cornerRadius(2)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 4)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Trace timeline with \(steps.count) steps")
    }
}
