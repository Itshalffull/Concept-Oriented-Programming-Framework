import SwiftUI

// State machine: idle | focused | navigating (no hover on watch)
enum ProposalCardWatchState {
    case idle
    case focused
    case navigating
}

enum ProposalCardWatchEvent {
    case tap
    case focus
    case blur
    case navigateComplete
}

func proposalCardWatchReduce(_ state: ProposalCardWatchState, _ event: ProposalCardWatchEvent) -> ProposalCardWatchState {
    switch state {
    case .idle:
        switch event {
        case .focus: return .focused
        case .tap: return .navigating
        default: return state
        }
    case .focused:
        switch event {
        case .blur: return .idle
        case .tap: return .navigating
        default: return state
        }
    case .navigating:
        if case .navigateComplete = event { return .idle }
        return state
    }
}

struct ProposalCardWatchView: View {
    let title: String
    let description: String
    let author: String
    let status: String
    let timestamp: String
    var onClick: (() -> Void)? = nil

    @State private var state: ProposalCardWatchState = .idle

    private var statusColor: Color {
        switch status {
        case "Active": return .blue
        case "Passed", "Approved": return .green
        case "Rejected": return .red
        case "Draft": return .secondary
        case "Executed": return .purple
        case "Cancelled": return .orange
        default: return .primary
        }
    }

    private var actionLabel: String {
        switch status {
        case "Active": return "Vote"
        case "Passed", "Approved": return "Execute"
        case "Draft": return "Edit"
        default: return "View"
        }
    }

    var body: some View {
        Button {
            state = proposalCardWatchReduce(state, .tap)
            onClick?()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.1) {
                state = proposalCardWatchReduce(state, .navigateComplete)
            }
        } label: {
            VStack(alignment: .leading, spacing: 3) {
                // Status badge
                Text(status)
                    .font(.system(size: 8))
                    .fontWeight(.semibold)
                    .padding(.horizontal, 4)
                    .padding(.vertical, 1)
                    .background(statusColor.opacity(0.2))
                    .foregroundColor(statusColor)
                    .cornerRadius(3)

                // Title
                Text(title)
                    .font(.caption2)
                    .fontWeight(.semibold)
                    .lineLimit(2)

                // Description
                Text(description)
                    .font(.system(size: 9))
                    .foregroundColor(.secondary)
                    .lineLimit(2)

                // Author and time
                HStack {
                    Text(author)
                        .font(.system(size: 8))
                        .foregroundColor(.secondary)
                    Spacer()
                    Text(actionLabel)
                        .font(.system(size: 8))
                        .fontWeight(.semibold)
                        .foregroundColor(.blue)
                }
            }
            .padding(.vertical, 4)
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(status) proposal: \(title) by \(author)")
    }
}
