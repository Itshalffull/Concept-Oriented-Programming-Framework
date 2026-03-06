import SwiftUI

enum ExecutionOverlayWidgetState {
    case idle, live, suspended, completed, failed, cancelled, replay
}

enum ExecutionOverlayEvent {
    case start, loadReplay, stepAdvance, complete, fail, suspend, cancel, resume, reset, retry, replayStep, replayEnd
}

func executionOverlayReduce(state: ExecutionOverlayWidgetState, event: ExecutionOverlayEvent) -> ExecutionOverlayWidgetState {
    switch state {
    case .idle:
        if event == .start { return .live }
        if event == .loadReplay { return .replay }
        return state
    case .live:
        if event == .stepAdvance { return .live }
        if event == .complete { return .completed }
        if event == .fail { return .failed }
        if event == .suspend { return .suspended }
        if event == .cancel { return .cancelled }
        return state
    case .suspended:
        if event == .resume { return .live }
        if event == .cancel { return .cancelled }
        return state
    case .completed:
        if event == .reset { return .idle }
        return state
    case .failed:
        if event == .reset { return .idle }
        if event == .retry { return .live }
        return state
    case .cancelled:
        if event == .reset { return .idle }
        return state
    case .replay:
        if event == .replayStep { return .replay }
        if event == .replayEnd { return .idle }
        return state
    }
}

struct ExecutionStep: Identifiable {
    var id: String
    var label: String
    var status: String // "active", "complete", "pending", "failed", "skipped"
}

struct ExecutionOverlayView: View {
    var status: String
    var activeStep: String? = nil
    var startedAt: String? = nil
    var endedAt: String? = nil
    var mode: String = "live" // "live", "replay", "static"
    var showControls: Bool = true
    var showElapsed: Bool = true
    var animateFlow: Bool = true
    var steps: [ExecutionStep] = []
    var errorMessage: String? = nil
    var onSuspend: (() -> Void)? = nil
    var onResume: (() -> Void)? = nil
    var onCancel: (() -> Void)? = nil
    var onRetry: (() -> Void)? = nil

    @State private var widgetState: ExecutionOverlayWidgetState = .idle
    @State private var elapsed: TimeInterval = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    private func statusIcon(_ status: String) -> String {
        switch status {
        case "complete": return "\u{2713}"
        case "active": return "\u{25CF}"
        case "failed": return "\u{2717}"
        case "skipped": return "\u{2014}"
        default: return "\u{25CB}"
        }
    }

    private func statusColor(_ status: String) -> Color {
        switch status {
        case "complete": return .green
        case "active": return .blue
        case "failed": return .red
        case "skipped": return .gray
        default: return .secondary
        }
    }

    private func formatElapsed(_ ms: TimeInterval) -> String {
        let totalSeconds = Int(ms / 1000)
        let hours = totalSeconds / 3600
        let minutes = (totalSeconds % 3600) / 60
        let seconds = totalSeconds % 60
        if hours > 0 {
            return "\(hours)h \(String(format: "%02d", minutes))m \(String(format: "%02d", seconds))s"
        }
        if minutes > 0 {
            return "\(minutes)m \(String(format: "%02d", seconds))s"
        }
        return "\(seconds)s"
    }

    private func syncState() {
        if mode == "replay" && widgetState == .idle {
            widgetState = executionOverlayReduce(state: widgetState, event: .loadReplay)
        }
        if status == "running" && widgetState == .idle {
            widgetState = executionOverlayReduce(state: widgetState, event: .start)
        } else if status == "completed" && widgetState == .live {
            widgetState = executionOverlayReduce(state: widgetState, event: .complete)
        } else if status == "failed" && widgetState == .live {
            widgetState = executionOverlayReduce(state: widgetState, event: .fail)
        } else if status == "suspended" && widgetState == .live {
            widgetState = executionOverlayReduce(state: widgetState, event: .suspend)
        } else if status == "cancelled" && (widgetState == .live || widgetState == .suspended) {
            widgetState = executionOverlayReduce(state: widgetState, event: .cancel)
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Step overlays
            ForEach(steps) { step in
                HStack(spacing: 6) {
                    Text(statusIcon(step.status))
                        .foregroundColor(statusColor(step.status))
                    Text(step.label)
                        .font(.caption)
                    if step.id == activeStep {
                        Circle()
                            .fill(Color.blue)
                            .frame(width: 8, height: 8)
                            .accessibilityLabel("Active step: \(step.id)")
                    }
                }
                .accessibilityHidden(true)
            }

            // Flow animation indicator
            if animateFlow && (widgetState == .live || widgetState == .replay) && !reduceMotion {
                HStack(spacing: 4) {
                    ForEach(0..<3, id: \.self) { i in
                        Circle()
                            .fill(Color.blue.opacity(0.5))
                            .frame(width: 4, height: 4)
                    }
                }
                .accessibilityHidden(true)
            }

            // Status bar
            HStack {
                Text(status)
                    .font(.subheadline)
                    .fontWeight(.medium)

                Spacer()

                if showElapsed {
                    Text(formatElapsed(elapsed))
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .accessibilityLabel("Elapsed time: \(formatElapsed(elapsed))")
                }
            }

            // Controls
            if showControls {
                HStack(spacing: 8) {
                    if widgetState == .live {
                        Button("Suspend") {
                            widgetState = executionOverlayReduce(state: widgetState, event: .suspend)
                            onSuspend?()
                        }
                        .accessibilityLabel("Suspend execution")
                    }

                    if widgetState == .suspended {
                        Button("Resume") {
                            widgetState = executionOverlayReduce(state: widgetState, event: .resume)
                            onResume?()
                        }
                        .accessibilityLabel("Resume execution")
                    }

                    if widgetState == .live || widgetState == .suspended {
                        Button("Cancel") {
                            widgetState = executionOverlayReduce(state: widgetState, event: .cancel)
                            onCancel?()
                        }
                        .accessibilityLabel("Cancel execution")
                    }

                    if widgetState == .failed {
                        Button("Retry") {
                            widgetState = executionOverlayReduce(state: widgetState, event: .retry)
                            onRetry?()
                        }
                        .accessibilityLabel("Retry execution")
                    }
                }
            }

            // Error banner
            if widgetState == .failed {
                Text(errorMessage ?? "Execution failed")
                    .font(.caption)
                    .foregroundColor(.red)
                    .padding(8)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.red.opacity(0.1))
                    .cornerRadius(4)
                    .accessibilityRole(.alert)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Process execution: \(status)")
        .onAppear { syncState() }
        .onChange(of: status) { _ in syncState() }
        .onReceive(timer) { _ in
            guard widgetState == .live, let started = startedAt else { return }
            let formatter = ISO8601DateFormatter()
            if let startDate = formatter.date(from: started) {
                elapsed = Date().timeIntervalSince(startDate) * 1000
            }
        }
    }
}
