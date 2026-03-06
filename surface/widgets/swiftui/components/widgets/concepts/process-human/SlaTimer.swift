import SwiftUI

enum SlaTimerWidgetState: String {
    case onTrack, warning, critical, breached, paused
}

enum SlaTimerEvent {
    case tick, warningThreshold, pause, criticalThreshold, breach, resume
}

func slaTimerReduce(state: SlaTimerWidgetState, event: SlaTimerEvent) -> SlaTimerWidgetState {
    switch state {
    case .onTrack:
        if event == .warningThreshold { return .warning }
        if event == .pause { return .paused }
        return state
    case .warning:
        if event == .criticalThreshold { return .critical }
        if event == .pause { return .paused }
        return state
    case .critical:
        if event == .breach { return .breached }
        if event == .pause { return .paused }
        return state
    case .breached:
        return state
    case .paused:
        if event == .resume { return .onTrack }
        return state
    }
}

struct SlaTimerView: View {
    var dueAt: String
    var status: String
    var warningThreshold: Double = 0.7
    var criticalThreshold: Double = 0.9
    var showElapsed: Bool = true
    var startedAt: String? = nil
    var onBreach: (() -> Void)? = nil
    var onWarning: (() -> Void)? = nil
    var onCritical: (() -> Void)? = nil

    @State private var widgetState: SlaTimerWidgetState = .onTrack
    @State private var remaining: TimeInterval = 0
    @State private var elapsed: TimeInterval = 0
    @State private var progress: Double = 0
    @State private var breachedFired: Bool = false
    @State private var warningFired: Bool = false
    @State private var criticalFired: Bool = false

    private let timer = Timer.publish(every: 1, on: .main, in: .common).autoconnect()

    private let phaseLabels: [SlaTimerWidgetState: String] = [
        .onTrack: "On Track",
        .warning: "Warning",
        .critical: "Critical",
        .breached: "Breached",
        .paused: "Paused"
    ]

    private var phaseColor: Color {
        switch widgetState {
        case .onTrack: return .green
        case .warning: return .orange
        case .critical: return .red
        case .breached: return .red
        case .paused: return .gray
        }
    }

    private func formatCountdown(_ ms: TimeInterval) -> String {
        guard ms > 0 else { return "00:00:00" }
        let totalSeconds = Int(ms / 1000)
        let hours = totalSeconds / 3600
        let minutes = (totalSeconds % 3600) / 60
        let seconds = totalSeconds % 60
        return String(format: "%02d:%02d:%02d", hours, minutes, seconds)
    }

    private func formatElapsedTime(_ ms: TimeInterval) -> String {
        guard ms > 0 else { return "0s" }
        let totalSeconds = Int(ms / 1000)
        let hours = totalSeconds / 3600
        let minutes = (totalSeconds % 3600) / 60
        let seconds = totalSeconds % 60
        if hours > 0 { return "\(hours)h \(minutes)m \(seconds)s" }
        if minutes > 0 { return "\(minutes)m \(seconds)s" }
        return "\(seconds)s"
    }

    private var dueTime: Date {
        ISO8601DateFormatter().date(from: dueAt) ?? Date()
    }

    private var startTime: Date {
        if let started = startedAt {
            return ISO8601DateFormatter().date(from: started) ?? Date()
        }
        return Date()
    }

    private var totalDuration: TimeInterval {
        dueTime.timeIntervalSince(startTime) * 1000
    }

    private func tick() {
        let now = Date()
        let rem = max(0, dueTime.timeIntervalSince(now) * 1000)
        let elap = now.timeIntervalSince(startTime) * 1000
        let prog = totalDuration > 0 ? min(1, elap / totalDuration) : 1

        remaining = rem
        elapsed = elap
        progress = prog

        if rem <= 0 && !breachedFired {
            breachedFired = true
            widgetState = slaTimerReduce(state: widgetState, event: .breach)
            onBreach?()
        } else if prog >= criticalThreshold && !criticalFired && rem > 0 {
            criticalFired = true
            widgetState = slaTimerReduce(state: widgetState, event: .criticalThreshold)
            onCritical?()
        } else if prog >= warningThreshold && !warningFired && rem > 0 {
            warningFired = true
            widgetState = slaTimerReduce(state: widgetState, event: .warningThreshold)
            onWarning?()
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Countdown display
            Text(widgetState == .breached ? "BREACHED" : formatCountdown(remaining))
                .font(.system(.title, design: .monospaced))
                .fontWeight(.bold)
                .foregroundColor(phaseColor)
                .accessibilityLabel("Time remaining: \(formatCountdown(remaining))")

            // Phase label
            Text(phaseLabels[widgetState] ?? "")
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundColor(phaseColor)

            // Progress bar
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: 4)
                        .fill(Color.gray.opacity(0.2))
                        .frame(height: 8)
                    RoundedRectangle(cornerRadius: 4)
                        .fill(phaseColor)
                        .frame(width: geo.size.width * CGFloat(progress), height: 8)
                        .animation(.easeInOut(duration: 0.3), value: progress)
                }
            }
            .frame(height: 8)
            .accessibilityLabel("SLA progress: \(Int(progress * 100))%")
            .accessibilityValue("\(Int(progress * 100)) percent")

            // Elapsed time
            if showElapsed {
                Text("Elapsed: \(formatElapsedTime(elapsed))")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .accessibilityLabel("Elapsed time: \(formatElapsedTime(elapsed))")
            }

            // Pause/Resume
            if widgetState != .breached {
                Button(widgetState == .paused ? "Resume" : "Pause") {
                    if widgetState == .paused {
                        widgetState = slaTimerReduce(state: widgetState, event: .resume)
                    } else {
                        widgetState = slaTimerReduce(state: widgetState, event: .pause)
                    }
                }
                .accessibilityLabel(widgetState == .paused ? "Resume timer" : "Pause timer")
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("SLA timer: \(phaseLabels[widgetState] ?? "")")
        .accessibilityRole(.timer)
        .onAppear { tick() }
        .onReceive(timer) { _ in
            guard widgetState != .paused else { return }
            tick()
        }
    }
}
