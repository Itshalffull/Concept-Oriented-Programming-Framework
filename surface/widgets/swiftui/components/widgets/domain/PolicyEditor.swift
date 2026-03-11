// ============================================================
// Clef Surface SwiftUI Widget — PolicyEditor
//
// Access-control policy rule editor rendered as a list of policy
// rule rows. Each row displays an ALLOW/DENY rule with subject,
// action, and resource fields. Supports adding, removing, and
// toggling rule effects.
// ============================================================

import SwiftUI

struct PolicyRule: Identifiable {
    let id: String
    let subject: String
    let action: String
    let resource: String
    let effect: String // "ALLOW" or "DENY"
}

struct PolicyEditorView: View {
    var rules: [PolicyRule]
    var selectedIndex: Int = -1
    var onSelectRule: (Int) -> Void = { _ in }
    var onAdd: () -> Void = {}
    var onRemove: (String) -> Void = { _ in }
    var onToggleEffect: (String) -> Void = { _ in }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Policy Rules")
                    .font(.headline)
                    .fontWeight(.bold)
                Text("(\(rules.count) rules)")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            ForEach(Array(rules.enumerated()), id: \.element.id) { index, rule in
                let isSelected = index == selectedIndex
                let effectColor: Color = rule.effect == "ALLOW" ? .green : .red

                SwiftUI.Button(action: { onSelectRule(index) }) {
                    HStack(spacing: 8) {
                        Text(rule.effect)
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundColor(effectColor)

                        Text(rule.subject)
                            .font(.subheadline)

                        Text(rule.action)
                            .font(.subheadline)
                            .foregroundColor(.purple)

                        Text(rule.resource)
                            .font(.caption)
                            .foregroundColor(.secondary)

                        Spacer()

                        SwiftUI.Button(action: { onToggleEffect(rule.id) }) {
                            Image(systemName: "arrow.left.arrow.right")
                                .foregroundColor(.secondary)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Toggle ALLOW/DENY")

                        SwiftUI.Button(action: { onRemove(rule.id) }) {
                            Image(systemName: "xmark")
                                .foregroundColor(.red)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Remove rule")
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
                .accessibilityLabel("\(rule.effect) \(rule.subject) \(rule.action) on \(rule.resource)")
            }

            SwiftUI.Button(action: onAdd) {
                HStack {
                    Image(systemName: "plus")
                    Text("Add Rule")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
        }
        .padding(8)
    }
}
