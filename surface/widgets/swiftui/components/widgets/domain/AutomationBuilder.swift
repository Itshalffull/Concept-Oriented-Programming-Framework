// ============================================================
// Clef Surface SwiftUI Widget — AutomationBuilder
//
// Linear step-sequence builder for constructing automation rules.
// Renders a vertical flow of steps connected by arrow connectors,
// with step configuration and an add-step action at the end.
// ============================================================

import SwiftUI

struct AutomationStep: Identifiable {
    let id: String
    let type: String
    var config: [String: String]? = nil
}

struct AutomationBuilderView: View {
    var steps: [AutomationStep]
    var selectedIndex: Int = -1
    var onSelectStep: (Int) -> Void = { _ in }
    var onAddStep: () -> Void = {}
    var onRemoveStep: (String) -> Void = { _ in }
    var onConfigure: (String) -> Void = { _ in }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            ScrollView {
                LazyVStack(spacing: 0) {
                    ForEach(Array(steps.enumerated()), id: \.element.id) { index, step in
                        let isSelected = index == selectedIndex

                        SwiftUI.Button(action: { onSelectStep(index) }) {
                            HStack(spacing: 12) {
                                Text("\(index + 1)")
                                    .font(.subheadline)
                                    .fontWeight(.bold)
                                    .foregroundColor(.accentColor)

                                VStack(alignment: .leading, spacing: 2) {
                                    Text(step.type)
                                        .font(.body)
                                        .fontWeight(isSelected ? .bold : .regular)
                                    Text(step.config != nil ? "configured" : "unconfigured")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                }

                                Spacer()
                            }
                            .padding(12)
                            .background(
                                RoundedRectangle(cornerRadius: 8)
                                    .fill(isSelected ? Color.accentColor.opacity(0.1) : Color(.systemBackground))
                            )
                            .overlay(
                                RoundedRectangle(cornerRadius: 8)
                                    .stroke(Color(.systemGray4), lineWidth: 1)
                            )
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Step \(index + 1): \(step.type)")

                        // Connector between steps
                        if index < steps.count - 1 {
                            VStack(spacing: 0) {
                                Text("\u{2502}")
                                    .foregroundColor(.secondary)
                                Text("\u{25BC}")
                                    .foregroundColor(.secondary)
                            }
                            .frame(maxWidth: .infinity)
                        }
                    }
                }
            }

            SwiftUI.Button(action: onAddStep) {
                HStack {
                    Image(systemName: "plus")
                    Text("Add Step")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .padding(.top, 12)
        }
        .padding(8)
    }
}
