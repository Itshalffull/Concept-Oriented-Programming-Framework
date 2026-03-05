import SwiftUI

struct TraceStep: Identifiable {
    let id: Int
    let index: Int
    let label: String
    let state: [String: String]
    var isError: Bool = false
    var timestamp: String?
}

enum TraceTimelineWidgetState { case idle, playing, cellSelected }

struct TraceTimelineViewerView: View {
    let steps: [TraceStep]
    var variables: [String]?
    var currentStep: Int?
    var playbackSpeed: Double = 1.0
    var showChangesOnly: Bool = false
    var onStepChange: ((Int) -> Void)?

    @State private var widgetState: TraceTimelineWidgetState = .idle
    @State private var internalStep: Int = 0
    @State private var selectedCell: (step: Int, variable: String)?

    private var activeStep: Int { currentStep ?? internalStep }
    private var derivedVariables: [String] {
        if let v = variables { return v }
        var keys = Set<String>()
        for s in steps { for k in s.state.keys { keys.insert(k) } }
        return Array(keys).sorted()
    }

    private func didChange(_ stepIdx: Int, _ variable: String) -> Bool {
        guard stepIdx > 0, stepIdx < steps.count else { return false }
        return steps[stepIdx - 1].state[variable] != steps[stepIdx].state[variable]
    }

    private func goToStep(_ idx: Int) {
        let clamped = max(0, min(idx, steps.count - 1))
        internalStep = clamped
        onStepChange?(clamped)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Step headers
            ScrollView(.horizontal) {
                HStack(spacing: 2) {
                    Text("Var").frame(width: 80, alignment: .leading).font(.caption.bold())
                    ForEach(steps) { step in
                        Text("\(step.index)").frame(width: 60).font(.caption)
                            .foregroundColor(step.isError ? .red : .primary)
                    }
                }
            }

            // Variable lanes
            ForEach(derivedVariables, id: \.self) { variable in
                ScrollView(.horizontal) {
                    HStack(spacing: 2) {
                        Text(variable).frame(width: 80, alignment: .leading).font(.caption).lineLimit(1)
                        ForEach(steps) { step in
                            let value = step.state[variable] ?? ""
                            let changed = didChange(step.index, variable)
                            let isCurrent = step.index == activeStep
                            let isSelected = selectedCell?.step == step.index && selectedCell?.variable == variable
                            Text(value).frame(width: 60).font(.system(size: 11, design: .monospaced))
                                .fontWeight(changed ? .bold : .regular)
                                .background(isSelected ? Color.accentColor.opacity(0.2) : isCurrent ? Color.yellow.opacity(0.1) : step.isError ? Color.red.opacity(0.1) : Color.clear)
                                .overlay(RoundedRectangle(cornerRadius: 2).stroke(isSelected ? Color.accentColor : Color.clear, lineWidth: 1))
                                .onTapGesture { selectedCell = (step.index, variable); goToStep(step.index); widgetState = .cellSelected }
                        }
                    }
                }
            }

            // Controls
            HStack {
                Button("\u{AB}") { goToStep(activeStep - 1) }.disabled(activeStep <= 0)
                Button(widgetState == .playing ? "\u{23F8}" : "\u{25B6}") {
                    widgetState = widgetState == .playing ? .idle : .playing
                }
                Button("\u{BB}") { goToStep(activeStep + 1) }.disabled(activeStep >= steps.count - 1)
                Text(steps.isEmpty ? "0 / 0" : "\(activeStep + 1) / \(steps.count)").font(.caption)
            }.buttonStyle(.bordered)

            // Detail panel
            if widgetState == .cellSelected, activeStep < steps.count {
                let step = steps[activeStep]
                Divider()
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text("Step \(step.index): \(step.label)").font(.subheadline.bold())
                        if step.isError { Text("(error)").foregroundColor(.red) }
                    }
                    if let ts = step.timestamp { Text(ts).font(.caption).foregroundColor(.secondary) }
                    ForEach(Array(step.state.keys.sorted()), id: \.self) { key in
                        HStack {
                            Text(key).font(.caption).fontWeight(.medium)
                            Text(step.state[key] ?? "").font(.system(size: 12, design: .monospaced))
                                .fontWeight(didChange(activeStep, key) ? .bold : .regular)
                        }
                    }
                }.padding(8)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Trace timeline")
    }
}
