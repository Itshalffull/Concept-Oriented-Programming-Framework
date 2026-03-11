import SwiftUI

enum ApprovalStepperWidgetState {
    case viewing, stepFocused, acting
}

enum ApprovalStepperEvent {
    case focusStep, startAction, blur, complete, cancel
}

func approvalStepperReduce(state: ApprovalStepperWidgetState, event: ApprovalStepperEvent) -> ApprovalStepperWidgetState {
    switch state {
    case .viewing:
        if event == .focusStep { return .stepFocused }
        if event == .startAction { return .acting }
        return state
    case .stepFocused:
        if event == .blur { return .viewing }
        if event == .startAction { return .acting }
        return state
    case .acting:
        if event == .complete { return .viewing }
        if event == .cancel { return .viewing }
        return state
    }
}

struct ApprovalStep: Identifiable {
    var id: String
    var label: String
    var approver: String? = nil
    var status: String // "pending", "approved", "rejected", "skipped", "active"
    var timestamp: String? = nil
    var quorumRequired: Int? = nil
    var quorumCurrent: Int? = nil
}

struct ApprovalStepperView: View {
    var steps: [ApprovalStep]
    var currentStep: String
    var status: String
    var assignee: String? = nil
    var dueAt: String? = nil
    var variant: String = "sequential"
    var orientation: String = "horizontal"
    var showSLA: Bool = true
    var showAssignee: Bool = true
    var onApprove: ((String) -> Void)? = nil
    var onReject: ((String) -> Void)? = nil
    var onDelegate: ((String) -> Void)? = nil
    var onClaim: ((String) -> Void)? = nil

    @State private var widgetState: ApprovalStepperWidgetState = .viewing
    @State private var focusedStepId: String? = nil
    @State private var actingStepId: String? = nil

    private func stepStatusIcon(_ status: String) -> String {
        switch status {
        case "approved": return "\u{2713}"
        case "rejected": return "\u{2717}"
        case "skipped": return "\u{2014}"
        case "active": return "\u{25CF}"
        default: return "\u{25CB}"
        }
    }

    private func stepStatusColor(_ status: String) -> Color {
        switch status {
        case "approved": return .green
        case "rejected": return .red
        case "active": return .blue
        case "skipped": return .gray
        default: return .secondary
        }
    }

    private func connectorColor(_ prevStatus: String) -> Color {
        switch prevStatus {
        case "approved": return .green
        case "rejected": return .red
        case "active": return .blue
        default: return .gray.opacity(0.3)
        }
    }

    private func formatTimeRemaining(_ dueAt: String) -> String {
        let formatter = ISO8601DateFormatter()
        guard let dueDate = formatter.date(from: dueAt) else { return dueAt }
        let diff = dueDate.timeIntervalSince(Date())
        if diff <= 0 { return "Overdue" }
        let hours = Int(diff) / 3600
        let minutes = (Int(diff) % 3600) / 60
        if hours > 24 {
            let days = hours / 24
            return "\(days)d \(hours % 24)h"
        }
        if hours > 0 { return "\(hours)h \(minutes)m" }
        return "\(minutes)m"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Step list
            let isHorizontal = orientation == "horizontal"
            let layout = isHorizontal ? AnyLayout(HStackLayout(alignment: .top, spacing: 0)) : AnyLayout(VStackLayout(alignment: .leading, spacing: 0))

            layout {
                ForEach(Array(steps.enumerated()), id: \.element.id) { index, step in
                    let isCurrent = step.id == currentStep
                    let isActing = actingStepId == step.id && widgetState == .acting
                    let showConnector = index < steps.count - 1

                    VStack(alignment: .leading, spacing: 4) {
                        HStack(spacing: 6) {
                            // Step indicator
                            ZStack {
                                Circle()
                                    .fill(stepStatusColor(step.status).opacity(0.2))
                                    .frame(width: 28, height: 28)
                                if step.status == "pending" || step.status == "active" {
                                    Text("\(index + 1)")
                                        .font(.caption)
                                        .fontWeight(.bold)
                                } else {
                                    Text(stepStatusIcon(step.status))
                                        .font(.caption)
                                }
                            }
                            .foregroundColor(stepStatusColor(step.status))
                            .accessibilityHidden(true)

                            VStack(alignment: .leading, spacing: 2) {
                                Text(step.label)
                                    .font(.subheadline)
                                    .fontWeight(isCurrent ? .bold : .regular)

                                if showAssignee, let approver = step.approver {
                                    Text(approver)
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }

                                Text(step.status)
                                    .font(.caption2)
                                    .foregroundColor(stepStatusColor(step.status))

                                // Quorum display
                                if variant != "sequential", let required = step.quorumRequired {
                                    Text("\(step.quorumCurrent ?? 0)/\(required)")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                        .accessibilityLabel("\(step.quorumCurrent ?? 0) of \(required) approvals")
                                }

                                if let ts = step.timestamp {
                                    Text(ts)
                                        .font(.caption2)
                                        .foregroundColor(.secondary)
                                }
                            }
                        }
                        .contentShape(Rectangle())
                        .onTapGesture {
                            focusedStepId = step.id
                            widgetState = approvalStepperReduce(state: widgetState, event: .focusStep)
                        }
                        .accessibilityLabel("Step \(index + 1): \(step.label) \u{2014} \(step.status)")
                        .accessibilityValue(isCurrent ? "current step" : "")

                        // Action bar
                        if isActing {
                            HStack(spacing: 8) {
                                Button("Approve") {
                                    onApprove?(step.id)
                                    widgetState = approvalStepperReduce(state: widgetState, event: .complete)
                                    actingStepId = nil
                                }
                                .accessibilityLabel("Approve step: \(step.label)")

                                Button("Reject") {
                                    onReject?(step.id)
                                    widgetState = approvalStepperReduce(state: widgetState, event: .complete)
                                    actingStepId = nil
                                }
                                .foregroundColor(.red)
                                .accessibilityLabel("Reject step: \(step.label)")

                                Button("Delegate") {
                                    onDelegate?(step.id)
                                    widgetState = approvalStepperReduce(state: widgetState, event: .complete)
                                    actingStepId = nil
                                }
                                .accessibilityLabel("Delegate step: \(step.label)")

                                Button("Cancel") {
                                    widgetState = approvalStepperReduce(state: widgetState, event: .cancel)
                                    actingStepId = nil
                                }
                                .foregroundColor(.secondary)
                                .accessibilityLabel("Cancel")
                            }
                            .font(.caption)
                        }

                        // Connector
                        if showConnector {
                            if isHorizontal {
                                Rectangle()
                                    .fill(connectorColor(step.status))
                                    .frame(width: 24, height: 2)
                                    .padding(.leading, 14)
                            } else {
                                Rectangle()
                                    .fill(connectorColor(step.status))
                                    .frame(width: 2, height: 16)
                                    .padding(.leading, 14)
                            }
                        }
                    }
                }
            }

            // SLA indicator
            if showSLA, let due = dueAt {
                let remaining = formatTimeRemaining(due)
                let isOverdue = remaining == "Overdue"
                HStack(spacing: 4) {
                    Text("SLA:")
                        .font(.caption)
                        .fontWeight(.semibold)
                    Text(remaining)
                        .font(.caption)
                        .foregroundColor(isOverdue ? .red : .secondary)
                }
                .accessibilityLabel("Time remaining: \(remaining)")
                .accessibilityRole(.timer)
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Approval steps")
    }
}
