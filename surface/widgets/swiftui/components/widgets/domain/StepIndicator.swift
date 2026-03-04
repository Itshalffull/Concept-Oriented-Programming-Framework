// ============================================================
// Clef Surface SwiftUI Widget — StepIndicator
//
// Stepper and wizard progress indicator rendered as a row or
// column of numbered step circles connected by lines. Completed
// steps show a checkmark color, the current step uses primary
// color, and pending steps appear dimmed.
// ============================================================

import SwiftUI

struct StepDef: Identifiable {
    var id: String { label }
    let label: String
    var status: String = "pending" // "completed", "current", "pending"
}

private func statusColor(_ status: String) -> Color {
    switch status {
    case "completed": return .green
    case "current": return Color(red: 0.38, green: 0, blue: 0.93)
    default: return Color(.systemGray3)
    }
}

struct StepIndicatorView: View {
    var steps: [StepDef]
    var currentStep: Int? = nil
    var orientation: String = "horizontal"

    private var resolvedSteps: [StepDef] {
        steps.enumerated().map { index, step in
            if let current = currentStep {
                var resolved = step
                if index < current { resolved.status = "completed" }
                else if index == current { resolved.status = "current" }
                else { resolved.status = "pending" }
                return resolved
            }
            return step
        }
    }

    var body: some View {
        if orientation == "vertical" {
            VStack(alignment: .leading, spacing: 0) {
                ForEach(Array(resolvedSteps.enumerated()), id: \.element.id) { index, step in
                    HStack(spacing: 12) {
                        // Circle
                        Circle()
                            .fill(step.status == "pending" ? Color.clear : statusColor(step.status))
                            .overlay(
                                Circle()
                                    .stroke(statusColor(step.status), lineWidth: 2)
                            )
                            .frame(width: 32, height: 32)

                        Text(step.label)
                            .font(.subheadline)
                            .fontWeight(step.status == "current" ? .bold : .regular)
                            .foregroundColor(step.status == "pending" ? .secondary : .primary)
                    }

                    // Connector
                    if index < resolvedSteps.count - 1 {
                        Rectangle()
                            .fill(Color(.systemGray4))
                            .frame(width: 2, height: 20)
                            .padding(.leading, 15)
                    }
                }
            }
            .padding(8)
        } else {
            // Horizontal layout
            HStack(spacing: 0) {
                ForEach(Array(resolvedSteps.enumerated()), id: \.element.id) { index, step in
                    VStack(spacing: 4) {
                        Circle()
                            .fill(step.status == "pending" ? Color.clear : statusColor(step.status))
                            .overlay(
                                Circle()
                                    .stroke(statusColor(step.status), lineWidth: 2)
                            )
                            .frame(width: 32, height: 32)

                        Text(step.label)
                            .font(.caption2)
                            .fontWeight(step.status == "current" ? .bold : .regular)
                            .foregroundColor(step.status == "pending" ? .secondary : .primary)
                            .multilineTextAlignment(.center)
                    }

                    // Connector line
                    if index < resolvedSteps.count - 1 {
                        Rectangle()
                            .fill(Color(.systemGray4))
                            .frame(height: 2)
                            .frame(width: 24)
                    }
                }
            }
            .padding(8)
        }
    }
}
