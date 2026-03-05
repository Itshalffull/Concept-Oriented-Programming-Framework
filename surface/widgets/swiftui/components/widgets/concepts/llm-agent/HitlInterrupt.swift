import SwiftUI

// MARK: - State Machine

enum HitlInterruptState: String { case pending, editing, approving, rejecting, forking, resolved }
enum HitlInterruptEvent {
    case approve, reject, modify, fork, save, cancel, complete, error
}

func hitlInterruptReduce(state: HitlInterruptState, event: HitlInterruptEvent) -> HitlInterruptState {
    switch state {
    case .pending:
        switch event {
        case .approve: return .approving
        case .reject: return .rejecting
        case .modify: return .editing
        case .fork: return .forking
        default: return state
        }
    case .editing:
        switch event {
        case .save, .cancel: return .pending
        default: return state
        }
    case .approving:
        switch event {
        case .complete: return .resolved
        case .error: return .pending
        default: return state
        }
    case .rejecting:
        if case .complete = event { return .resolved }
        return state
    case .forking:
        if case .complete = event { return .resolved }
        return state
    case .resolved:
        return state
    }
}

// MARK: - Types

enum RiskLevel: String, CaseIterable { case low, medium, high, critical }

private let riskConfig: [RiskLevel: (label: String, icon: String)] = [
    .low: ("Low Risk", "\u{2713}"),
    .medium: ("Medium Risk", "\u{26A0}"),
    .high: ("High Risk", "\u{2622}"),
    .critical: ("Critical Risk", "\u{2716}")
]

// MARK: - View

struct HitlInterruptView: View {
    let action: String
    let reason: String
    let risk: RiskLevel
    var context: String?
    var onApprove: (() -> Void)?
    var onDeny: (() -> Void)?
    var onRequestInfo: (() -> Void)?
    var autoDenySeconds: Int?

    @State private var widgetState: HitlInterruptState = .pending
    @State private var contextExpanded: Bool = false
    @State private var countdown: Int = 0
    @State private var timer: Timer?

    private var isResolved: Bool { widgetState == .resolved }
    private var riskInfo: (label: String, icon: String) { riskConfig[risk] ?? ("Unknown", "?") }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            // Header
            HStack {
                Text("\(riskInfo.icon) \(riskInfo.label)")
                    .font(.system(size: 13, weight: .semibold))
                    .padding(.horizontal, 8).padding(.vertical, 4)
                    .background(riskBackground).cornerRadius(4)
                    .accessibilityLabel(riskInfo.label)

                Spacer()

                if let ads = autoDenySeconds, ads > 0, !isResolved {
                    Text("Auto-deny in \(countdown)s")
                        .font(.caption).foregroundColor(.secondary)
                }

                if isResolved {
                    Text("Resolved").font(.caption).foregroundColor(.green)
                }
            }

            // Action
            HStack(alignment: .top) {
                Text("Action:").fontWeight(.bold)
                Text(action)
            }.font(.system(size: 14))

            // Reason
            HStack(alignment: .top) {
                Text("Reason:").fontWeight(.bold)
                Text(reason)
            }.font(.system(size: 14))

            // Context
            if let ctx = context {
                Button(action: { contextExpanded.toggle() }) {
                    HStack(spacing: 4) {
                        Text(contextExpanded ? "\u{25BC}" : "\u{25B6}").font(.system(size: 10))
                        Text("Additional Context").font(.system(size: 13))
                    }
                }.buttonStyle(.plain)
                .accessibilityLabel(contextExpanded ? "Hide additional context" : "Show additional context")

                if contextExpanded {
                    Text(ctx).font(.system(size: 13)).padding(.leading, 16)
                }
            }

            // Action bar
            HStack(spacing: 12) {
                Button(widgetState == .approving ? "Approving\u{2026}" : "Approve") {
                    guard !isResolved else { return }
                    widgetState = hitlInterruptReduce(state: widgetState, event: .approve)
                    onApprove?()
                }
                .disabled(isResolved)
                .accessibilityLabel("Approve")

                Button(widgetState == .rejecting ? "Denying\u{2026}" : "Deny") {
                    guard !isResolved else { return }
                    widgetState = hitlInterruptReduce(state: widgetState, event: .reject)
                    onDeny?()
                }
                .disabled(isResolved)
                .accessibilityLabel("Deny")

                Button("Ask for more info") {
                    guard !isResolved else { return }
                    onRequestInfo?()
                }
                .disabled(isResolved)
                .accessibilityLabel("Ask for more info")
            }
        }
        .padding()
        .onAppear {
            if let ads = autoDenySeconds, ads > 0 {
                countdown = ads
                startCountdown()
            }
        }
        .onDisappear { timer?.invalidate() }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Agent requires approval")
    }

    private var riskBackground: Color {
        switch risk {
        case .low: return Color.green.opacity(0.15)
        case .medium: return Color.yellow.opacity(0.15)
        case .high: return Color.orange.opacity(0.15)
        case .critical: return Color.red.opacity(0.15)
        }
    }

    private func startCountdown() {
        timer = Timer.scheduledTimer(withTimeInterval: 1, repeats: true) { t in
            if countdown <= 1 {
                t.invalidate()
                countdown = 0
                if !isResolved {
                    widgetState = hitlInterruptReduce(state: widgetState, event: .reject)
                    onDeny?()
                }
            } else {
                countdown -= 1
            }
        }
    }
}
