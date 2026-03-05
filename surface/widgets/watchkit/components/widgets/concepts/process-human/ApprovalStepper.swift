import SwiftUI

// State machine: viewing | stepSelected
enum ApprovalStepperWatchState {
    case viewing
    case stepSelected
}

enum ApprovalStepperWatchEvent {
    case selectStep
    case deselect
}

func approvalStepperWatchReduce(_ state: ApprovalStepperWatchState, _ event: ApprovalStepperWatchEvent) -> ApprovalStepperWatchState {
    switch state {
    case .viewing:
        if case .selectStep = event { return .stepSelected }
        return state
    case .stepSelected:
        if case .deselect = event { return .viewing }
        if case .selectStep = event { return .stepSelected }
        return state
    }
}

struct ApprovalStepData: Identifiable {
    let id: String
    let label: String
    let status: String // "pending", "approved", "rejected", "skipped", "active"
    var approver: String? = nil
    var timestamp: String? = nil
    var comment: String? = nil
}

struct ApprovalStepperWatchView: View {
    let steps: [ApprovalStepData]
    var title: String = "Approval Flow"
    var onApprove: ((String) -> Void)? = nil
    var onReject: ((String) -> Void)? = nil

    @State private var state: ApprovalStepperWatchState = .viewing
    @State private var selectedId: String? = nil

    private var completedCount: Int {
        steps.filter { $0.status == "approved" || $0.status == "rejected" || $0.status == "skipped" }.count
    }

    private func stepIcon(_ status: String) -> String {
        switch status {
        case "approved": return "checkmark.circle.fill"
        case "rejected": return "xmark.circle.fill"
        case "active": return "person.circle"
        case "skipped": return "forward.fill"
        case "pending": return "circle"
        default: return "circle"
        }
    }

    private func stepColor(_ status: String) -> Color {
        switch status {
        case "approved": return .green
        case "rejected": return .red
        case "active": return .blue
        case "skipped": return .secondary
        case "pending": return .secondary
        default: return .secondary
        }
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 6) {
                // Header with progress
                HStack {
                    Text(title)
                        .font(.caption2)
                        .fontWeight(.bold)
                    Spacer()
                    Text("\(completedCount)/\(steps.count)")
                        .font(.system(size: 8))
                        .foregroundColor(.secondary)
                }

                // Progress bar
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 2)
                            .fill(Color.secondary.opacity(0.2))
                            .frame(height: 3)
                        RoundedRectangle(cornerRadius: 2)
                            .fill(Color.green)
                            .frame(
                                width: steps.isEmpty ? 0 : geometry.size.width * CGFloat(completedCount) / CGFloat(steps.count),
                                height: 3
                            )
                    }
                }
                .frame(height: 3)

                // Steps
                ForEach(steps) { step in
                    Button {
                        if selectedId == step.id {
                            selectedId = nil
                            state = approvalStepperWatchReduce(state, .deselect)
                        } else {
                            selectedId = step.id
                            state = approvalStepperWatchReduce(state, .selectStep)
                        }
                    } label: {
                        HStack(spacing: 4) {
                            // Step icon
                            Image(systemName: stepIcon(step.status))
                                .font(.system(size: 9))
                                .foregroundColor(stepColor(step.status))

                            // Label
                            VStack(alignment: .leading, spacing: 1) {
                                Text(step.label)
                                    .font(.system(size: 9))
                                    .foregroundColor(step.status == "pending" ? .secondary : .primary)
                                if let approver = step.approver {
                                    Text(approver)
                                        .font(.system(size: 7))
                                        .foregroundColor(.secondary)
                                }
                            }

                            Spacer()

                            // Status text
                            Text(step.status.capitalized)
                                .font(.system(size: 7))
                                .foregroundColor(stepColor(step.status))
                        }
                        .padding(3)
                        .background(selectedId == step.id ? Color.blue.opacity(0.1) : Color.clear)
                        .cornerRadius(3)
                    }
                    .buttonStyle(.plain)

                    // Selected detail with actions
                    if selectedId == step.id {
                        VStack(alignment: .leading, spacing: 3) {
                            if let timestamp = step.timestamp {
                                Text(timestamp)
                                    .font(.system(size: 7))
                                    .foregroundColor(.secondary)
                            }
                            if let comment = step.comment {
                                Text(comment)
                                    .font(.system(size: 8))
                                    .foregroundColor(.secondary)
                                    .lineLimit(3)
                            }

                            // Action buttons for active step
                            if step.status == "active" {
                                HStack(spacing: 8) {
                                    if let onApprove = onApprove {
                                        Button {
                                            onApprove(step.id)
                                        } label: {
                                            HStack(spacing: 2) {
                                                Image(systemName: "checkmark")
                                                    .font(.system(size: 8))
                                                Text("Approve")
                                                    .font(.caption2)
                                            }
                                        }
                                        .buttonStyle(.borderedProminent)
                                        .tint(.green)
                                    }

                                    if let onReject = onReject {
                                        Button {
                                            onReject(step.id)
                                        } label: {
                                            HStack(spacing: 2) {
                                                Image(systemName: "xmark")
                                                    .font(.system(size: 8))
                                                Text("Reject")
                                                    .font(.caption2)
                                            }
                                        }
                                        .buttonStyle(.bordered)
                                        .tint(.red)
                                    }
                                }
                            }
                        }
                        .padding(4)
                        .padding(.leading, 12)
                        .background(Color.secondary.opacity(0.05))
                        .cornerRadius(3)
                    }
                }
            }
            .padding(.horizontal, 2)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Approval stepper, \(completedCount) of \(steps.count) complete")
    }
}
