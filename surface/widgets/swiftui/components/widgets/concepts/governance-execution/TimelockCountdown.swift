import SwiftUI

enum TimelockCountdownWidgetState: String {
    case running, warning, critical, expired, executing, completed, paused
}

struct TimelockCountdownView: View {
    let phase: String
    let deadline: String
    let elapsed: Double
    let total: Double
    var showChallenge: Bool = true
    var warningThreshold: Double = 0.8
    var criticalThreshold: Double = 0.95
    var variant: String = "phase-based"
    var onExecute: (() -> Void)?
    var onChallenge: (() -> Void)?

    @State private var widgetState: TimelockCountdownWidgetState = .running
    @State private var remainingSeconds: Int = 0
    @State private var timer: Timer?

    private var progress: Double { total > 0 ? min(1, max(0, elapsed / total)) : 0 }
    private var progressPercent: Int { Int(progress * 100) }

    private var displayPhase: String {
        switch widgetState {
        case .expired: return "Ready to execute"
        case .executing: return "Executing..."
        case .completed: return "Execution complete"
        case .paused: return "\(phase) (paused)"
        default: return phase
        }
    }

    private var countdownText: String {
        if remainingSeconds <= 0 { return "0s" }
        let d = remainingSeconds / 86400, h = (remainingSeconds % 86400) / 3600
        let m = (remainingSeconds % 3600) / 60, s = remainingSeconds % 60
        var parts: [String] = []
        if d > 0 { parts.append("\(d)d") }; if h > 0 { parts.append("\(h)h") }
        if m > 0 { parts.append("\(m)m") }; parts.append("\(s)s")
        return parts.joined(separator: " ")
    }

    private var urgencyColor: Color {
        switch widgetState {
        case .critical: return .red; case .warning: return .orange
        case .expired: return .purple; default: return .primary
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(displayPhase).font(.subheadline).fontWeight(.medium)
            Text(widgetState == .completed ? "Done" : countdownText)
                .font(.title2.monospacedDigit()).foregroundColor(urgencyColor)
            ProgressView(value: progress).tint(urgencyColor)
                .accessibilityLabel("Timelock progress: \(progressPercent)%")

            HStack {
                Button(widgetState == .executing ? "Executing..." : "Execute") { widgetState = .executing; onExecute?() }
                    .buttonStyle(.borderedProminent).disabled(widgetState != .expired)
                if showChallenge {
                    Button("Challenge") { onChallenge?() }
                        .buttonStyle(.bordered)
                        .disabled(widgetState == .expired || widgetState == .completed || widgetState == .executing)
                }
            }
        }
        .task { startTimer() }
        .onDisappear { timer?.invalidate() }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("\(displayPhase): \(countdownText)")
    }

    private func startTimer() {
        updateRemaining()
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { _ in
            updateRemaining()
            if remainingSeconds <= 0 { widgetState = .expired; timer?.invalidate() }
            else if progress >= criticalThreshold { widgetState = .critical }
            else if progress >= warningThreshold { widgetState = .warning }
        }
    }

    private func updateRemaining() {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        if let date = formatter.date(from: deadline) ?? ISO8601DateFormatter().date(from: deadline) {
            remainingSeconds = max(0, Int(date.timeIntervalSinceNow))
        }
    }
}
