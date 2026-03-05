import SwiftUI

// State machine: onTrack | warning | critical | breached | paused
enum SlaTimerWatchState {
    case onTrack
    case warning
    case critical
    case breached
    case paused
}

enum SlaTimerWatchEvent {
    case tick
    case warn
    case critical
    case breach
    case pause
    case resume
    case reset
}

func slaTimerWatchReduce(_ state: SlaTimerWatchState, _ event: SlaTimerWatchEvent) -> SlaTimerWatchState {
    switch state {
    case .onTrack:
        switch event {
        case .warn: return .warning
        case .critical: return .critical
        case .breach: return .breached
        case .pause: return .paused
        case .tick: return .onTrack
        default: return state
        }
    case .warning:
        switch event {
        case .critical: return .critical
        case .breach: return .breached
        case .pause: return .paused
        case .tick: return .warning
        default: return state
        }
    case .critical:
        switch event {
        case .breach: return .breached
        case .pause: return .paused
        case .tick: return .critical
        default: return state
        }
    case .breached:
        if case .reset = event { return .onTrack }
        return state
    case .paused:
        switch event {
        case .resume: return .onTrack
        case .reset: return .onTrack
        default: return state
        }
    }
}

struct SlaTimerWatchView: View {
    let label: String
    var remainingSeconds: Int = 0
    var totalSeconds: Int = 0
    var status: SlaTimerWatchState = .onTrack
    var onPause: (() -> Void)? = nil
    var onResume: (() -> Void)? = nil

    @State private var state: SlaTimerWatchState = .onTrack

    private var statusColor: Color {
        switch state {
        case .onTrack: return .green
        case .warning: return .yellow
        case .critical: return .orange
        case .breached: return .red
        case .paused: return .secondary
        }
    }

    private var statusText: String {
        switch state {
        case .onTrack: return "On Track"
        case .warning: return "Warning"
        case .critical: return "Critical"
        case .breached: return "Breached"
        case .paused: return "Paused"
        }
    }

    private var progress: Double {
        guard totalSeconds > 0 else { return 0 }
        return Double(totalSeconds - remainingSeconds) / Double(totalSeconds)
    }

    private var formattedTime: String {
        let absSeconds = abs(remainingSeconds)
        let hours = absSeconds / 3600
        let minutes = (absSeconds % 3600) / 60
        let seconds = absSeconds % 60
        let prefix = remainingSeconds < 0 ? "-" : ""
        if hours > 0 {
            return "\(prefix)\(hours)h \(String(format: "%02d", minutes))m"
        }
        return "\(prefix)\(minutes)m \(String(format: "%02d", seconds))s"
    }

    var body: some View {
        VStack(spacing: 6) {
            // Label
            Text(label)
                .font(.caption2)
                .fontWeight(.semibold)

            // Gauge
            Gauge(value: min(progress, 1.0)) {
                EmptyView()
            } currentValueLabel: {
                Text(formattedTime)
                    .font(.system(size: 12, weight: .bold, design: .monospaced))
                    .foregroundColor(statusColor)
            }
            .gaugeStyle(.accessoryCircular)
            .tint(statusColor)

            // Status badge
            HStack(spacing: 3) {
                Circle()
                    .fill(statusColor)
                    .frame(width: 5, height: 5)
                Text(statusText)
                    .font(.system(size: 8, weight: .semibold))
                    .foregroundColor(statusColor)
            }

            // Controls
            if state == .paused, let onResume = onResume {
                Button {
                    onResume()
                    state = slaTimerWatchReduce(state, .resume)
                } label: {
                    HStack(spacing: 2) {
                        Image(systemName: "play.fill")
                            .font(.system(size: 8))
                        Text("Resume")
                            .font(.caption2)
                    }
                }
                .buttonStyle(.bordered)
            } else if state != .breached && state != .paused, let onPause = onPause {
                Button {
                    onPause()
                    state = slaTimerWatchReduce(state, .pause)
                } label: {
                    HStack(spacing: 2) {
                        Image(systemName: "pause.fill")
                            .font(.system(size: 8))
                        Text("Pause")
                            .font(.caption2)
                    }
                }
                .buttonStyle(.plain)
                .foregroundColor(.secondary)
            }
        }
        .onAppear {
            state = status
        }
        .onChange(of: status) { _, newValue in
            state = newValue
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("SLA timer: \(label)")
        .accessibilityValue("\(formattedTime) remaining, \(statusText)")
    }
}
