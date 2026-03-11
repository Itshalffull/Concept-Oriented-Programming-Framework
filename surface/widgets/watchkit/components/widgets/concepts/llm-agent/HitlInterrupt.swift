import SwiftUI

// State machine: pending | approving | rejecting | resolved (simplified for watch)
enum HitlInterruptWatchState {
    case pending
    case approving
    case rejecting
    case resolved
}

enum HitlInterruptWatchEvent {
    case approve
    case reject
    case confirm
    case cancel
    case resolve
}

func hitlInterruptWatchReduce(_ state: HitlInterruptWatchState, _ event: HitlInterruptWatchEvent) -> HitlInterruptWatchState {
    switch state {
    case .pending:
        switch event {
        case .approve: return .approving
        case .reject: return .rejecting
        default: return state
        }
    case .approving:
        switch event {
        case .confirm: return .resolved
        case .cancel: return .pending
        default: return state
        }
    case .rejecting:
        switch event {
        case .confirm: return .resolved
        case .cancel: return .pending
        default: return state
        }
    case .resolved:
        return state
    }
}

struct HitlInterruptWatchView: View {
    let title: String
    let description: String
    let action: String
    var context: String? = nil
    var onApprove: (() -> Void)? = nil
    var onReject: (() -> Void)? = nil

    @State private var state: HitlInterruptWatchState = .pending

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 6) {
                // Status indicator
                HStack(spacing: 4) {
                    Image(systemName: state == .resolved ? "checkmark.circle.fill" : "exclamationmark.circle.fill")
                        .foregroundColor(state == .resolved ? .green : .orange)
                        .font(.caption)
                    Text(state == .resolved ? "Resolved" : "Action Required")
                        .font(.caption2).fontWeight(.bold)
                }

                Text(title)
                    .font(.caption2)
                    .fontWeight(.semibold)

                Text(description)
                    .font(.system(size: 9))
                    .foregroundColor(.secondary)

                if let context = context {
                    Text(context)
                        .font(.system(size: 8))
                        .foregroundColor(.secondary)
                        .padding(4)
                        .background(Color.secondary.opacity(0.1))
                        .cornerRadius(4)
                }

                Text("Action: \(action)")
                    .font(.system(size: 9))
                    .fontWeight(.semibold)

                if state == .pending {
                    HStack(spacing: 8) {
                        Button {
                            state = hitlInterruptWatchReduce(state, .approve)
                            onApprove?()
                            state = hitlInterruptWatchReduce(state, .confirm)
                        } label: {
                            Label("Approve", systemImage: "checkmark")
                                .font(.caption2)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(.green)

                        Button {
                            state = hitlInterruptWatchReduce(state, .reject)
                            onReject?()
                            state = hitlInterruptWatchReduce(state, .confirm)
                        } label: {
                            Label("Reject", systemImage: "xmark")
                                .font(.caption2)
                        }
                        .buttonStyle(.bordered)
                        .tint(.red)
                    }
                } else if state == .resolved {
                    Text("Decision recorded")
                        .font(.system(size: 9))
                        .foregroundColor(.green)
                }
            }
            .padding(.horizontal, 4)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Human-in-the-loop interrupt: \(title)")
    }
}
