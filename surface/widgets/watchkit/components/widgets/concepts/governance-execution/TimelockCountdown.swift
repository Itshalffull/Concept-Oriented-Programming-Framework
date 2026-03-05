import SwiftUI

// State machine: running | warning | critical | expired | executing | completed | paused
enum TimelockCountdownWatchState {
    case running, warning, critical, expired, executing, completed, paused
}

enum TimelockCountdownWatchEvent {
    case tick, warningThreshold, criticalThreshold, expire, execute, reset, executeComplete, executeError, pause, resume
}

func timelockCountdownWatchReduce(_ state: TimelockCountdownWatchState, _ event: TimelockCountdownWatchEvent) -> TimelockCountdownWatchState {
    switch state {
    case .running:
        switch event {
        case .warningThreshold: return .warning
        case .expire: return .expired
        case .pause: return .paused
        default: return state
        }
    case .warning:
        switch event {
        case .criticalThreshold: return .critical
        case .expire: return .expired
        default: return state
        }
    case .critical:
        if case .expire = event { return .expired }
        return state
    case .expired:
        switch event {
        case .execute: return .executing
        case .reset: return .running
        default: return state
        }
    case .executing:
        switch event {
        case .executeComplete: return .completed
        case .executeError: return .expired
        default: return state
        }
    case .completed:
        return state
    case .paused:
        if case .resume = event { return .running }
        return state
    }
}

struct TimelockCountdownWatchView: View {
    let phase: String
    let deadline: Date
    let elapsed: Double
    let total: Double
    var showChallenge: Bool = true
    var warningThreshold: Double = 0.8
    var criticalThreshold: Double = 0.95
    var onExecute: (() -> Void)? = nil
    var onChallenge: (() -> Void)? = nil

    @State private var state: TimelockCountdownWatchState = .running
    @State private var timeRemaining: TimeInterval = 0

    private var progress: Double {
        total > 0 ? min(1, max(0, elapsed / total)) : 0
    }

    private var displayPhase: String {
        switch state {
        case .expired: return "Ready to execute"
        case .executing: return "Executing..."
        case .completed: return "Complete"
        case .paused: return "\(phase) (paused)"
        default: return phase
        }
    }

    private var urgencyColor: Color {
        switch state {
        case .running: return .blue
        case .warning: return .yellow
        case .critical, .expired: return .red
        case .executing: return .orange
        case .completed: return .green
        case .paused: return .secondary
        }
    }

    private var countdownText: String {
        if timeRemaining <= 0 { return "0s" }
        let total = Int(timeRemaining)
        let d = total / 86400
        let h = (total % 86400) / 3600
        let m = (total % 3600) / 60
        let s = total % 60
        var parts: [String] = []
        if d > 0 { parts.append("\(d)d") }
        if h > 0 { parts.append("\(h)h") }
        if m > 0 { parts.append("\(m)m") }
        parts.append("\(s)s")
        return parts.joined(separator: " ")
    }

    var body: some View {
        VStack(spacing: 6) {
            // Phase label
            Text(displayPhase)
                .font(.caption2)
                .fontWeight(.semibold)

            // Countdown - prominent on watch
            Text(state == .completed ? "Done" : countdownText)
                .font(.system(size: 20, weight: .bold, design: .monospaced))
                .foregroundColor(urgencyColor)

            // Progress gauge
            Gauge(value: progress) {
                EmptyView()
            }
            .gaugeStyle(.linearCapacity)
            .tint(urgencyColor)

            // Execute button
            if state == .expired {
                Button("Execute") {
                    state = timelockCountdownWatchReduce(state, .execute)
                    onExecute?()
                }
                .font(.caption2)
                .buttonStyle(.borderedProminent)
            }

            // Challenge button
            if showChallenge && state != .expired && state != .completed && state != .executing {
                Button("Challenge") {
                    onChallenge?()
                }
                .font(.caption2)
                .buttonStyle(.bordered)
            }
        }
        .onAppear { updateTimeRemaining() }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(displayPhase): \(countdownText)")
    }

    private func updateTimeRemaining() {
        timeRemaining = max(0, deadline.timeIntervalSinceNow)
        if timeRemaining <= 0 && state != .expired && state != .executing && state != .completed {
            state = timelockCountdownWatchReduce(state, .expire)
        }
    }
}
