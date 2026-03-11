// ============================================================
// Clef Surface SwiftUI Widget — ConditionBuilder
//
// Composable condition row builder for constructing filter and
// rule expressions. Renders a column of condition rows with
// IF/AND/OR logic toggles, field/operator/value display, and
// add/remove actions.
// ============================================================

import SwiftUI

struct Condition: Identifiable {
    let id = UUID()
    let field: String
    let `operator`: String
    let value: String
    var conjunction: String = "AND"
}

struct ConditionBuilderView: View {
    var conditions: [Condition]
    var selectedIndex: Int = -1
    var onSelectCondition: (Int) -> Void = { _ in }
    var onAdd: () -> Void = {}
    var onRemove: (Int) -> Void = { _ in }
    var onChange: (Int, Condition) -> Void = { _, _ in }

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            ForEach(Array(conditions.enumerated()), id: \.element.id) { index, cond in
                let isSelected = index == selectedIndex
                let prefix = index == 0 ? "IF" : cond.conjunction

                SwiftUI.Button(action: { onSelectCondition(index) }) {
                    HStack(spacing: 8) {
                        Text(prefix)
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundColor(.purple)

                        Text(cond.field)
                            .font(.subheadline)
                            .fontWeight(.bold)

                        Text(cond.operator)
                            .font(.subheadline)
                            .foregroundColor(.secondary)

                        Text(cond.value)
                            .font(.subheadline)

                        Spacer()

                        SwiftUI.Button(action: { onRemove(index) }) {
                            Image(systemName: "xmark")
                                .foregroundColor(.red)
                        }
                        .buttonStyle(.plain)
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
                .accessibilityLabel("\(prefix) \(cond.field) \(cond.operator) \(cond.value)")
            }

            SwiftUI.Button(action: onAdd) {
                HStack {
                    Image(systemName: "plus")
                    Text("Add Condition")
                }
                .frame(maxWidth: .infinity)
            }
            .buttonStyle(.bordered)
            .padding(.top, 8)
        }
        .padding(8)
    }
}
