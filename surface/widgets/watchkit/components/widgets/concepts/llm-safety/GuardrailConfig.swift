import SwiftUI

// State machine: viewing | ruleSelected (read-only on watch)
enum GuardrailConfigWatchState {
    case viewing
    case ruleSelected
}

enum GuardrailConfigWatchEvent {
    case selectRule
    case deselect
}

func guardrailConfigWatchReduce(_ state: GuardrailConfigWatchState, _ event: GuardrailConfigWatchEvent) -> GuardrailConfigWatchState {
    switch state {
    case .viewing:
        if case .selectRule = event { return .ruleSelected }
        return state
    case .ruleSelected:
        if case .deselect = event { return .viewing }
        if case .selectRule = event { return .ruleSelected }
        return state
    }
}

struct GuardrailRuleData: Identifiable {
    let id: String
    let name: String
    let type: String // "content-filter", "token-limit", "rate-limit", "pii-detection", etc.
    var enabled: Bool = true
    var severity: String = "medium" // "low", "medium", "high", "critical"
    var description: String? = nil
}

struct GuardrailConfigWatchView: View {
    let rules: [GuardrailRuleData]
    var title: String = "Guardrails"
    var onToggle: ((String, Bool) -> Void)? = nil

    @State private var state: GuardrailConfigWatchState = .viewing
    @State private var selectedId: String? = nil

    private func severityColor(_ severity: String) -> Color {
        switch severity {
        case "low": return .green
        case "medium": return .yellow
        case "high": return .orange
        case "critical": return .red
        default: return .secondary
        }
    }

    private func typeIcon(_ type: String) -> String {
        switch type {
        case "content-filter": return "text.badge.xmark"
        case "token-limit": return "number.circle"
        case "rate-limit": return "speedometer"
        case "pii-detection": return "person.badge.shield.checkmark"
        default: return "shield"
        }
    }

    private var enabledCount: Int {
        rules.filter { $0.enabled }.count
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 6) {
                // Header
                HStack {
                    Image(systemName: "shield.checkered")
                        .font(.system(size: 10))
                        .foregroundColor(.blue)
                    Text(title)
                        .font(.caption2)
                        .fontWeight(.bold)
                    Spacer()
                    Text("\(enabledCount)/\(rules.count)")
                        .font(.system(size: 8))
                        .foregroundColor(.secondary)
                }

                // Rules list
                ForEach(rules) { rule in
                    Button {
                        if selectedId == rule.id {
                            selectedId = nil
                            state = guardrailConfigWatchReduce(state, .deselect)
                        } else {
                            selectedId = rule.id
                            state = guardrailConfigWatchReduce(state, .selectRule)
                        }
                    } label: {
                        HStack(spacing: 4) {
                            // Status indicator
                            Image(systemName: typeIcon(rule.type))
                                .font(.system(size: 8))
                                .foregroundColor(rule.enabled ? .blue : .secondary)

                            // Name
                            Text(rule.name)
                                .font(.system(size: 9))
                                .foregroundColor(rule.enabled ? .primary : .secondary)
                                .lineLimit(1)

                            Spacer()

                            // Severity badge
                            Text(rule.severity.prefix(1).uppercased())
                                .font(.system(size: 7, weight: .bold))
                                .foregroundColor(severityColor(rule.severity))

                            // Enabled indicator
                            Circle()
                                .fill(rule.enabled ? Color.green : Color.secondary.opacity(0.3))
                                .frame(width: 5, height: 5)
                        }
                        .padding(4)
                        .background(selectedId == rule.id ? Color.blue.opacity(0.1) : Color.clear)
                        .cornerRadius(3)
                    }
                    .buttonStyle(.plain)

                    // Selected detail
                    if selectedId == rule.id {
                        VStack(alignment: .leading, spacing: 2) {
                            HStack {
                                Text(rule.name)
                                    .font(.system(size: 8, weight: .semibold))
                                Spacer()
                                Text(rule.enabled ? "Enabled" : "Disabled")
                                    .font(.system(size: 7))
                                    .foregroundColor(rule.enabled ? .green : .secondary)
                            }
                            Text("Type: \(rule.type)")
                                .font(.system(size: 8))
                                .foregroundColor(.secondary)
                            Text("Severity: \(rule.severity)")
                                .font(.system(size: 8))
                                .foregroundColor(severityColor(rule.severity))
                            if let desc = rule.description {
                                Text(desc)
                                    .font(.system(size: 8))
                                    .foregroundColor(.secondary)
                                    .lineLimit(3)
                            }
                            if let onToggle = onToggle {
                                Button(rule.enabled ? "Disable" : "Enable") {
                                    onToggle(rule.id, !rule.enabled)
                                }
                                .font(.caption2)
                                .buttonStyle(.bordered)
                            }
                        }
                        .padding(4)
                        .background(Color.secondary.opacity(0.05))
                        .cornerRadius(3)
                    }
                }
            }
            .padding(.horizontal, 2)
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Guardrail configuration, \(enabledCount) of \(rules.count) enabled")
    }
}
